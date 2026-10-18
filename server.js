/**
 * Custom Next.js server with Socket.IO for online race rooms.
 * Run with: npm run dev  (see package.json scripts)
 */
const crypto = require("crypto");
const { createServer } = require("http");
const next = require("next");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");
const { pushLive } = require("./server-live");
const { attachTaktik, ttRooms } = require("./server-taktik");
const { handleAccountApi, recordResult, userIdFromToken, setPresence, setFriendAdded, friendIdByCode, inviteCard, cleanLook } = require("./server-accounts");
const { refForSocket, addReport, shownNick, cleanBlocks } = require("./server-refs");
const { handleAppApi } = require("./server-app");

// socket id → that player's ref (server-refs.js), so room views can carry it for report / block
const refById = new Map();
/** A seat as other phones see it: its ref (house players get a made-up one) and the nickname, hidden if reported enough. */
const seatRef = (p) => p.ref ?? refById.get(p.id) ?? null;
const seatNick = (p) => shownNick(seatRef(p), p.nick);
/** Either of two queued players blocked the other. */
const blockedPair = (a, b) => !!(a.socket.data.blocks?.has(b.socket.data.ref) || b.socket.data.blocks?.has(a.socket.data.ref));

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);
const app = next({ dev });
const handle = app.getRequestHandler();

/** code -> room */
const rooms = new Map();

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
/**
 * Nicknames are shown to strangers: strip control characters and swap anything
 * offensive (Turkish and English, matched after folding accents and leetspeak)
 * for a neutral name. App Store guideline 1.2 asks for this kind of filtering.
 */
const NICK_BLOCK = ["amk", "aq", "orospu", "orosbu", "pic", "piç", "sik", "sikis", "sikik", "yarak", "yarrak", "got", "göt", "ibne", "kahpe", "pezevenk", "amcik", "amcık", "siktir", "fuck", "shit", "bitch", "cunt", "dick", "pussy", "nigger", "nigga", "fag", "whore", "slut", "rape", "nazi", "hitler"];
function cleanNick(nick) {
  // control, zero-width and text-direction characters (a name could otherwise hide or flip text)
  const raw = String(nick || "").replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g, "").trim().slice(0, 20);
  const folded = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .replace(/0/g, "o").replace(/1/g, "i").replace(/3/g, "e").replace(/4/g, "a").replace(/5/g, "s").replace(/7/g, "t").replace(/@/g, "a").replace(/\$/g, "s")
    .replace(/[^a-z]/g, "");
  const words = raw.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i").split(/[^a-z]+/);
  // very short words only as whole words ("aq" in "aqua", "pic" in "picasso" are fine), the rest anywhere
  const bad = NICK_BLOCK.some((w) => {
    const f = w.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");
    return f.length <= 3 ? words.includes(f) : folded.includes(f);
  });
  return bad ? "player" + Math.floor(100 + Math.random() * 900) : raw;
}

// Random opponents by rank (tier = rank index of the app's level, 0 = Amateur):
// same rank first, one rank either side after TIER_WIDEN_MS of waiting, anyone
// after twice that. The app's own house-bot fallback still kicks in at 20 s.
const TIER_WIDEN_MS = 6000;
const cleanTier = (t) => (Number.isInteger(t) && t >= 0 && t < 10 ? t : 0);
function tierGap(since) {
  const waited = Date.now() - since;
  return waited < TIER_WIDEN_MS ? 0 : waited < 2 * TIER_WIDEN_MS ? 1 : 99;
}
/**
 * Criteria newer apps added ("mate-…" played with, "coach-…" managed by, "arab-…" Saudi / Egyptian clubs, "hon-…" honour counts and birth decades): the caps
 * a phone needs to draw a Tic-Tac-Toe grid. Older apps send no caps.
 */
const gridNeeds = (grid) =>
  [...(grid?.rows ?? []), ...(grid?.cols ?? [])].map((id) => (typeof id === "string" ? id.split("-")[0] : "")).filter((k) => k === "mate" || k === "coach" || k === "arab" || k === "hon");
const canDraw = (s, grid) => gridNeeds(grid).every((k) => !!s?.data.caps?.includes(k));
/** knows every criterion kind the app can deal (so the host may use them all) */
const knowsMates = (s) => ["mate", "coach", "hon"].every((k) => !!s?.data.caps?.includes(k));
/** set once the socket server is up (module-level helpers look sockets up through it) */
let ioServer = null;
const htAllKnowMates = (room) => room.players.every((p) => knowsMates(ioServer?.sockets.sockets.get(p.id)));

/** Pairs whoever in a queue can meet now, oldest first: { pairs: [older, newer][], rest }. */
function takePairs(queue, same = () => true) {
  const waiting = queue.filter((w) => w.socket.connected).sort((a, b) => a.since - b.since);
  const taken = new Set();
  const pairs = [];
  for (const a of waiting) {
    if (taken.has(a)) continue;
    let best = null;
    for (const b of waiting) {
      if (b === a || taken.has(b) || !same(a, b) || blockedPair(a, b)) continue;
      const gap = Math.abs(a.tier - b.tier);
      if (gap <= Math.max(tierGap(a.since), tierGap(b.since)) && (!best || gap < Math.abs(a.tier - best.tier))) best = b;
    }
    if (best) {
      taken.add(a).add(best);
      pairs.push([a, best]);
    }
  }
  return { pairs, rest: waiting.filter((w) => !taken.has(w)) };
}

function makeCode() {
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return rooms.has(code) ? makeCode() : code;
}

function publicRoom(room) {
  return {
    code: room.code,
    difficulty: room.difficulty,
    matchId: room.matchId,
    started: room.started,
    players: room.players.map((p) => ({
      id: p.id,
      nick: p.nick,
      solved: p.solved,
      failed: p.failed,
      totalGuesses: p.totalGuesses,
      done: p.done,
      won: p.won,
      isHost: p.isHost,
    })),
  };
}


// ── Hat-trick (3×3 criteria grid) online rooms ────────────────────────────
// The host's phone builds the grid and sends criterion ids; both phones
// validate guesses against the same bundled player list. The server owns the
// turn, the 45 s clock and the result.
/** How long a dropped phone has to come back to a live online match. */
const REJOIN_MS = Number(process.env.REJOIN_MS) || 60_000;
const HT_TURN_MS = 45_000;
/** a match is a series: first to this many game wins takes it */
const HT_TARGET = 3;
/** comeback bonus: whoever lost the last game of the series gets this much extra on each turn */
const HT_COMEBACK_MS = 10_000;
// matched random games open with a short VS screen before X's clock starts
const HT_INTRO_MS = 2500;
const HT_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];
/** code -> hat-trick room */
const htRooms = new Map();
/** players waiting for a random opponent: { socket, nick, grid, league, tier, since, pair } */
let htQueue = [];

function htResult(board) {
  for (const [a, b, c] of HT_LINES) {
    if (board[a] && board[b] && board[c] && board[a].mark === board[b].mark && board[b].mark === board[c].mark) {
      return board[a].mark;
    }
  }
  if (!board.every(Boolean)) return null;
  const x = board.filter((c) => c.mark === "X").length;
  return x === 9 - x ? "draw" : x > 9 - x ? "X" : "O";
}

function htPublic(room) {
  return {
    code: room.code,
    grid: room.grid,
    started: room.started,
    board: room.board,
    turn: room.turn,
    winner: room.winner,
    flash: room.flash,
    remainingMs: room.deadline ? Math.max(0, room.deadline - Date.now()) : HT_TURN_MS,
    // the current turn's full length (longer for the comeback player)
    turnMs: room.turnLen ?? htTurnMs(room),
    // mark of the player with the comeback bonus this game, if any
    comeback: room.players.find((p) => p.id === room.comeback)?.mark ?? null,
    steals: room.steals,
    used: room.used,
    drawOffer: room.drawOffer ?? null,
    endReason: room.endReason ?? null,
    // jokers left this game, the same for both players (never bought, never saved up)
    jokers: htJokers(room),
    series: htSeries(room),
    league: room.league || "all",
    // every phone in the room can draw "played with" criteria: the host may deal them
    mates: htAllKnowMates(room),
    players: room.players.map((p) => ({ id: p.id, ref: seatRef(p), nick: seatNick(p), mark: p.mark, tier: p.tier ?? null, avatar: p.avatar ?? null, frame: p.frame ?? null })),
  };
}

/** Each game both players get the same jokers: one extra time (+15 s) and one hint. */
const HT_JOKERS = { time: 1, hint: 1 };
const HT_JOKER_TIME_MS = 15_000;
function htJokers(room) {
  room.jokers ??= { X: { ...HT_JOKERS }, O: { ...HT_JOKERS } };
  return room.jokers;
}

/** Game wins per mark (wins follow the player, marks swap every game). */
function htSeries(room) {
  const of = (mark) => room.wins?.[room.players.find((p) => p.mark === mark)?.id] ?? 0;
  const X = of("X");
  const O = of("O");
  return { X, O, target: HT_TARGET, over: X >= HT_TARGET || O >= HT_TARGET };
}

/** Rate a two-player result (marks): winner first, or a draw. Guests (no uid) aren't rated. */
function rateDuel(game, room, winnerMark) {
  const [a, b] = room.players;
  if (!a?.uid || !b?.uid) return;
  if (winnerMark === "draw") return recordResult(game, [[a.uid, b.uid]]);
  const w = room.players.find((p) => p.mark === winnerMark);
  const l = room.players.find((p) => p.mark !== winnerMark);
  if (w && l) recordResult(game, [[w.uid], [l.uid]]);
}

/** Hat-trick: once a series is decided, rate it (once per series). */
function htRateSeries(room) {
  const s = htSeries(room);
  if (!s.over || room.seriesRated) return;
  room.seriesRated = true;
  rateDuel("ht", room, s.X >= HT_TARGET ? "X" : "O");
}

/** Count a finished game towards the series; the loser gets the comeback bonus next game. */
function htTally(room) {
  if (room.winner !== "X" && room.winner !== "O") return;
  const p = room.players.find((x) => x.mark === room.winner);
  if (!p) return;
  room.wins = room.wins || {};
  room.wins[p.id] = (room.wins[p.id] || 0) + 1;
  room.comeback = room.players.find((x) => x.mark !== room.winner)?.id ?? null;
}

/** Length of the turn now being played: the comeback player thinks a little longer. */
function htTurnMs(room) {
  const mover = room.players.find((p) => p.mark === room.turn);
  return HT_TURN_MS + (mover && mover.id === room.comeback ? HT_COMEBACK_MS : 0);
}

function htCode() {
  const code = makeCode();
  return htRooms.has(code) ? htCode() : code;
}


// ── Quiz (Bilgi Yarışı) rooms ─────────────────────────────────────────────
// The creator's phone deals the questions (generated from the shared data,
// answers included). The server keeps the answers to itself until the reveal,
// runs the clock and the scoring. Random rooms fill up with house players
// (nicknames, human-ish timing) when not enough people are searching.
const QZ_MAX = 5;
const QZ_INTRO_MS = 2000;
const QZ_REVEAL_MS = 3000;
/** the phones animate the old options out and the new ones in before the clock runs */
const QZ_GAP_MS = 900;
/** an open random room starts this long after it was opened */
const QZ_FILL_MS = 15_000;
/** code -> quiz room */
const qzRooms = new Map();
/** open random rooms, "difficulty:tier" -> code: players meet others on the same quiz level and rank */
const qzOpen = {};
const qzLevelOf = (d) => (d === "easy" || d === "hard" ? d : "normal");

