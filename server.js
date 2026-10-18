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
const { setLiveIo, liveSend, liveStrings, liveTurnProps } = require("./server-live");
const { attachTaktik, ttRooms } = require("./server-taktik");
// the online games moved to their own files (server-games/), after server-taktik: it registers the "@/" resolver they load rules with
const wm = require("./server-games/wm");
const pp = require("./server-games/pp");
const dz = require("./server-games/dz");
const rd = require("./server-games/rd");
const { handleAccountApi, handleRcWebhook, recordResult, userIdFromToken, setPresence, setFriendAdded, friendIdByCode, inviteCard, cleanLook, plusOf } = require("./server-accounts");
const { refForSocket, addReport, shownNick, cleanBlocks } = require("./server-refs");
const { handleAppApi } = require("./server-app");
const { REJOIN_MS, refById, seatRef, seatNick, cleanNick, cleanTier, tierGap, takePairs, codeFor, qzNick, critId, nameOf } = require("./server-core");


const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);
// SOCKETS_ONLY=1: the game server without the Next site (tests start it this way; production never sets it)
const SOCKETS_ONLY = process.env.SOCKETS_ONLY === "1";
const app = SOCKETS_ONLY ? null : next({ dev });
const handle = SOCKETS_ONLY
  ? (req, res) => {
      res.writeHead(404);
      res.end();
    }
  : app.getRequestHandler();

/** code -> room */
const rooms = new Map();


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


const makeCode = () => codeFor(rooms);

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
  if (winnerMark === "draw") return tellElo(game, room.players, recordResult(game, [[a.uid, b.uid]]));
  const w = room.players.find((p) => p.mark === winnerMark);
  const l = room.players.find((p) => p.mark !== winnerMark);
  if (w && l) tellElo(game, room.players, recordResult(game, [[w.uid], [l.uid]]));
}

