// Card Duel online (dz:*; Kart Düellosu, rules in src/lib/duel.ts, docs/design/kart-duellosu.md).
// Each phone sends its 7-card hand (card ids). The server deals the questions, keeps both picks
// hidden until both are in (or the clock runs out), judges the round from
// server-data/duel-cards.json and runs the 20 s clock. server.js lists it in GAMES (reconnect,
// room sweep, queue pairing, emotes, Live Activity) and calls attach() for every socket.
const fs = require("fs");
const path = require("path");
const { cleanLook, plusOf, recordResult } = require("../server-accounts");
const { codeFor, cleanNick, cleanTier, seatRef, seatNick } = require("../server-core");
const { liveSend, sec } = require("../server-live");

const DZ_CARDS = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, "..", "server-data", "duel-cards.json"), "utf8"));
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
/** code -> room */
const rooms = new Map();
/** players waiting for a random opponent: { socket, nick, hand, tier, look, since, pair } */
let queue = [];

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

function newRoom(code, players) {
  return { code, players, started: false, questions: dzQuestions(), round: 0, picks: [null, null], results: [], deadline: 0, timer: null, over: false, rated: false };
}

/** What phones see: the questions so far, the played cards, never an unplayed pick. */
function view(room) {
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

/** The Live Activity of an away phone: the round, picked or not, the score */
function live(room) {
  if (!room.started) return;
  const { score } = view(room);
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

/** This socket's dz:* handlers; `ctx` as in server-games/wm.js, plus `tellElo` (the rating change to each phone). */
function attach(socket, ctx) {
  const { io, tellElo, dropLater, dropLoneRoom, matchQueues } = ctx;
  const dzEmit = (room) => {
    io.to("dz:" + room.code).emit("dz:update", view(room));
    live(room);
  };

  const dzJoinRoom = (s, room) => {
    s.data.dzCode = room.code;
    s.join("dz:" + room.code);
  };

  const dzRate = (room) => {
    if (room.rated || room.players.length < 2) return;
    room.rated = true;
    const { score } = view(room);
    const [a, b] = [room.players.find((p) => p.side === 0), room.players.find((p) => p.side === 1)];
    if (!a?.uid || !b?.uid) return;
    if (score[0] === score[1]) tellElo("dz", room.players, recordResult("dz", [[a.uid, b.uid]]));
    else tellElo("dz", room.players, recordResult("dz", score[0] > score[1] ? [[a.uid], [b.uid]] : [[b.uid], [a.uid]]));
  };

  // Open a round: the question and a fresh clock; a missing pick plays a random unused card
  const dzOpenRound = (room, graceMs = 0) => {
    clearTimeout(room.timer);
    room.picks = [null, null];
    room.deadline = Date.now() + DZ_PICK_MS + graceMs;
    room.timer = setTimeout(() => {
      if (!rooms.has(room.code) || room.over) return;
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
      if (!rooms.has(room.code) || room.over) return;
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
    dropLoneRoom(rooms, socket.data.dzCode, socket);
    const room = newRoom(codeFor(rooms), [{ id: socket.id, uid: socket.data.uid, nick: cleanNick(nick), side: 0, hand }]);
    rooms.set(room.code, room);
    dzJoinRoom(socket, room);
    cb?.({ ok: true, room: view(room) });
  });

  socket.on("dz:join", ({ code, nick, hand }, cb) => {
    const room = rooms.get(String(code || "").toUpperCase());
    if (!room) return cb?.({ ok: false, error: "not_found" });
    if (!room.players.some((p) => p.id === socket.id)) {
      if (room.players.length >= 2) return cb?.({ ok: false, error: "full" });
      if (!dzHandOk(hand)) return cb?.({ ok: false, error: "bad_hand" });
      const side = room.players[0]?.side === 0 ? 1 : 0;
      room.players.push({ id: socket.id, uid: socket.data.uid, nick: cleanNick(nick), side, hand });
    }
    dzJoinRoom(socket, room);
    dzEmit(room);
    cb?.({ ok: true, room: view(room) });
  });

  socket.on("dz:start", () => {
    const room = rooms.get(socket.data.dzCode);
    if (!room || room.started || room.players.length < 2 || room.players[0].id !== socket.id) return;
    dzStart(room);
  });

  socket.on("dz:pick", ({ card }) => {
    const room = rooms.get(socket.data.dzCode);
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
    const room = rooms.get(socket.data.dzCode);
    if (!room || !room.over || room.players.length < 2 || !room.players.some((p) => p.id === socket.id)) return;
    dzStart(room);
  });

  const dzPair = (waiting, other) => {
    const room = newRoom(codeFor(rooms), [
      { id: waiting.socket.id, uid: waiting.socket.data.uid, nick: waiting.nick, side: 0, hand: waiting.hand, tier: waiting.tier, ...waiting.look },
      { id: other.socket.id, uid: other.socket.data.uid, nick: other.nick, side: 1, hand: other.hand, tier: other.tier, ...other.look },
    ]);
    rooms.set(room.code, room);
    dzJoinRoom(waiting.socket, room);
    dzJoinRoom(other.socket, room);
    io.to("dz:" + room.code).emit("dz:matched", { code: room.code, players: view(room).players });
    dzStart(room, DZ_INTRO_MS);
  };

  socket.on("dz:queue", ({ nick, hand, tier, avatar, frame }) => {
    if (!dzHandOk(hand)) return;
    queue = queue.filter((w) => w.socket.id !== socket.id);
    queue.push({ socket, nick: cleanNick(nick), hand, tier: cleanTier(tier), look: cleanLook({ avatar, frame }, cleanTier(tier), plusOf(socket.data.uid)), since: Date.now(), pair: dzPair });
    matchQueues();
  });

  socket.on("dz:unqueue", () => {
    queue = queue.filter((w) => w.socket.id !== socket.id);
  });

  const dzLeave = () => {
    queue = queue.filter((w) => w.socket.id !== socket.id);
    const room = rooms.get(socket.data.dzCode);
    if (!room) return;
    socket.data.dzCode = null;
    socket.leave("dz:" + room.code);
    const leaver = room.players.find((p) => p.id === socket.id);
    // leaving a live match counts as a loss
    if (leaver && room.started && !room.over && room.players.length === 2 && !room.rated) {
      const stay = room.players.find((p) => p !== leaver);
      room.rated = true;
      if (leaver.uid && stay?.uid) tellElo("dz", room.players, recordResult("dz", [[stay.uid], [leaver.uid]]));
    }
    room.players = room.players.filter((p) => p.id !== socket.id);
    clearTimeout(room.timer);
    if (room.players.length === 0) rooms.delete(room.code);
    else {
      room.started = false;
      room.deadline = 0;
      io.to("dz:" + room.code).emit("dz:peer-left", view(room));
    }
  };
  // a screen that opens after the match started asks for the current state
  socket.on("dz:sync", () => {
    const room = rooms.get(socket.data.dzCode);
    if (room) socket.emit("dz:update", view(room));
  });
  socket.on("dz:leave", dzLeave);
  socket.on("disconnect", (reason) => {
    queue = queue.filter((w) => w.socket.id !== socket.id);
    const room = rooms.get(socket.data.dzCode);
    dropLater("dz", () => !!room && room.started && !room.over && room.players.length === 2, dzLeave)(reason);
  });
}

module.exports = {
  id: "dz",
  rooms,
  view,
  live,
  queue: () => queue,
  setQueue: (q) => (queue = q),
  attach,
};