const QZ_NAMES = ["lucas", "mateo", "jonas", "luca", "liam", "noah", "oliver", "james", "jack", "harry", "ethan", "leo", "hugo", "louis", "jules", "theo", "enzo", "paul", "felix", "max", "finn", "lukas", "niklas", "matteo", "lorenzo", "marco", "giulia", "sofia", "alejandro", "diego", "pablo", "javi", "lucia", "carlos", "joao", "rafa", "tiago", "bruno", "pedro", "gabriel", "thiago", "nico", "santi", "martina", "valentina", "sven", "lars", "erik", "mats", "anders", "piotr", "kuba", "marek", "ivan", "luka", "nikola", "dmitri", "andrei", "yuki", "kenji", "minjun", "jisoo", "wei", "arjun", "rohan", "omar", "youssef", "karim", "amir", "kofi", "kwame", "chidi", "emma", "chloe", "mia", "ana", "nina", "sara", "eva"];
const QZ_TAILS = ["", "", "", "7", "9", "10", "11", "22", "23", "99", "88", "04", "12", "_fc", "_10", "_gol", "fc", "_99", "77", "14"];
function qzNick() {
  const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];
  const name = pick(QZ_NAMES);
  const cased = Math.random() < 0.4 ? name[0].toUpperCase() + name.slice(1) : name;
  const tail = pick(QZ_TAILS);
  const sep = tail && !tail.startsWith("_") && Math.random() < 0.25 ? "." : "";
  return cased + sep + tail;
}

/** Same rule as quizPoints in src/lib/quiz.ts: 10 when instant, 5 at the buzzer. */
function qzPoints(ms, limit) {
  const left = Math.max(0, Math.min(1, 1 - ms / limit));
  return Math.round(5 + 5 * left);
}

/** A {tr, en} pair of short strings: questions come from a phone and go to other phones. */
const qzText = (l, max) => l && typeof l.tr === "string" && typeof l.en === "string" && l.tr.length <= max && l.en.length <= max;

function qzValidQuestions(qs) {
  return (
    Array.isArray(qs) &&
    qs.length >= 1 &&
    qs.length <= 20 &&
    qs.every(
      (q) =>
        q &&
        qzText(q.text, 200) &&
        (q.context == null || qzText(q.context, 200)) &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        q.options.every((o) => qzText(o, 80)) &&
        // "who has more" questions carry each option's number, shown at the reveal
        (q.values == null || (Array.isArray(q.values) && q.values.length === 4 && q.values.every((v) => qzText(v, 24)))) &&
        Number.isInteger(q.answer) &&
        q.answer >= 0 &&
        q.answer < 4
    )
  );
}

function qzSettings(s) {
  const seconds = [10, 15, 20].includes(Number(s?.seconds)) ? Number(s.seconds) : 15;
  const maxPlayers = Math.max(2, Math.min(QZ_MAX, Number(s?.maxPlayers) || QZ_MAX));
  const category = ["mixed", "players", "matches"].includes(s?.category) ? s.category : "mixed";
  const difficulty = qzLevelOf(s?.difficulty);
  return { seconds, maxPlayers, category, difficulty };
}

/** `viewer`: once they've answered, they see what the others picked (like the answers landing live). */
function qzPublic(room, viewer) {
  const q = room.questions[room.index];
  const showQ = room.phase === "question" || room.phase === "reveal";
  const reveal = room.phase === "reveal" || room.phase === "done";
  return {
    code: room.code,
    random: room.random,
    hostId: room.hostId,
    settings: room.settings,
    phase: room.phase,
    index: room.index,
    total: room.questions.length,
    question: showQ ? { text: q.text, context: q.context ?? null, options: q.options } : null,
    answer: room.phase === "reveal" ? q.answer : null,
    // the numbers would give the answer away: only with it
    values: room.phase === "reveal" && q?.values ? q.values : null,
    remainingMs: room.deadline ? Math.max(0, room.deadline - Date.now()) : 0,
    // a random room still filling up: how long until it starts anyway (the search screen's countdown ring)
    startsInMs: room.random && room.phase === "lobby" && room.fillAt ? Math.max(0, room.fillAt - Date.now()) : null,
    players: room.players.map((p) => ({
      id: p.id,
      ref: seatRef(p),
      nick: seatNick(p),
      score: p.score,
      // 50/50 left for this player (the viewer reads its own)
      fifty: p.id === viewer ? (p.fifty ?? 1) : undefined,
      answered: room.answers.has(p.id),
      choice: reveal || (viewer && room.answers.has(viewer)) || p.id === viewer ? (room.answers.get(p.id)?.choice ?? null) : null,
      gained: reveal ? (p.gained ?? 0) : 0,
    })),
  };
}

// ── Quiz levels and standings ─────────────────────────────────────────────
// Each phone sends a random player id (no accounts). The server keeps XP and
// points per id in a JSON file, so the numbers can't be edited on the phone.
// House players never get a record: the standings are people only.
const QZ_STATS_FILE = process.env.QZ_STATS_FILE || path.join(__dirname, "data", "quiz-stats.json");
/** pid -> { nick, xp, points, games, wins, week, weekXp } */
let qzStats = {};
try {
  qzStats = JSON.parse(fs.readFileSync(QZ_STATS_FILE, "utf8"));
} catch {}
let qzSaveTimer = null;
function qzSaveStats() {
  clearTimeout(qzSaveTimer);
  qzSaveTimer = setTimeout(() => {
    fs.mkdirSync(path.dirname(QZ_STATS_FILE), { recursive: true });
    fs.writeFile(QZ_STATS_FILE, JSON.stringify(qzStats), () => {});
  }, 1000);
}

/** Weeks start on Monday (UTC). */
const qzWeek = () => Math.floor((Date.now() / 86_400_000 + 3) / 7);

/** Level from total XP: level 2 at 100 XP, each next level needs 50 more than the last. */
function qzLevel(xp) {
  let level = 1;
  let need = 100;
  let into = xp;
  while (into >= need) {
    into -= need;
    level++;
    need = 100 + (level - 1) * 50;
  }
  return { level, into, need };
}

/** XP for one finished game: the points scored, a finishing bonus and a bonus for the podium. */
const QZ_PLACE_XP = [30, 20, 10, 5, 0];
function qzGameXp(points, place, players) {
  return points + 10 + (players > 1 ? QZ_PLACE_XP[place] ?? 0 : 0);
}

function qzProfile(pid) {
  const st = qzStats[pid];
  if (!st) return { level: 1, into: 0, need: 100, xp: 0, points: 0, games: 0, wins: 0 };
  return { ...qzLevel(st.xp), xp: st.xp, points: st.points, games: st.games, wins: st.wins };
}

const qzValidPid = (pid) => typeof pid === "string" && /^[a-z0-9]{8,40}$/i.test(pid);

// ── Possession Play (31 hexes) online rooms ───────────────────────────────
// The host's phone deals the board (criterion ids). The mover's phone works
// out which hexes a footballer claims (both phones share the player list);
// the server applies the move, runs both chess clocks and decides the result.
const PP_HEXES = 31;
const PP_CLOCK_MS = 120_000;
/** code -> possession room */
const ppRooms = new Map();
/** players waiting for a random opponent: { socket, nick, board, tier, since, pair } */
let ppQueue = [];

// ── Rondo (src/lib/rondo.ts): a club comes up, the two players take turns naming someone who played
// there; the server deals the clubs, judges every name and runs the clock; out of time loses the round.
const rdRooms = new Map();
let rdQueue = [];
/** the rules module, once loaded (server-taktik.js registers the "@/" resolver it needs) */
let RD = null;
import(require("node:url").pathToFileURL(path.join(__dirname, "src", "lib", "rondo.ts")).href)
  .then((m) => (RD = m))
  .catch((e) => console.error("rondo rules:", e?.message));
/** pause between rounds (the phones show who took it) */
const RD_ROUND_GAP_MS = 3_000;

function rdPublic(room) {
  return {
    code: room.code,
    started: room.started,
    round: room.round,
    club: room.clubs[room.round] ?? null,
    score: room.score,
    turn: room.turn,
    remainingMs: room.deadline ? Math.max(0, room.deadline - Date.now()) : 0,
    turnMs: room.turnMs,
    names: room.names,
    roundEnd: room.roundEnd,
    winner: room.winner,
    flash: room.flash,
    // one extra-time joker per player per match
    jokers: room.jokers,
    players: room.players.map((p) => ({ id: p.id, ref: seatRef(p), nick: seatNick(p), mark: p.mark, tier: p.tier ?? null, avatar: p.avatar ?? null, frame: p.frame ?? null })),
  };
}

function rdNewRoom(code, players) {
  return { code, clubs: RD.dealRondo(), round: 0, score: { X: 0, O: 0 }, turn: "X", names: [], roundEnd: null, winner: null, flash: null, jokers: { X: { time: 1 }, O: { time: 1 } }, started: false, deadline: 0, turnMs: 0, timer: null, players };
}

function rdCode() {
  const code = makeCode();
  return rdRooms.has(code) ? rdCode() : code;
}

function ppResult(owners) {
  if (!owners.every(Boolean)) return null;
  const x = owners.filter((o) => o.mark === "X").length;
  return x === PP_HEXES - x ? "draw" : x > PP_HEXES - x ? "X" : "O";
}

function ppPublic(room) {
  const clocks = { ...room.clocks };
  if (room.started && !room.winner && room.turnStart) clocks[room.turn] = Math.max(0, clocks[room.turn] - (Date.now() - room.turnStart));
  return {
    code: room.code,
    board: room.board,
    started: room.started,
    owners: room.owners,
    turn: room.turn,
    clocks,
    winner: room.winner,
    flash: room.flash,
    used: room.used,
    players: room.players.map((p) => ({ id: p.id, ref: seatRef(p), nick: seatNick(p), mark: p.mark })),
  };
}

function ppNewRoom(code, board, players) {
  return {
    code,
    board,
    started: false,
    owners: Array(PP_HEXES).fill(null),
    turn: "X",
    clocks: { X: PP_CLOCK_MS, O: PP_CLOCK_MS },
    turnStart: null,
    timer: null,
    winner: null,
    flash: null,
    used: [],
    players,
  };
}

function ppCode() {
  const code = makeCode();
  return ppRooms.has(code) ? ppCode() : code;
}

/** Possession hexes that touch (same rule as NEIGHBOURS in mobile/src/lib/possession.ts) */
const PP_ROWS = [4, 5, 4, 5, 4, 5, 4];
const PP_NEIGHBOURS = (() => {
  const pos = PP_ROWS.flatMap((len, r) => Array.from({ length: len }, (_, c) => [r, c]));
  const at = (r, c) => (r < 0 || r >= PP_ROWS.length || c < 0 || c >= PP_ROWS[r] ? -1 : PP_ROWS.slice(0, r).reduce((a, b) => a + b, 0) + c);
  return pos.map(([r, c]) => {
    const adj = PP_ROWS[r] === 5 ? [c - 1, c] : [c, c + 1];
    return [at(r, c - 1), at(r, c + 1), ...adj.map((cc) => at(r - 1, cc)), ...adj.map((cc) => at(r + 1, cc))].filter((i) => i >= 0);
  });
})();

// Grids and boards come from a phone and go to the other phone: short criterion ids only
const critId = (x) => typeof x === "string" && x.length > 0 && x.length <= 48;
const htGridOk = (g) => !!g && Array.isArray(g.rows) && Array.isArray(g.cols) && g.rows.length === 3 && g.cols.length === 3 && [...g.rows, ...g.cols].every(critId);
const ppBoardOk = (b) => Array.isArray(b) && b.length === PP_HEXES && b.every(critId);
/** a footballer's name as sent by a phone */
const nameOf = (v) => (typeof v === "string" ? v.trim().slice(0, 60) : "");