/** Each rated player's phone hears its new rating and the change ("+18"), for the end-of-match pill. */
function tellElo(game, players, result) {
  if (!result) return;
  for (const p of players) {
    const r = p.uid && result.get(p.uid);
    if (r) ioServer?.sockets.sockets.get(p.id)?.emit("elo", { game, rating: r.rating, delta: r.delta });
  }
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

const htCode = () => codeFor(htRooms);


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
const QZ_FILL_MS = 8_000;
/** code -> quiz room */
const qzRooms = new Map();
/** open random rooms, "difficulty:tier" -> code: players meet others on the same quiz level and rank */
const qzOpen = {};
const qzLevelOf = (d) => (d === "easy" || d === "hard" ? d : "normal");


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

// A grid comes from a phone and goes to the other phone: short criterion ids only
const htGridOk = (g) => !!g && Array.isArray(g.rows) && Array.isArray(g.cols) && g.rows.length === 3 && g.cols.length === 3 && [...g.rows, ...g.cols].every(critId);

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

/**
 * The two-player online games as the shared plumbing sees them (reconnect, room sweep, random
 * queues, emotes, invites). Each one's rooms live in `rooms`, a seat's room code in
 * `socket.data[id + "Code"]` and its socket.io room is `id + ":" + code`; `view` is what the
 * phones get as `id + ":update"`. `pairOk` limits who may meet in the queue; `invitable` says a
 * friend can still be invited into a room (none: no invites). A new game adds one entry here.
 */
const GAMES = [
  { id: "ht", rooms: htRooms, view: htPublic, live: liveHt, queue: () => htQueue, setQueue: (q) => (htQueue = q), invitable: () => true,
    // the older player's grid is used: the other phone must be able to draw it
    pairOk: (a, b) => a.league === b.league && canDraw(b.socket, a.grid) },
  pp,
  dz,
  rd,
  wm,
];
const gameById = (id) => GAMES.find((g) => g.id === id);

(app ? app.prepare() : Promise.resolve()).then(() => {
  const server = createServer(async (req, res) => {
    // /api/account/*: sign-in and the account's XP (server-accounts.js); the rest is the Next site
    if (req.url.startsWith("/api/account") && (await handleAccountApi(req, res, cleanNick))) return;
    // RevenueCat tells us about Plus renewals / refunds (server-accounts.js)
    if (req.url.split("?")[0] === "/api/rc/webhook" && req.method === "POST" && (await handleRcWebhook(req, res))) return;
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
  setLiveIo(io);
  // a signed-in user is "online" for friends while any of their sockets is open
  const socketsOf = (uid) => [...io.sockets.sockets.values()].filter((s) => uid && s.data.uid === uid);
  setPresence((uid) => socketsOf(uid).length > 0);
  // someone added you by your code: your open app says so
  setFriendAdded((uid, from) => {
    for (const s of socketsOf(uid)) s.emit("fr:added", { from });
  });

  // pair waiting players as their allowed rank gap widens with time
  const matchQueues = () => {
    for (const g of GAMES) {
      const { pairs, rest } = takePairs(g.queue(), g.pairOk);
      g.setQueue(rest);
      for (const [a, b] of pairs) a.pair(a, b);
    }
  };
  setInterval(matchQueues, 1000).unref();

  // Rooms nobody is connected to any more are cleared once a minute, timers included
  const alive = (id) => io.sockets.sockets.has(id);
  setInterval(() => {
    for (const map of [rooms, ...GAMES.map((g) => g.rooms)]) {
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
      const code = String(room).toUpperCase();
      const g = gameById(game);
      const open = game === "tt" ? ttRooms.get(code)?.phase === "lobby" : !!g?.invitable && g.rooms.has(code) && g.invitable(g.rooms.get(code));
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

    // ── Possession Play (server-games/pp.js) ──
    pp.attach(socket, { io, rateDuel, dropLater, dropLoneRoom, matchQueues, INTRO_MS: HT_INTRO_MS });

    // ── Rondo (server-games/rd.js) ──
    rd.attach(socket, { io, rateDuel, dropLater, dropLoneRoom, matchQueues, INTRO_MS: HT_INTRO_MS });

    // ── Who Am I? (server-games/wm.js) ──
    wm.attach(socket, { io, rateDuel, dropLater, dropLoneRoom, matchQueues, INTRO_MS: HT_INTRO_MS });

    // ── Live Activity: the token of this phone's activity for the match it's in, and whether the app is open
    socket.on("la:token", ({ game, token, s }) => {
      if (!gameById(game)?.live || typeof token !== "string" || token.length > 200) return;
      const code = socket.data[game + "Code"];
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
          const g = gameById(la.game);
          if (g?.live && g.rooms.has(la.code)) g.live(g.rooms.get(la.code));
        }
      }
    });

    // ── Quick emotes: a fixed set (no free text), to the other player in the game you're in ──
    const EMOTES = new Set(["clap", "wow", "laugh", "fire", "gg", "think", "cry", "cool"]);
    socket.on("em:send", ({ game, emote }) => {
      if (!EMOTES.has(emote) || Date.now() - (socket.data.lastEmote ?? 0) < 1500) return;
      const code = gameById(game) ? socket.data[game + "Code"] : null;
      if (!code) return;
      socket.data.lastEmote = Date.now();
      socket.to(game + ":" + code).emit("em:recv", { game, emote });
    });

    // ── Card Duel (server-games/dz.js) ──
    dz.attach(socket, { io, tellElo, dropLater, dropLoneRoom, matchQueues });

    // Coming back to a live match. Either Socket.IO recovered the session (same socket id, rooms and
    // data), or (the usual case behind Fly's proxy) the phone is back before the server noticed the
    // old connection die, so it arrives as a new socket: then it names its old socket id (`prev`) and
    // proves it with the random key it sent on that one (`rk`, never shown to anyone else), and takes
    // its seats over. Either way the drop is cancelled, the other player hears it's back, and both get
    // the match as it is now.
    const rk = typeof socket.handshake.auth?.rk === "string" && /^[A-Za-z0-9]{16,40}$/.test(socket.handshake.auth.rk) ? socket.handshake.auth.rk : null;
    socket.data.rk ??= rk;
    const welcomeBack = (prevId, data) => {
      let back = false;
      for (const { id: game, rooms: map, view } of GAMES) {
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
          for (const g of GAMES) old.data[g.id + "Code"] = null;
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
      htQueue.push({ socket, nick: cleanNick(nick), grid, league: lg, tier: cleanTier(tier), look: cleanLook({ avatar, frame }, cleanTier(tier), plusOf(socket.data.uid)), since: Date.now(), pair: htPair });
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
      for (let i = 0; i < joins; i++) room.botTimers.push(setTimeout(() => qzAddBot(room), 1500 + Math.random() * (QZ_FILL_MS - 3000)));
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
      tellElo("qz", rated, recordResult("qz", places.map((x) => x.ids)));
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