// ── Card Duel (Kart Düellosu; rules in src/lib/duel.ts, docs/design/kart-duellosu.md) ──
// Each phone sends its 7-card hand (card ids). The server deals the questions, keeps
// both picks hidden until both are in (or the clock runs out), judges the round from
// server-data/duel-cards.json and runs the 20 s clock.
const DZ_CARDS = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, "server-data", "duel-cards.json"), "utf8"));
  } catch {
    return {};
  }
})();
// card row: [apps, goals, caps, intGoals, height, born, clubs, seasons, honours, tier]
const DZ_STATS = ["apps", "goals", "caps", "intGoals", "height", "age", "clubs", "seasons", "honours"];
const DZ_LOWER_OK = ["height", "age", "clubs"];
const DZ_HAND = 7;
const DZ_BUDGET = 15;
const DZ_PICK_MS = 20_000;
const DZ_INTRO_MS = 2500;
/** both cards stay face up this long before the next question */
const DZ_REVEAL_MS = 2800;
const dzRooms = new Map();
let dzQueue = [];

function dzHandOk(hand) {
  if (!Array.isArray(hand) || hand.length !== DZ_HAND || new Set(hand).size !== DZ_HAND) return false;
  if (!hand.every((id) => Number.isInteger(id) && DZ_CARDS[id])) return false;
  return hand.reduce((n, id) => n + DZ_CARDS[id][9], 0) <= DZ_BUDGET;
}

function dzQuestions() {
  const stats = [...DZ_STATS].sort(() => Math.random() - 0.5).slice(0, DZ_HAND);
  let lowers = 0;
  return stats.map((stat) => {
    const lower = DZ_LOWER_OK.includes(stat) && lowers < 2 && Math.random() < 0.35;
    if (lower) lowers++;
    return { stat, lower };
  });
}

/** 0 = first card wins, 1 = second, "draw"; same rule as roundWinner in src/lib/duel.ts */
function dzJudge(q, a, b) {
  const k = DZ_STATS.indexOf(q.stat);
  const va = DZ_CARDS[a]?.[k] ?? 0;
  const vb = DZ_CARDS[b]?.[k] ?? 0;
  if (q.stat === "age" ? Math.floor(va / 10000) === Math.floor(vb / 10000) : va === vb) return "draw";
  const higherWins = q.stat === "age" ? q.lower : !q.lower;
  return va > vb === higherWins ? 0 : 1;
}

function dzNewRoom(code, players) {
  return { code, players, started: false, questions: dzQuestions(), round: 0, picks: [null, null], results: [], deadline: 0, timer: null, over: false, rated: false };
}

function dzCode() {
  const code = makeCode();
  return dzRooms.has(code) ? dzCode() : code;
}

/** What phones see: the questions so far, the played cards, never an unplayed pick. */
function dzPublic(room) {
  const score = [0, 0];
  for (const r of room.results) if (r.winner !== "draw") score[r.winner]++;
  return {
    code: room.code,
    /** counts matches in this room (rematches), so phones key their XP per match */
    game: room.game ?? 0,
    started: room.started,
    round: room.round,
    question: room.started && !room.over ? room.questions[room.round] : null,
    deadline: room.deadline,
    picked: room.picks.map((p) => p !== null),
    results: room.results,
    score,
    over: room.over,
    players: room.players.map((p) => ({ id: p.id, ref: seatRef(p), nick: seatNick(p), side: p.side, tier: p.tier ?? null, avatar: p.avatar ?? null, frame: p.frame ?? null })),
  };
}

// ── Live Activity over APNs (server-live.js) ──
// A phone in a match sends `la:token` { game, token, s } (s = its strings, in its language) and
// `app:state` { active }. While its app is in the background, every change to the match updates
// its Live Activity from here; when the turn comes to it, the update carries an alert.
const LIVE_STALE_MS = 10_000;
function liveSend(game, room, build) {
  for (const p of room.players) {
    const sock = ioServer?.sockets.sockets.get(p.id);
    const la = sock?.data.la;
    if (!la || la.game !== game || la.code !== room.code || sock.data.active !== false) continue;
    const opp = room.players.find((x) => x !== p);
    const out = build(p, opp, la.s);
    if (!out) continue;
    const key = JSON.stringify(out.props);
    // alert only when the turn comes over while away (null = just went to the background, state unknown)
    const alert = out.yourTurn && la.wasMyTurn === false ? { title: la.s.game, body: la.s.yourTurn } : null;
    la.wasMyTurn = out.yourTurn;
    if (key === la.last) continue;
    la.last = key;
    pushLive(la.token, out.props, { alert, staleAt: out.props.endsAt ? out.props.endsAt - LIVE_STALE_MS : 0 });
  }
}
const str = (v, max = 60) => (typeof v === "string" ? v.slice(0, max) : "");
/** the strings a phone sends with its token, cleaned */
function liveStrings(s) {
  const keys = ["game", "icon", "you", "yourTurn", "theirTurn", "won", "lost", "draw", "pick", "waiting", "winRound", "loseRound", "drawRound", "round"];
  const out = {};
  for (const k of keys) out[k] = str(s?.[k]);
  return out;
}
const sec = (ms) => Math.round(ms / 1000) * 1000;

/** Tic-Tac-Toe and Possession: whose turn, the mover's clock, the score */
function liveTurnProps(p, opp, s, { turn, winner, matchOver, score, endsAt, since }) {
  const nick = opp?.nick || "…";
  const props = {
    game: s.game,
    icon: s.icon,
    headline: winner ? (winner === "draw" ? s.draw : winner === p.mark ? s.won : s.lost) : turn === p.mark ? s.yourTurn : s.theirTurn.replace("{nick}", nick),
    tone: winner ? (winner === "draw" ? "draw" : winner === p.mark ? "win" : "lose") : turn,
    line: `${s.you} – ${nick}`,
    score,
    mark: p.mark,
    endsAt: winner ? 0 : sec(endsAt),
    since: winner ? 0 : sec(since),
    phase: !winner ? "turn" : matchOver ? "over" : "pause",
  };
  return { props, yourTurn: !winner && turn === p.mark };
}

function liveHt(room) {
  if (!room.started) return;
  const series = htSeries(room);
  liveSend("ht", room, (p, opp, s) =>
    liveTurnProps(p, opp, s, {
      turn: room.turn,
      winner: room.winner,
      matchOver: series.over,
      score: `X ${series.X} – ${series.O} O`,
      endsAt: room.deadline ?? 0,
      since: (room.deadline ?? 0) - htTurnMs(room),
    })
  );
}

function livePp(room) {
  if (!room.started) return;
  const held = (m) => room.owners.filter((o) => o?.mark === m).length;
  liveSend("pp", room, (p, opp, s) =>
    liveTurnProps(p, opp, s, {
      turn: room.turn,
      winner: room.winner,
      matchOver: true,
      score: `X ${held("X")} – ${held("O")} O`,
      endsAt: room.turnStart ? room.turnStart + room.clocks[room.turn] : 0,
      since: room.turnStart ?? 0,
    })
  );
}

function liveDz(room) {
  if (!room.started) return;
  const { score } = dzPublic(room);
  const last = room.results[room.results.length - 1];
  liveSend("dz", room, (p, opp, s) => {
    const me = p.side;
    const mine = score[me];
    const theirs = score[1 - me];
    const picked = room.picks[me] !== null;
    const open = !!room.deadline && !room.over;
    const res = last ? (last.winner === "draw" ? "draw" : last.winner === me ? "win" : "lose") : "draw";
    const props = {
      game: s.game,
      icon: s.icon,
      headline: room.over
        ? mine === theirs ? s.draw : mine > theirs ? s.won : s.lost
        : open ? (picked ? s.waiting : s.pick) : res === "win" ? s.winRound : res === "lose" ? s.loseRound : s.drawRound,
      tone: room.over ? (mine === theirs ? "draw" : mine > theirs ? "win" : "lose") : open ? (picked ? "O" : "X") : res,
      line: `${s.round.replace("{n}", String(Math.min(DZ_HAND, room.round + (open ? 1 : 0)) || 1)).replace("{max}", String(DZ_HAND))} · ${s.you} – ${opp?.nick || "…"}`,
      score: `${mine} – ${theirs}`,
      mark: "",
      endsAt: open ? sec(room.deadline) : 0,
      since: open ? sec(room.deadline - DZ_PICK_MS) : 0,
      phase: room.over ? "over" : open ? "turn" : "pause",
    };
    // a new round to pick in counts as "your turn"
    return { props, yourTurn: open && !picked };
  });
}

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    // /api/account/*: sign-in and the account's XP (server-accounts.js); the rest is the Next site
    if (req.url.startsWith("/api/account") && (await handleAccountApi(req, res, cleanNick))) return;
    // /api/app/*: minimum app version, anonymous crash reports (server-app.js)
    if (req.url.startsWith("/api/app/") && (await handleAppApi(req, res))) return;
    handle(req, res);
  });
  // small payload cap: the biggest message is a 20-question quiz (a few KB)
  // A phone that drops out (tunnel, app in the background) and comes back within REJOIN_MS gets
  // its old socket id, rooms and socket.data back plus the events it missed (Socket.IO connection
  // state recovery); live Tic-Tac-Toe / Possession / Card Duel matches wait that long before the
  // seat counts as left (`dropLater` below).
  const io = new Server(server, {
    cors: { origin: "*" },
    maxHttpBufferSize: 64 * 1024,
    connectionStateRecovery: { maxDisconnectionDuration: REJOIN_MS, skipMiddlewares: true },
    // notice a phone that vanished (no clean close through the proxy) within ~20 s, not 45
    pingInterval: 10_000,
    pingTimeout: 10_000,
  });
  // socket id + game → the timer that will count a dropped player as gone
  const awayTimers = new Map();
  // socket id → socket.data of a phone that dropped out of a live match (for a takeover, below)
  const awayData = new Map();
  ioServer = io;
  // a signed-in user is "online" for friends while any of their sockets is open
  const socketsOf = (uid) => [...io.sockets.sockets.values()].filter((s) => uid && s.data.uid === uid);
  setPresence((uid) => socketsOf(uid).length > 0);
  // someone added you by your code: your open app says so
  setFriendAdded((uid, from) => {
    for (const s of socketsOf(uid)) s.emit("fr:added", { from });
  });

  // pair waiting players as their allowed rank gap widens with time
  const matchQueues = () => {
    // the older player's grid is used: the other phone must be able to draw it
    const ht = takePairs(htQueue, (a, b) => a.league === b.league && canDraw(b.socket, a.grid));
    htQueue = ht.rest;
    for (const [a, b] of ht.pairs) a.pair(a, b);
    const pp = takePairs(ppQueue);
    ppQueue = pp.rest;
    for (const [a, b] of pp.pairs) a.pair(a, b);
    const dz = takePairs(dzQueue);
    dzQueue = dz.rest;
    for (const [a, b] of dz.pairs) a.pair(a, b);
    const rd = takePairs(rdQueue);
    rdQueue = rd.rest;
    for (const [a, b] of rd.pairs) a.pair(a, b);
  };
  setInterval(matchQueues, 1000).unref();

  // Rooms nobody is connected to any more are cleared once a minute, timers included
  const alive = (id) => io.sockets.sockets.has(id);
  setInterval(() => {
    for (const map of [rooms, htRooms, ppRooms, dzRooms, rdRooms]) {
      for (const [code, room] of map) {
        if (room.players.some((p) => alive(p.id))) continue;
        clearTimeout(room.timer);
        map.delete(code);
      }
    }
    for (const [code, room] of qzRooms) {
      if (room.players.some((p) => !p.bot && alive(p.id))) continue;
      clearTimeout(room.timer);
      room.botTimers.forEach(clearTimeout);
      qzRooms.delete(code);
      for (const d of Object.keys(qzOpen)) if (qzOpen[d] === code) qzOpen[d] = null;
    }
  }, 60_000).unref();

  /** A room this socket opened and is still alone in: dropped when it opens another */
  const dropLoneRoom = (map, code, socket) => {
    const room = map.get(code);
    if (!room || room.players.length !== 1 || room.players[0].id !== socket.id) return;
    clearTimeout(room.timer);
    map.delete(code);
  };

  // Pitch Chess online lobbies (server-taktik.js): handlers added per socket below
  const taktikSocket = attachTaktik(io, { cleanNick, houseNick: qzNick, cleanLook });

  io.on("connection", (socket) => {
    // Every handler is guarded: a missing or odd payload is answered with nothing, never
    // a thrown error, and a socket that floods events (over 60 in 5 s) is dropped.
    const on = socket.on.bind(socket);
    let burst = 0;
    let burstFrom = Date.now();
    socket.on = (event, fn) =>
      on(event, (...args) => {
        try {
          if (event === "disconnect") return fn(...args);
          if (Date.now() - burstFrom > 5000) {
            burst = 0;
            burstFrom = Date.now();
          }
          if (++burst > 60) return socket.disconnect(true);
          // (payload, ack): a payload that isn't an object reads as {}, an ack only if it's a function
          const payload = args[0] !== null && typeof args[0] === "object" ? args[0] : {};
          const ack = typeof args[args.length - 1] === "function" ? args[args.length - 1] : undefined;
          fn(payload, ack);
        } catch (e) {
          console.error(`socket ${event}:`, e?.message);
        }
      });
    // signed-in app players send their session token: their online results are rated
    socket.data.uid = userIdFromToken(socket.handshake.auth?.token);
    // older apps send no install id: a ref for this connection only (reportable, blockable for the session)
    socket.data.ref ??= refForSocket(socket.data.uid, socket.handshake.auth?.pid) ?? crypto.randomBytes(8).toString("hex");
    refById.set(socket.id, socket.data.ref);
    socket.data.blocks ??= cleanBlocks(socket.handshake.auth?.blocks);
    socket.on("disconnect", () => setTimeout(() => !io.sockets.sockets.has(socket.id) && refById.delete(socket.id), REJOIN_MS + 5000));
    // the phone's block list (refs) changed: matchmaking and invites skip those players
    socket.on("blk:set", ({ refs }) => {
      socket.data.blocks = cleanBlocks(refs);
    });
    // report a player (their nickname, cheating, other): one every 5 s
    socket.on("rep:send", (p, cb) => {
      if (Date.now() - (socket.data.lastReport ?? 0) < 5000) return cb?.({ ok: false, error: "slow" });
      socket.data.lastReport = Date.now();
      cb?.({ ok: addReport(socket.data.ref, p) });
    });

    // Losing the connection in a live match: the other player hears "away" and the seat waits
    // REJOIN_MS for this phone to come back (recovered socket, below) before `drop` runs. Leaving on
    // purpose (the app closing its socket) or outside a live match drops at once.
    const dropLater = (game, live, drop) => (reason) => {
      const code = socket.data[game + "Code"];
      if (!code || !live() || reason === "client namespace disconnect" || reason === "server namespace disconnect") return drop();
      const key = socket.id + game;
      clearTimeout(awayTimers.get(key));
      awayData.set(socket.id, socket.data);
      io.to(game + ":" + code).emit("peer:away", { game, away: true, ms: REJOIN_MS });
      awayTimers.set(
        key,
        setTimeout(() => {
          awayTimers.delete(key);
          if (![...awayTimers.keys()].some((k) => k.startsWith(socket.id))) awayData.delete(socket.id);
          drop();
        }, REJOIN_MS)
      );
    };
    // Invite a friend into a room you opened: the friend's open app shows a banner
    // with Join. Only between friends (friend codes), at most one every 3 s.
    socket.on("fr:invite", ({ to, game, room }, cb) => {
      const uid = socket.data.uid;
      const open =
        game === "ht" ? htRooms.has(String(room).toUpperCase()) : game === "tt" ? ttRooms.get(String(room).toUpperCase())?.phase === "lobby" : game === "rd" ? rdRooms.get(String(room).toUpperCase())?.started === false : false;
      if (!uid || typeof room !== "string" || !open) return cb?.({ ok: false });
      if (Date.now() - (socket.data.lastInvite ?? 0) < 3000) return cb?.({ ok: false, error: "slow" });
      const friend = friendIdByCode(uid, to);
      if (!friend) return cb?.({ ok: false, error: "not_friend" });
      const targets = socketsOf(friend);
      if (!targets.length) return cb?.({ ok: false, error: "offline" });
      socket.data.lastInvite = Date.now();
      const from = inviteCard(uid);
      for (const s of targets) if (!s.data.blocks?.has(socket.data.ref)) s.emit("fr:invited", { from, game, room: room.toUpperCase() });
      cb?.({ ok: true });
    });

    taktikSocket(socket);

    // app features this phone knows (older apps send none): "mate" / "coach" = "played with" / "managed by" grid criteria
    socket.data.caps = Array.isArray(socket.handshake.auth?.caps) ? socket.handshake.auth.caps.filter((c) => typeof c === "string").slice(0, 8) : [];
    let joinedCode = null;

    socket.on("room:create", ({ nick, difficulty, matchId }, cb) => {
      dropLoneRoom(rooms, joinedCode, socket);
      const code = makeCode();
      const room = {
        code,
        difficulty: difficulty === "hard" ? "hard" : "normal",
        matchId: typeof matchId === "string" || Number.isInteger(matchId) ? String(matchId).slice(0, 40) : null,
        started: false,
        players: [
          {
            id: socket.id,
            nick: cleanNick(nick) || "Oyuncu 1",
            solved: 0,
            failed: 0,
            totalGuesses: 0,
            done: false,
            won: false,
            isHost: true,
          },
        ],
      };
      rooms.set(code, room);
      joinedCode = code;
      socket.join(code);
      cb?.({ ok: true, room: publicRoom(room) });
    });

    socket.on("room:join", ({ code, nick }, cb) => {
      const room = rooms.get(String(code || "").toUpperCase());
      if (!room) return cb?.({ ok: false, error: "not_found" });
      const existing = room.players.find((p) => p.id === socket.id);
      if (existing) {
        // Re-join after navigation: same socket, keep state as-is
        joinedCode = room.code;
        socket.join(room.code);
        return cb?.({ ok: true, room: publicRoom(room) });
      }
      if (room.players.length >= 2) return cb?.({ ok: false, error: "full" });
      room.players.push({
        id: socket.id,
        nick: cleanNick(nick) || "Oyuncu 2",
        solved: 0,
        failed: 0,
        totalGuesses: 0,
        done: false,
        won: false,
        isHost: false,
      });
      joinedCode = room.code;
      socket.join(room.code);
      io.to(room.code).emit("room:update", publicRoom(room));
      cb?.({ ok: true, room: publicRoom(room) });
    });

    socket.on("room:start", () => {
      const room = rooms.get(joinedCode);
      if (!room) return;
      const me = room.players.find((p) => p.id === socket.id);
      if (!me?.isHost || room.players.length < 2) return;
      room.started = true;
      io.to(room.code).emit("room:update", publicRoom(room));
    });

    socket.on("race:progress", ({ solved, failed, totalGuesses, done, won }) => {
      const room = rooms.get(joinedCode);
      if (!room || !room.started) return;
      const me = room.players.find((p) => p.id === socket.id);
      if (!me) return;
      me.solved = solved;
      me.failed = failed;
      me.totalGuesses = totalGuesses;
      me.done = done;
      me.won = won;

      // Race end: someone solved all 11, or both are done
      const fullSolve = room.players.find((p) => p.solved === 11);
      const allDone = room.players.length === 2 && room.players.every((p) => p.done);
      if (fullSolve || allDone) {
        let winnerId = null;
        if (fullSolve) {
          winnerId = fullSolve.id;
        } else {
          const [a, b] = room.players;
          if (a.solved !== b.solved) winnerId = a.solved > b.solved ? a.id : b.id;
          else if (a.totalGuesses !== b.totalGuesses)
            winnerId = a.totalGuesses < b.totalGuesses ? a.id : b.id;
          // equal → tie, winnerId stays null
        }
        io.to(room.code).emit("race:over", {
          winnerId,
          room: publicRoom(room),
        });
        rooms.delete(room.code);
      } else {
        io.to(room.code).emit("room:update", publicRoom(room));
      }
    });

    // ── Possession Play ──
    const ppEmit = (room) => {
      io.to("pp:" + room.code).emit("pp:update", ppPublic(room));
      livePp(room);
    };

    // Start the current player's clock; when it runs out they lose
    const ppStartTurn = (room) => {
      clearTimeout(room.timer);
      room.turnStart = Date.now();
      room.timer = setTimeout(() => {
        if (room.winner || !ppRooms.has(room.code)) return;
        room.clocks[room.turn] = 0;
        room.flash = { mark: room.turn, reason: "timeout" };
        room.winner = room.turn === "X" ? "O" : "X";
        room.turnStart = null;
        rateDuel("pp", room, room.winner);
        ppEmit(room);
      }, room.clocks[room.turn]);
    };

    const ppJoinRoom = (s, room) => {
      s.data.ppCode = room.code;
      s.join("pp:" + room.code);
    };

    socket.on("pp:create", ({ nick, board }, cb) => {
      if (!ppBoardOk(board)) return cb?.({ ok: false, error: "bad_board" });
      dropLoneRoom(ppRooms, socket.data.ppCode, socket);
      const room = ppNewRoom(ppCode(), board, [{ id: socket.id, uid: socket.data.uid, nick: cleanNick(nick), mark: "X" }]);
      ppRooms.set(room.code, room);
      ppJoinRoom(socket, room);
      cb?.({ ok: true, room: ppPublic(room) });
    });

    socket.on("pp:join", ({ code, nick }, cb) => {
      const room = ppRooms.get(String(code || "").toUpperCase());
      if (!room) return cb?.({ ok: false, error: "not_found" });
      if (!room.players.some((p) => p.id === socket.id)) {
        if (room.players.length >= 2) return cb?.({ ok: false, error: "full" });
        const mark = room.players[0]?.mark === "X" ? "O" : "X";
        room.players.push({ id: socket.id, uid: socket.data.uid, nick: cleanNick(nick), mark });
      }
      ppJoinRoom(socket, room);
      ppEmit(room);
      cb?.({ ok: true, room: ppPublic(room) });
    });

    socket.on("pp:start", () => {
      const room = ppRooms.get(socket.data.ppCode);
      if (!room || room.started || room.players.length < 2 || room.players[0].id !== socket.id) return;
      room.started = true;
      ppStartTurn(room);
      ppEmit(room);
    });

    // claims = hexes the named footballer takes (null name = wrong answer)
    socket.on("pp:move", ({ name, claims }) => {
      const room = ppRooms.get(socket.data.ppCode);
      if (!room || !room.started || room.winner) return;
      const me = room.players.find((p) => p.id === socket.id);
      if (!me || me.mark !== room.turn) return;
      room.clocks[me.mark] = Math.max(0, room.clocks[me.mark] - (Date.now() - room.turnStart));
      const player = nameOf(name);
      if (player) {
        const hexes = Array.isArray(claims) ? [...new Set(claims)].filter((i) => Number.isInteger(i) && i >= 0 && i < PP_HEXES) : [];
        // The first claim is the chosen hex and must be neutral; the rest must touch it; the name must be new
        const touching = hexes.slice(1).every((i) => PP_NEIGHBOURS[hexes[0]].includes(i));
        if (!hexes.length || hexes.length !== (claims?.length ?? 0) || !touching || room.owners[hexes[0]] || room.used.includes(player)) {
          return socket.emit("pp:update", ppPublic(room));
        }
        const stolen = hexes.filter((i) => room.owners[i] && room.owners[i].mark !== me.mark).length;
        for (const i of hexes) room.owners[i] = { mark: me.mark, name: player };
        room.used.push(player);
        room.flash = { mark: me.mark, reason: "claim", name: player, count: hexes.length, stolen };
        room.winner = ppResult(room.owners);
      } else {
        room.flash = { mark: me.mark, reason: "wrong" };
      }
      if (room.winner) {
        clearTimeout(room.timer);
        room.turnStart = null;
        rateDuel("pp", room, room.winner);
      } else {
        room.turn = room.turn === "X" ? "O" : "X";
        ppStartTurn(room);
      }
      ppEmit(room);
    });

    socket.on("pp:rematch", ({ board }) => {
      const room = ppRooms.get(socket.data.ppCode);
      if (!room || !room.winner || room.players[0].id !== socket.id || !ppBoardOk(board)) return;
      const players = room.players.map((p) => ({ ...p, mark: p.mark === "X" ? "O" : "X" }));
      Object.assign(room, ppNewRoom(room.code, board, players), { started: true });
      ppStartTurn(room);
      ppEmit(room);
    });

    const ppPair = (waiting, other) => {
      const room = ppNewRoom(ppCode(), waiting.board, [
        { id: waiting.socket.id, uid: waiting.socket.data.uid, nick: waiting.nick, mark: "X", tier: waiting.tier, ...waiting.look },
        { id: other.socket.id, uid: other.socket.data.uid, nick: other.nick, mark: "O", tier: other.tier, ...other.look },
      ]);
      room.started = true;
      ppRooms.set(room.code, room);
      ppJoinRoom(waiting.socket, room);
      ppJoinRoom(other.socket, room);
      ppStartTurn(room);
      const look = (p) => ({ id: p.id, ref: seatRef(p), nick: seatNick(p), tier: p.tier ?? null, avatar: p.avatar ?? null, frame: p.frame ?? null });
      io.to("pp:" + room.code).emit("pp:matched", { code: room.code, players: room.players.map(look) });
    };

    socket.on("pp:queue", ({ nick, board, tier, avatar, frame }) => {
      if (!ppBoardOk(board)) return;
      ppQueue = ppQueue.filter((w) => w.socket.id !== socket.id);
      ppQueue.push({ socket, nick: cleanNick(nick), board, tier: cleanTier(tier), look: cleanLook({ avatar, frame }, cleanTier(tier)), since: Date.now(), pair: ppPair });
      matchQueues();
    });

    socket.on("pp:unqueue", () => {
      ppQueue = ppQueue.filter((w) => w.socket.id !== socket.id);
    });

    const ppDrop = () => {
      ppQueue = ppQueue.filter((w) => w.socket.id !== socket.id);
      const room = ppRooms.get(socket.data.ppCode);
      if (!room) return;
      const leaver = room.players.find((p) => p.id === socket.id);
      if (leaver && room.started && !room.winner && room.players.length === 2) rateDuel("pp", room, leaver.mark === "X" ? "O" : "X");
      room.players = room.players.filter((p) => p.id !== socket.id);
      clearTimeout(room.timer);
      if (room.players.length === 0) {
        ppRooms.delete(room.code);
      } else {
        room.started = false;
        room.turnStart = null;
        io.to("pp:" + room.code).emit("pp:peer-left", ppPublic(room));
      }
    };
    socket.on("disconnect", (reason) => {
      ppQueue = ppQueue.filter((w) => w.socket.id !== socket.id);
      const room = ppRooms.get(socket.data.ppCode);
      dropLater("pp", () => !!room && room.started && !room.winner && room.players.length === 2, ppDrop)(reason);
    });

    // ── Rondo ──
    const rdEmit = (room) => io.to("rd:" + room.code).emit("rd:update", rdPublic(room));

    // the mover's clock: when it runs out they lose the round
    const rdStartTurn = (room, ms) => {
      clearTimeout(room.timer);
      room.turnMs = ms;
      room.deadline = Date.now() + ms;
      room.timer = setTimeout(() => rdRoundOver(room, room.turn === "X" ? "O" : "X", "timeout"), ms);
    };
    const rdRoundOver = (room, winnerMark, reason) => {
      if (!rdRooms.has(room.code) || room.winner || room.roundEnd) return;
      clearTimeout(room.timer);
      room.deadline = 0;
      room.score[winnerMark]++;
      room.roundEnd = { winner: winnerMark, reason };
      if (room.score[winnerMark] >= RD.RONDO_TARGET) {
        room.winner = winnerMark;
        rateDuel("rd", room, winnerMark);
        return rdEmit(room);
      }
      rdEmit(room);
      // next club; the other player starts it
      room.timer = setTimeout(() => {
        if (!rdRooms.has(room.code) || room.winner) return;
        room.round++;
        room.names = [];
        room.roundEnd = null;
        room.flash = null;
        room.turn = room.round % 2 ? "O" : "X";
        rdStartTurn(room, RD.RONDO_FIRST_TURN_MS);
        rdEmit(room);
      }, RD_ROUND_GAP_MS);
    };
    const rdBegin = (room) => {
      room.started = true;
      room.turn = "X";
      rdStartTurn(room, RD.RONDO_FIRST_TURN_MS);
      rdEmit(room);
    };
    const rdJoinRoom = (s, room) => {
      s.data.rdCode = room.code;
      s.join("rd:" + room.code);
    };

    socket.on("rd:create", ({ nick }, cb) => {
      if (!RD) return cb?.({ ok: false, error: "not_ready" });
      dropLoneRoom(rdRooms, socket.data.rdCode, socket);
      const room = rdNewRoom(rdCode(), [{ id: socket.id, uid: socket.data.uid, nick: cleanNick(nick), mark: "X" }]);
      rdRooms.set(room.code, room);
      rdJoinRoom(socket, room);
      cb?.({ ok: true, room: rdPublic(room) });
    });

    socket.on("rd:join", ({ code, nick }, cb) => {
      const room = rdRooms.get(String(code || "").toUpperCase());
      if (!room) return cb?.({ ok: false, error: "not_found" });
      if (!room.players.some((p) => p.id === socket.id)) {
        if (room.players.length >= 2) return cb?.({ ok: false, error: "full" });
        room.players.push({ id: socket.id, uid: socket.data.uid, nick: cleanNick(nick), mark: room.players[0]?.mark === "X" ? "O" : "X" });
      }
      rdJoinRoom(socket, room);
      rdEmit(room);
      cb?.({ ok: true, room: rdPublic(room) });
    });

    socket.on("rd:start", () => {
      const room = rdRooms.get(socket.data.rdCode);
      if (!room || room.started || room.players.length < 2 || room.players[0].id !== socket.id) return;
      rdBegin(room);
    });

    // a typed name: the server judges it; a wrong one only tells the mover (and costs time)
    socket.on("rd:answer", ({ name }) => {
      const room = rdRooms.get(socket.data.rdCode);
      if (!room || !room.started || room.winner || room.roundEnd) return;
      const me = room.players.find((p) => p.id === socket.id);
      const guess = nameOf(name);
      if (!me || me.mark !== room.turn || !guess) return;
      const v = RD.judgeRondo(guess, room.clubs[room.round], room.names.map((n) => n.name));
      if (!v.ok) return socket.emit("rd:wrong", { guess, reason: v.reason });
      room.names.push({ mark: me.mark, name: v.player.name });
      room.flash = { mark: me.mark, name: v.player.name };
      room.turn = room.turn === "X" ? "O" : "X";
      rdStartTurn(room, RD.RONDO_TURN_MS);
      rdEmit(room);
    });

    // +10 s on your own clock, once a match
    socket.on("rd:joker", ({ kind }) => {
      const room = rdRooms.get(socket.data.rdCode);
      const me = room?.players.find((p) => p.id === socket.id);
      if (!room || !me || kind !== "time" || !room.started || room.winner || room.roundEnd || room.turn !== me.mark || !(room.jokers[me.mark].time > 0)) return;
      room.jokers[me.mark].time--;
      rdStartTurn(room, Math.max(0, room.deadline - Date.now()) + 10_000);
      rdEmit(room);
    });

    socket.on("rd:forfeit", () => {
      const room = rdRooms.get(socket.data.rdCode);
      const me = room?.players.find((p) => p.id === socket.id);
      if (!room || !me || !room.started || room.winner || room.players.length < 2) return;
      clearTimeout(room.timer);
      room.deadline = 0;
      room.winner = me.mark === "X" ? "O" : "X";
      room.roundEnd = { winner: room.winner, reason: "forfeit" };
      rateDuel("rd", room, room.winner);
      rdEmit(room);
    });

    socket.on("rd:rematch", () => {
      const room = rdRooms.get(socket.data.rdCode);
      if (!room || !room.winner || room.players.length < 2 || room.players[0].id !== socket.id) return;
      const players = room.players.map((p) => ({ ...p, mark: p.mark === "X" ? "O" : "X" }));
      Object.assign(room, rdNewRoom(room.code, players));
      rdBegin(room);
    });

    const rdPair = (waiting, other) => {
      const room = rdNewRoom(rdCode(), [
        { id: waiting.socket.id, uid: waiting.socket.data.uid, nick: waiting.nick, mark: "X", tier: waiting.tier, ...waiting.look },
        { id: other.socket.id, uid: other.socket.data.uid, nick: other.nick, mark: "O", tier: other.tier, ...other.look },
      ]);
      rdRooms.set(room.code, room);
      rdJoinRoom(waiting.socket, room);
      rdJoinRoom(other.socket, room);
      io.to("rd:" + room.code).emit("rd:matched", { code: room.code, players: rdPublic(room).players });
      // the VS intro first, then the first club
      setTimeout(() => rdRooms.has(room.code) && !room.started && room.players.length === 2 && rdBegin(room), HT_INTRO_MS);
    };

    socket.on("rd:queue", ({ nick, tier, avatar, frame }) => {
      if (!RD) return;
      rdQueue = rdQueue.filter((w) => w.socket.id !== socket.id);
      rdQueue.push({ socket, nick: cleanNick(nick), tier: cleanTier(tier), look: cleanLook({ avatar, frame }, cleanTier(tier)), since: Date.now(), pair: rdPair });
      matchQueues();
    });
    socket.on("rd:unqueue", () => {
      rdQueue = rdQueue.filter((w) => w.socket.id !== socket.id);
    });

    const rdDrop = () => {
      rdQueue = rdQueue.filter((w) => w.socket.id !== socket.id);
      const room = rdRooms.get(socket.data.rdCode);
      if (!room) return;
      socket.data.rdCode = null;
      socket.leave("rd:" + room.code);
      const leaver = room.players.find((p) => p.id === socket.id);
      if (leaver && room.started && !room.winner && room.players.length === 2) rateDuel("rd", room, leaver.mark === "X" ? "O" : "X");
      room.players = room.players.filter((p) => p.id !== socket.id);
      clearTimeout(room.timer);
      if (room.players.length === 0) rdRooms.delete(room.code);
      else {
        room.started = false;
        room.deadline = 0;
        io.to("rd:" + room.code).emit("rd:peer-left", rdPublic(room));
      }
    };
    socket.on("rd:leave", rdDrop);
    socket.on("disconnect", (reason) => {
      rdQueue = rdQueue.filter((w) => w.socket.id !== socket.id);
      const room = rdRooms.get(socket.data.rdCode);
      dropLater("rd", () => !!room && room.started && !room.winner && room.players.length === 2, rdDrop)(reason);
    });

    // ── Live Activity: the token of this phone's activity for the match it's in, and whether the app is open
    socket.on("la:token", ({ game, token, s }) => {
      if (!["ht", "pp", "dz"].includes(game) || typeof token !== "string" || token.length > 200) return;
      const code = game === "ht" ? socket.data.htCode : game === "pp" ? socket.data.ppCode : socket.data.dzCode;
      if (!code) return;
      socket.data.la = { game, code, token, s: liveStrings(s), last: null, wasMyTurn: false };
    });
    socket.on("la:clear", () => {
      socket.data.la = null;
    });
    socket.on("app:state", ({ active }) => {
      socket.data.active = active !== false;
      // each background spell starts fresh: push the current state, alert only on later turns
      const la = socket.data.la;
      if (la) {
        la.last = null;
        la.wasMyTurn = null;
        // going away: push the current state now, so a turn that comes later is seen as new
        if (!socket.data.active) {
          if (la.game === "ht" && htRooms.has(la.code)) liveHt(htRooms.get(la.code));
          if (la.game === "pp" && ppRooms.has(la.code)) livePp(ppRooms.get(la.code));
          if (la.game === "dz" && dzRooms.has(la.code)) liveDz(dzRooms.get(la.code));
        }
      }
    });

    // ── Quick emotes: a fixed set (no free text), to the other player in the game you're in ──
    const EMOTES = new Set(["clap", "wow", "laugh", "fire", "gg", "think", "cry", "cool"]);
    socket.on("em:send", ({ game, emote }) => {
      if (!EMOTES.has(emote) || Date.now() - (socket.data.lastEmote ?? 0) < 1500) return;
      const code = game === "ht" ? socket.data.htCode : game === "pp" ? socket.data.ppCode : game === "dz" ? socket.data.dzCode : game === "rd" ? socket.data.rdCode : null;
      if (!code) return;
      socket.data.lastEmote = Date.now();
      socket.to(game + ":" + code).emit("em:recv", { game, emote });
    });

    // ── Card Duel ──
    const dzEmit = (room) => {
      io.to("dz:" + room.code).emit("dz:update", dzPublic(room));
      liveDz(room);
    };

    const dzJoinRoom = (s, room) => {
      s.data.dzCode = room.code;
      s.join("dz:" + room.code);
    };

    const dzRate = (room) => {
      if (room.rated || room.players.length < 2) return;
      room.rated = true;
      const { score } = dzPublic(room);
      const [a, b] = [room.players.find((p) => p.side === 0), room.players.find((p) => p.side === 1)];
      if (!a?.uid || !b?.uid) return;
      if (score[0] === score[1]) recordResult("dz", [[a.uid, b.uid]]);
      else recordResult("dz", score[0] > score[1] ? [[a.uid], [b.uid]] : [[b.uid], [a.uid]]);
    };

    // Open a round: the question and a fresh clock; a missing pick plays a random unused card
    const dzOpenRound = (room, graceMs = 0) => {
      clearTimeout(room.timer);
      room.picks = [null, null];
      room.deadline = Date.now() + DZ_PICK_MS + graceMs;
      room.timer = setTimeout(() => {
        if (!dzRooms.has(room.code) || room.over) return;
        for (const side of [0, 1]) {
          if (room.picks[side] !== null) continue;
          const p = room.players.find((x) => x.side === side);
          const left = (p?.hand ?? []).filter((id) => !room.results.some((r) => r.cards[side] === id));
          room.picks[side] = left[Math.floor(Math.random() * left.length)] ?? null;
        }
        dzResolve(room);
      }, DZ_PICK_MS + graceMs);
    };

    const dzResolve = (room) => {
      clearTimeout(room.timer);
      const q = room.questions[room.round];
      const [a, b] = room.picks;
      room.results.push({ question: q, cards: [a, b], winner: dzJudge(q, a, b) });
      room.round++;
      room.deadline = 0;
      if (room.round >= DZ_HAND) {
        room.over = true;
        dzRate(room);
        return dzEmit(room);
      }
      dzEmit(room);
      // both cards stay up for a moment, then the next question
      room.timer = setTimeout(() => {
        if (!dzRooms.has(room.code) || room.over) return;
        dzOpenRound(room);
        dzEmit(room);
      }, DZ_REVEAL_MS);
    };

    const dzStart = (room, graceMs = 0) => {
      Object.assign(room, { started: true, questions: dzQuestions(), round: 0, results: [], over: false, rated: false, game: (room.game ?? 0) + 1 });
      dzOpenRound(room, graceMs);
      dzEmit(room);
    };

    socket.on("dz:create", ({ nick, hand }, cb) => {
      if (!dzHandOk(hand)) return cb?.({ ok: false, error: "bad_hand" });
      dropLoneRoom(dzRooms, socket.data.dzCode, socket);
      const room = dzNewRoom(dzCode(), [{ id: socket.id, uid: socket.data.uid, nick: cleanNick(nick), side: 0, hand }]);
      dzRooms.set(room.code, room);
      dzJoinRoom(socket, room);
      cb?.({ ok: true, room: dzPublic(room) });
    });

    socket.on("dz:join", ({ code, nick, hand }, cb) => {
      const room = dzRooms.get(String(code || "").toUpperCase());
      if (!room) return cb?.({ ok: false, error: "not_found" });
      if (!room.players.some((p) => p.id === socket.id)) {
        if (room.players.length >= 2) return cb?.({ ok: false, error: "full" });
        if (!dzHandOk(hand)) return cb?.({ ok: false, error: "bad_hand" });
        const side = room.players[0]?.side === 0 ? 1 : 0;
        room.players.push({ id: socket.id, uid: socket.data.uid, nick: cleanNick(nick), side, hand });
      }
      dzJoinRoom(socket, room);
      dzEmit(room);
      cb?.({ ok: true, room: dzPublic(room) });
    });

    socket.on("dz:start", () => {
      const room = dzRooms.get(socket.data.dzCode);
      if (!room || room.started || room.players.length < 2 || room.players[0].id !== socket.id) return;
      dzStart(room);
    });

    socket.on("dz:pick", ({ card }) => {
      const room = dzRooms.get(socket.data.dzCode);
      if (!room || !room.started || room.over || !room.deadline) return;
      const me = room.players.find((p) => p.id === socket.id);
      if (!me || room.picks[me.side] !== null || !me.hand.includes(card)) return;
      if (room.results.some((r) => r.cards[me.side] === card)) return;
      room.picks[me.side] = card;
      if (room.picks.every((p) => p !== null)) dzResolve(room);
      else dzEmit(room);
    });

    // same hands, new questions; either player may ask once the match is over
    socket.on("dz:rematch", () => {
      const room = dzRooms.get(socket.data.dzCode);
      if (!room || !room.over || room.players.length < 2 || !room.players.some((p) => p.id === socket.id)) return;
      dzStart(room);
    });

    const dzPair = (waiting, other) => {
      const room = dzNewRoom(dzCode(), [
        { id: waiting.socket.id, uid: waiting.socket.data.uid, nick: waiting.nick, side: 0, hand: waiting.hand, tier: waiting.tier, ...waiting.look },
        { id: other.socket.id, uid: other.socket.data.uid, nick: other.nick, side: 1, hand: other.hand, tier: other.tier, ...other.look },
      ]);
      dzRooms.set(room.code, room);
      dzJoinRoom(waiting.socket, room);
      dzJoinRoom(other.socket, room);
      io.to("dz:" + room.code).emit("dz:matched", { code: room.code, players: dzPublic(room).players });
      dzStart(room, DZ_INTRO_MS);
    };

    socket.on("dz:queue", ({ nick, hand, tier, avatar, frame }) => {
      if (!dzHandOk(hand)) return;
      dzQueue = dzQueue.filter((w) => w.socket.id !== socket.id);
      dzQueue.push({ socket, nick: cleanNick(nick), hand, tier: cleanTier(tier), look: cleanLook({ avatar, frame }, cleanTier(tier)), since: Date.now(), pair: dzPair });
      matchQueues();
    });

    socket.on("dz:unqueue", () => {
      dzQueue = dzQueue.filter((w) => w.socket.id !== socket.id);
    });

    const dzLeave = () => {
      dzQueue = dzQueue.filter((w) => w.socket.id !== socket.id);
      const room = dzRooms.get(socket.data.dzCode);
      if (!room) return;
      socket.data.dzCode = null;
      socket.leave("dz:" + room.code);
      const leaver = room.players.find((p) => p.id === socket.id);
      // leaving a live match counts as a loss
      if (leaver && room.started && !room.over && room.players.length === 2 && !room.rated) {
        const stay = room.players.find((p) => p !== leaver);
        room.rated = true;
        if (leaver.uid && stay?.uid) recordResult("dz", [[stay.uid], [leaver.uid]]);
      }
      room.players = room.players.filter((p) => p.id !== socket.id);
      clearTimeout(room.timer);
      if (room.players.length === 0) dzRooms.delete(room.code);
      else {
        room.started = false;
        room.deadline = 0;
        io.to("dz:" + room.code).emit("dz:peer-left", dzPublic(room));
      }
    };
    // a screen that opens after the match started asks for the current state
    socket.on("dz:sync", () => {
      const room = dzRooms.get(socket.data.dzCode);
      if (room) socket.emit("dz:update", dzPublic(room));
    });
    socket.on("dz:leave", dzLeave);
    socket.on("disconnect", (reason) => {
      dzQueue = dzQueue.filter((w) => w.socket.id !== socket.id);
      const room = dzRooms.get(socket.data.dzCode);
      dropLater("dz", () => !!room && room.started && !room.over && room.players.length === 2, dzLeave)(reason);
    });

    // Coming back to a live match. Either Socket.IO recovered the session (same socket id, rooms and
    // data), or (the usual case behind Fly's proxy) the phone is back before the server noticed the
    // old connection die, so it arrives as a new socket: then it names its old socket id (`prev`) and
    // proves it with the random key it sent on that one (`rk`, never shown to anyone else), and takes
    // its seats over. Either way the drop is cancelled, the other player hears it's back, and both get
    // the match as it is now.
    const rk = typeof socket.handshake.auth?.rk === "string" && /^[A-Za-z0-9]{16,40}$/.test(socket.handshake.auth.rk) ? socket.handshake.auth.rk : null;
    socket.data.rk ??= rk;
    const views = { ht: [htRooms, htPublic], pp: [ppRooms, ppPublic], dz: [dzRooms, dzPublic], rd: [rdRooms, rdPublic] };
    const welcomeBack = (prevId, data) => {
      let back = false;
      for (const [game, [map, view]] of Object.entries(views)) {
        const room = map.get(data[game + "Code"]);
        const seat = room?.players.find((p) => p.id === prevId);
        if (!seat) continue;
        clearTimeout(awayTimers.get(prevId + game));
        awayTimers.delete(prevId + game);
        if (prevId !== socket.id) {
          seat.id = socket.id;
          socket.data[game + "Code"] = room.code;
          socket.join(game + ":" + room.code);
        }
        socket.to(game + ":" + room.code).emit("peer:away", { game, away: false });
        io.to(game + ":" + room.code).emit(game + ":update", view(room));
        back = true;
      }
      awayData.delete(prevId);
      if (back) socket.emit("seat:back");
    };
    const prev = socket.handshake.auth?.prev;
    if (socket.recovered) welcomeBack(socket.id, socket.data);
    else if (rk && typeof prev === "string" && prev !== socket.id) {
      const old = io.sockets.sockets.get(prev);
      const data = old ? old.data : awayData.get(prev);
      if (data && data.rk === rk) {
        if (data.la) socket.data.la = data.la;
        welcomeBack(prev, data);
        if (old) {
          // the old connection is a ghost now: it must not leave the rooms it handed over
          old.data.htCode = old.data.ppCode = old.data.dzCode = old.data.rdCode = null;
          old.disconnect(true);
        }
      }
    }

    // ── Hat-trick ──

    const htEmit = (room) => {
      io.to("ht:" + room.code).emit("ht:update", htPublic(room));
      liveHt(room);
    };

    // `graceMs` adds time before the first turn's clock (the "match found" intro)
    const htStartTurn = (room, graceMs = 0) => htArm(room, htTurnMs(room) + graceMs, htTurnMs(room));
    /** the mover's clock runs `ms` from now; at zero the turn passes */
    const htArm = (room, ms, len = Math.max(ms, htTurnMs(room))) => {
      clearTimeout(room.timer);
      room.deadline = Date.now() + ms;
      // the clock bar's full length (a time joker makes this turn longer)
      room.turnLen = len;
      room.timer = setTimeout(() => {
        if (room.winner || !htRooms.has(room.code)) return;
        room.flash = { mark: room.turn, reason: "timeout" };
        room.turn = room.turn === "X" ? "O" : "X";
        htStartTurn(room);
        htEmit(room);
      }, ms);
    };

    // A joker on your turn: "time" adds 15 s to your clock; "hint" is shown on your own phone
    // (the server only counts it, and tells the other player it was used)
    socket.on("ht:joker", ({ kind }) => {
      const room = htRooms.get(socket.data.htCode);
      const me = room?.players.find((p) => p.id === socket.id);
      if (!room || !me || !room.started || room.winner || room.turn !== me.mark) return;
      const left = htJokers(room)[me.mark];
      if (!(kind in HT_JOKERS) || left[kind] <= 0) return;
      left[kind]--;
      if (kind === "time") htArm(room, Math.max(0, room.deadline - Date.now()) + HT_JOKER_TIME_MS);
      room.flash = { mark: me.mark, reason: "joker", joker: kind };
      htEmit(room);
    });

    socket.on("ht:create", ({ nick, grid, steals, league }, cb) => {
      if (!htGridOk(grid)) return cb?.({ ok: false, error: "bad_grid" });
      dropLoneRoom(htRooms, socket.data.htCode, socket);
      const code = htCode();
      const room = {
        code,
        grid,
        started: false,
        board: Array(9).fill(null),
        turn: "X",
        winner: null,
        flash: null,
        deadline: null,
        timer: null,
        // steal mode: 3 steals each, or null when off
        steals: steals ? { X: 3, O: 3 } : null,
        league: typeof league === "string" ? league.slice(0, 12) : "all",
        used: [],
        players: [{ id: socket.id, uid: socket.data.uid, nick: cleanNick(nick), mark: "X" }],
      };
      htRooms.set(code, room);
      socket.data.htCode = code;
      socket.join("ht:" + code);
      cb?.({ ok: true, room: htPublic(room) });
    });

    socket.on("ht:join", ({ code, nick }, cb) => {
      const room = htRooms.get(String(code || "").toUpperCase());
      if (!room) return cb?.({ ok: false, error: "not_found" });
      if (!room.players.some((p) => p.id === socket.id)) {
        if (room.players.length >= 2) return cb?.({ ok: false, error: "full" });
        if (!canDraw(socket, room.grid)) return cb?.({ ok: false, error: "update_app" });
        const mark = room.players[0]?.mark === "X" ? "O" : "X";
        room.players.push({ id: socket.id, uid: socket.data.uid, nick: cleanNick(nick), mark });
      }
      socket.data.htCode = room.code;
      socket.join("ht:" + room.code);
      htEmit(room);
      cb?.({ ok: true, room: htPublic(room) });
    });

    // Random opponent: two waiting players of the same league (and, at first, the
    // same rank) are paired. The older one's phone already dealt the grid; the room starts at once.
    const htPair = (waiting, other) => {
      const code = htCode();
      const room = {
        code,
        grid: waiting.grid,
        league: waiting.league,
        started: true,
        board: Array(9).fill(null),
        turn: "X",
        winner: null,
        flash: null,
        deadline: null,
        timer: null,
        steals: null,
        used: [],
        players: [
          { id: waiting.socket.id, uid: waiting.socket.data.uid, nick: waiting.nick, mark: "X", tier: waiting.tier, ...waiting.look },
          { id: other.socket.id, uid: other.socket.data.uid, nick: other.nick, mark: "O", tier: other.tier, ...other.look },
        ],
      };
      htRooms.set(code, room);
      for (const s of [waiting.socket, other.socket]) {
        s.data.htCode = code;
        s.join("ht:" + code);
      }
      htStartTurn(room, HT_INTRO_MS);
      io.to("ht:" + code).emit("ht:matched", { code, players: htPublic(room).players });
    };

    socket.on("ht:queue", ({ nick, grid, league, tier, avatar, frame }) => {
      if (!htGridOk(grid)) return;
      const lg = typeof league === "string" ? league.slice(0, 12) : "all";
      htQueue = htQueue.filter((w) => w.socket.id !== socket.id);
      htQueue.push({ socket, nick: cleanNick(nick), grid, league: lg, tier: cleanTier(tier), look: cleanLook({ avatar, frame }, cleanTier(tier)), since: Date.now(), pair: htPair });
      matchQueues();
    });

    socket.on("ht:unqueue", () => {
      htQueue = htQueue.filter((w) => w.socket.id !== socket.id);
    });

    socket.on("ht:start", () => {
      const room = htRooms.get(socket.data.htCode);
      if (!room || room.started || room.players.length < 2 || room.players[0].id !== socket.id) return;
      room.started = true;
      htStartTurn(room);
      htEmit(room);
    });

    // name = validated player name, or null for a wrong guess (turn passes)
    socket.on("ht:move", ({ cell, name }) => {
      const room = htRooms.get(socket.data.htCode);
      if (!room || !room.started || room.winner) return;
      const me = room.players.find((p) => p.id === socket.id);
      if (!me || me.mark !== room.turn) return;
      const player = nameOf(name);
      if (player) {
        const i = Number.isInteger(cell) ? cell : -1;
        const taken = i >= 0 && i < 9 ? room.board[i] : null;
        // A taken square is only allowed as a steal of the opponent's square
        const steal = !!taken && !!room.steals && taken.mark !== me.mark && room.steals[me.mark] > 0;
        // Bad square or a name already on the board: resync the sender only
        if (!(i >= 0 && i < 9) || (taken && !steal) || room.used.includes(player)) {
          return socket.emit("ht:update", htPublic(room));
        }
        if (steal) room.steals[me.mark]--;
        room.board[i] = { mark: me.mark, name: player };
        room.used.push(room.board[i].name);
        room.flash = null;
        room.winner = htResult(room.board);
      } else {
        room.flash = { mark: me.mark, reason: "wrong" };
      }
      room.drawOffer = null;
      if (room.winner) {
        clearTimeout(room.timer);
        room.deadline = null;
        htTally(room);
        htRateSeries(room);
      } else {
        room.turn = room.turn === "X" ? "O" : "X";
        htStartTurn(room);
      }
      htEmit(room);
    });

    const htEnd = (room, winner, endReason) => {
      clearTimeout(room.timer);
      room.deadline = null;
      room.winner = winner;
      room.endReason = endReason;
      room.drawOffer = null;
      if (endReason === "forfeit") {
        // giving up concedes the whole series
        const p = room.players.find((x) => x.mark === winner);
        if (p) room.wins = { ...room.wins, [p.id]: HT_TARGET };
      } else htTally(room);
      htRateSeries(room);
      htEmit(room);
    };

    // Pass: the turn goes to the opponent with a fresh clock
    socket.on("ht:skip", () => {
      const room = htRooms.get(socket.data.htCode);
      const me = room?.players.find((p) => p.id === socket.id);
      if (!room || !me || !room.started || room.winner || room.turn !== me.mark) return;
      room.flash = { mark: me.mark, reason: "skip" };
      room.drawOffer = null;
      room.turn = room.turn === "X" ? "O" : "X";
      htStartTurn(room);
      htEmit(room);
    });

    // Either player can offer a draw once it's pending-free; the other accepts or declines
    socket.on("ht:draw-offer", () => {
      const room = htRooms.get(socket.data.htCode);
      const me = room?.players.find((p) => p.id === socket.id);
      if (!room || !me || !room.started || room.winner || room.drawOffer || room.players.length < 2) return;
      room.drawOffer = me.mark;
      htEmit(room);
    });

    socket.on("ht:draw-reply", ({ accept }) => {
      const room = htRooms.get(socket.data.htCode);
      const me = room?.players.find((p) => p.id === socket.id);
      if (!room || !me || room.winner || !room.drawOffer || room.drawOffer === me.mark) return;
      if (accept) return htEnd(room, "draw", "agreed");
      room.flash = { mark: room.drawOffer, reason: "declined" };
      room.drawOffer = null;
      htEmit(room);
    });

    socket.on("ht:forfeit", () => {
      const room = htRooms.get(socket.data.htCode);
      const me = room?.players.find((p) => p.id === socket.id);
      if (!room || !me || !room.started || room.winner) return;
      htEnd(room, me.mark === "X" ? "O" : "X", "forfeit");
    });

    // Host deals a new grid; marks swap so the other player starts
    socket.on("ht:rematch", ({ grid }) => {
      const room = htRooms.get(socket.data.htCode);
      if (!room || !room.winner || room.players[0].id !== socket.id || !htGridOk(grid)) return;
      // every phone in the room must be able to draw the next grid (newer criteria)
      if (!room.players.every((p) => canDraw(ioServer?.sockets.sockets.get(p.id), grid))) return;
      // next game of the series, or a fresh series once it's decided
      if (htSeries(room).over) {
        room.wins = {};
        room.seriesRated = false;
        room.comeback = null;
      }
      room.grid = grid;
      room.board = Array(9).fill(null);
      room.winner = null;
      room.flash = null;
      room.drawOffer = null;
      room.endReason = null;
      for (const p of room.players) p.mark = p.mark === "X" ? "O" : "X";
      if (room.steals) room.steals = { X: 3, O: 3 };
      room.jokers = null;
      room.used = [];
      room.turn = "X";
      htStartTurn(room);
      htEmit(room);
    });

    const htDrop = () => {
      htQueue = htQueue.filter((w) => w.socket.id !== socket.id);
      const room = htRooms.get(socket.data.htCode);
      if (!room) return;
      // walking out of a live series loses it (no dodging a defeat)
      const leaver = room.players.find((p) => p.id === socket.id);
      if (leaver && room.started && room.players.length === 2 && !htSeries(room).over && !room.seriesRated) {
        room.seriesRated = true;
        rateDuel("ht", room, leaver.mark === "X" ? "O" : "X");
      }
      room.players = room.players.filter((p) => p.id !== socket.id);
      if (room.players.length === 0) {
        clearTimeout(room.timer);
        htRooms.delete(room.code);
      } else {
        clearTimeout(room.timer);
        room.started = false;
        room.deadline = null;
        io.to("ht:" + room.code).emit("ht:peer-left", htPublic(room));
      }
    };
    socket.on("disconnect", (reason) => {
      htQueue = htQueue.filter((w) => w.socket.id !== socket.id);
      const room = htRooms.get(socket.data.htCode);
      dropLater("ht", () => !!room && room.started && room.players.length === 2 && !htSeries(room).over, htDrop)(reason);
    });

    // ── Quiz ──
    const qzEmit = (room) => {
      for (const p of room.players) if (!p.bot) io.sockets.sockets.get(p.id)?.emit("qz:update", qzPublic(room, p.id));
    };
    const qzClear = (room) => {
      clearTimeout(room.timer);
      room.botTimers.forEach(clearTimeout);
      room.botTimers = [];
    };
    const qzHumans = (room) => room.players.filter((p) => !p.bot);

    const qzReveal = (room) => {
      if (room.phase !== "question") return;
      qzClear(room);
      const q = room.questions[room.index];
      const limit = room.settings.seconds * 1000;
      for (const p of room.players) {
        const a = room.answers.get(p.id);
        p.gained = a && a.choice === q.answer ? qzPoints(a.ms, limit) : 0;
        p.score += p.gained;
      }
      room.phase = "reveal";
      room.deadline = Date.now() + QZ_REVEAL_MS;
      room.timer = setTimeout(() => qzNext(room), QZ_REVEAL_MS);
      qzEmit(room);
    };

    const qzNext = (room) => {
      qzClear(room);
      room.index++;
      room.answers = new Map();
      if (room.index >= room.questions.length) {
        room.phase = "done";
        room.deadline = null;
        qzAward(room);
        return qzEmit(room);
      }
      const limit = room.settings.seconds * 1000;
      room.phase = "question";
      room.qStart = Date.now() + QZ_GAP_MS;
      room.deadline = room.qStart + limit;
      room.timer = setTimeout(() => qzReveal(room), limit + QZ_GAP_MS);
      // house players answer like people: a few seconds in, right most of the time
      const q = room.questions[room.index];
      for (const p of room.players.filter((x) => x.bot)) {
        if (Math.random() < 0.05) continue; // now and then they run out of time
        const ms = QZ_GAP_MS + 2500 + Math.random() * (limit - 3500);
        room.botTimers.push(
          setTimeout(() => {
            const wrong = [0, 1, 2, 3].filter((i) => i !== q.answer);
            const choice = Math.random() < p.skill ? q.answer : wrong[Math.floor(Math.random() * 3)];
            qzAnswer(room, p.id, choice);
          }, ms)
        );
      }
      qzEmit(room);
    };

    const qzBegin = (room) => {
      qzClear(room);
      for (const d of Object.keys(qzOpen)) if (qzOpen[d] === room.code) qzOpen[d] = null;
      for (const p of room.players) {
        p.score = 0;
        p.gained = 0;
        // one 50/50 per player per match (house players don't use theirs)
        p.fifty = 1;
        p.fiftyAt = -1;
      }
      room.index = -1;
      room.answers = new Map();
      room.phase = "intro";
      room.deadline = Date.now() + QZ_INTRO_MS;
      room.timer = setTimeout(() => qzNext(room), QZ_INTRO_MS);
      qzEmit(room);
    };

    const qzAnswer = (room, id, choice) => {
      if (room.phase !== "question" || room.answers.has(id) || !room.players.some((p) => p.id === id)) return;
      if (!Number.isInteger(choice) || choice < 0 || choice > 3) return;
      room.answers.set(id, { choice, ms: Math.max(0, Date.now() - room.qStart) });
      if (room.players.every((p) => room.answers.has(p.id))) {
        clearTimeout(room.timer);
        room.timer = setTimeout(() => qzReveal(room), 500);
      }
      qzEmit(room);
    };

    const qzAddBot = (room) => {
      if (room.phase !== "lobby" || room.players.length >= room.settings.maxPlayers) return;
      room.players.push({ id: "p" + Math.random().toString(36).slice(2, 10), ref: crypto.randomBytes(8).toString("hex"), nick: qzNick(), score: 0, bot: true, skill: 0.45 + Math.random() * 0.3 });
      qzEmit(room);
    };

    const qzNewRoom = (socket, nick, settings, questions, random) => {
      let code;
      do code = makeCode();
      while (qzRooms.has(code));
      const room = {
        code,
        random,
        hostId: socket.id,
        settings,
        questions,
        phase: "lobby",
        index: -1,
        answers: new Map(),
        deadline: null,
        timer: null,
        botTimers: [],
        players: [{ id: socket.id, uid: socket.data.uid, pid: socket.data.qzPid, nick: cleanNick(nick), score: 0 }],
      };
      qzRooms.set(code, room);
      socket.data.qzCode = code;
      socket.join("qz:" + code);
      return room;
    };

    const qzLeave = () => {
      const room = qzRooms.get(socket.data.qzCode);
      socket.leave("qz:" + socket.data.qzCode);
      socket.data.qzCode = null;
      if (!room) return;
      room.players = room.players.filter((p) => p.id !== socket.id);
      room.answers.delete(socket.id);
      if (!qzHumans(room).length) {
        qzClear(room);
        qzRooms.delete(room.code);
        for (const d of Object.keys(qzOpen)) if (qzOpen[d] === room.code) qzOpen[d] = null;
        return;
      }
      if (room.hostId === socket.id) room.hostId = qzHumans(room)[0].id;
      if (room.phase === "question" && room.players.every((p) => room.answers.has(p.id))) qzReveal(room);
      else qzEmit(room);
    };

    socket.on("qz:create", ({ pid, nick, settings, questions }, cb) => {
      if (qzValidPid(pid)) socket.data.qzPid = pid;
      if (!qzValidQuestions(questions)) return cb?.({ ok: false, error: "bad_questions" });
      if (socket.data.qzCode) qzLeave();
      const room = qzNewRoom(socket, nick, qzSettings(settings), questions, false);
      cb?.({ ok: true, room: qzPublic(room) });
    });

    socket.on("qz:join", ({ code, pid, nick }, cb) => {
      if (qzValidPid(pid)) socket.data.qzPid = pid;
      const room = qzRooms.get(String(code || "").toUpperCase());
      if (!room) return cb?.({ ok: false, error: "not_found" });
      if (room.players.some((p) => p.id === socket.id)) return cb?.({ ok: true, room: qzPublic(room) });
      if (room.phase !== "lobby") return cb?.({ ok: false, error: "started" });
      if (room.players.length >= room.settings.maxPlayers) return cb?.({ ok: false, error: "full" });
      if (socket.data.qzCode) qzLeave();
      room.players.push({ id: socket.id, uid: socket.data.uid, pid: socket.data.qzPid, nick: cleanNick(nick), score: 0 });
      socket.data.qzCode = room.code;
      socket.join("qz:" + room.code);
      cb?.({ ok: true, room: qzPublic(room) });
      qzEmit(room);
      if (room.random && room.players.length >= room.settings.maxPlayers) qzBegin(room);
    });

    // Random: join the open room, or open one that starts after QZ_FILL_MS
    socket.on("qz:queue", ({ pid, nick, questions, difficulty, tier }, cb) => {
      const level = qzLevelOf(difficulty);
      const myTier = cleanTier(tier);
      if (qzValidPid(pid)) socket.data.qzPid = pid;
      if (!qzValidQuestions(questions)) return cb?.({ ok: false, error: "bad_questions" });
      if (socket.data.qzCode) qzLeave();
      // the open room of this level whose rank is closest, if its age allows the gap
      let open = null;
      for (const [key, code] of Object.entries(qzOpen)) {
        const room = code && qzRooms.get(code);
        if (!room || !key.startsWith(level + ":") || room.phase !== "lobby" || room.players.length >= room.settings.maxPlayers) continue;
        if (room.players.some((p) => { const r = seatRef(p); return socket.data.blocks?.has(r) || io.sockets.sockets.get(p.id)?.data.blocks?.has(socket.data.ref); })) continue;
        const gap = Math.abs(room.tier - myTier);
        if (gap <= tierGap(room.fillAt - QZ_FILL_MS) && (!open || gap < Math.abs(open.tier - myTier))) open = room;
      }
      if (open) {
        open.players.push({ id: socket.id, uid: socket.data.uid, pid: socket.data.qzPid, nick: cleanNick(nick), score: 0 });
        socket.data.qzCode = open.code;
        socket.join("qz:" + open.code);
        cb?.({ ok: true, code: open.code });
        qzEmit(open);
        if (open.players.length >= open.settings.maxPlayers) qzBegin(open);
        return;
      }
      const room = qzNewRoom(socket, nick, qzSettings({ difficulty: level }), questions, true);
      room.tier = myTier;
      qzOpen[`${level}:${myTier}`] = room.code;
      // a few others "find" the room while it waits
      const joins = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < joins; i++) room.botTimers.push(setTimeout(() => qzAddBot(room), 2500 + Math.random() * (QZ_FILL_MS - 4000)));
      room.timer = setTimeout(() => {
        if (room.phase !== "lobby") return;
        while (room.players.length < 2) qzAddBot(room);
        qzBegin(room);
      }, QZ_FILL_MS);
      room.fillAt = Date.now() + QZ_FILL_MS;
      cb?.({ ok: true, code: room.code });
    });

    // Full time: XP and points for every person in the room, then each one hears how they did
    const qzAward = (room) => {
      const standings = [...room.players].sort((a, b) => b.score - a.score);
      const week = qzWeek();
      for (const p of room.players) {
        if (p.bot || !p.pid) continue;
        const place = standings.indexOf(p);
        const gained = qzGameXp(p.score, place, room.players.length);
        const before = qzProfile(p.pid);
        const st = (qzStats[p.pid] ??= { nick: "", xp: 0, points: 0, games: 0, wins: 0, week, weekXp: 0 });
        if (st.week !== week) {
          st.week = week;
          st.weekXp = 0;
        }
        st.nick = p.nick || st.nick;
        st.xp += gained;
        st.weekXp += gained;
        st.points += p.score;
        st.games++;
        if (place === 0 && room.players.length > 1) st.wins++;
        const after = qzProfile(p.pid);
        io.sockets.sockets.get(p.id)?.emit("qz:progress", { gained, before, after });
      }
      qzSaveStats();
      // rating: signed-in people only, ranked by score (house players don't count)
      const rated = standings.filter((p) => !p.bot && p.uid);
      const places = [];
      for (const p of rated) {
        const last = places[places.length - 1];
        if (last && last.score === p.score) last.ids.push(p.uid);
        else places.push({ score: p.score, ids: [p.uid] });
      }
      recordResult("qz", places.map((x) => x.ids));
    };

    // "Delete my data" in the app: drop this player's quiz record for good
    socket.on("qz:forget", ({ pid } = {}, cb) => {
      if (!qzValidPid(pid)) return cb?.({ ok: false });
      delete qzStats[pid];
      qzSaveStats();
      cb?.({ ok: true });
    });

    socket.on("qz:profile", ({ pid } = {}, cb) => {
      if (!qzValidPid(pid)) return cb?.({ ok: false });
      cb?.({ ok: true, profile: qzProfile(pid) });
    });

    // Standings: people only, all time (by XP) or this week (XP earned this week)
    socket.on("qz:standings", ({ pid, period } = {}, cb) => {
      const week = qzWeek();
      const weekly = period === "week";
      const rows = Object.entries(qzStats)
        .map(([id, st]) => ({ id, nick: st.nick || "?", level: qzLevel(st.xp).level, xp: weekly ? (st.week === week ? st.weekXp : 0) : st.xp, points: st.points, wins: st.wins }))
        .filter((r) => r.xp > 0)
        .sort((a, b) => b.xp - a.xp);
      const mine = rows.findIndex((r) => r.id === pid);
      // the install id never leaves the server: rows carry its ref (report / block) instead
      const strip = ({ id, ...r }, i) => {
        const ref = refForSocket(null, id);
        return { ...r, ref, nick: shownNick(ref, r.nick), rank: i + 1, me: id === pid };
      };
      cb?.({ ok: true, top: rows.slice(0, 50).map(strip), me: mine >= 0 ? strip(rows[mine], mine) : null, total: rows.length });
    });

    socket.on("qz:start", () => {
      const room = qzRooms.get(socket.data.qzCode);
      if (!room || room.hostId !== socket.id || room.phase !== "lobby" || room.players.length < 2) return;
      qzBegin(room);
    });

    // 50/50: two wrong options go, for this player only (the server alone knows the answer)
    socket.on("qz:joker", ({ kind }, cb) => {
      const room = qzRooms.get(socket.data.qzCode);
      const me = room?.players.find((p) => p.id === socket.id);
      if (!room || !me || kind !== "fifty" || room.phase !== "question" || room.answers.has(me.id) || !(me.fifty > 0)) return cb?.({ ok: false });
      const q = room.questions[room.index];
      const wrong = [0, 1, 2, 3].filter((i) => i !== q.answer);
      const keep = wrong[Math.floor(Math.random() * 3)];
      me.fifty--;
      me.fiftyAt = room.index;
      cb?.({ ok: true, index: room.index, remove: wrong.filter((i) => i !== keep) });
    });

    socket.on("qz:answer", ({ choice }) => {
      const room = qzRooms.get(socket.data.qzCode);
      if (room) qzAnswer(room, socket.id, Number(choice));
    });

    // Same people, new questions (from the host's phone)
    socket.on("qz:rematch", ({ questions }) => {
      const room = qzRooms.get(socket.data.qzCode);
      if (!room || room.hostId !== socket.id || room.phase !== "done" || !qzValidQuestions(questions)) return;
      room.questions = questions;
      qzBegin(room);
    });

    socket.on("qz:leave", qzLeave);
    socket.on("disconnect", qzLeave);

    socket.on("disconnect", () => {
      const room = rooms.get(joinedCode);
      if (!room) return;
      room.players = room.players.filter((p) => p.id !== socket.id);
      if (room.players.length === 0) {
        rooms.delete(room.code);
      } else {
        room.players[0].isHost = true;
        io.to(room.code).emit("room:peer-left", publicRoom(room));
      }
    });
  });

  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
