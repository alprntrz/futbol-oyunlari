// Rondo online (rd:*). Two modes, the rules in src/lib/rondo.ts (shared with the phone):
//  - "club": a club comes up, the two players take turns naming someone who played there; out of time
//    loses the round, first to 2.
//  - "pair": two clubs come up and both race; the first correct name takes the hand (a wrong one locks
//    your box for a moment), nobody in time = no hand; first to `target` hands (best of 3 / 5 / 7).
// This file deals, judges every name and runs the clock. server.js lists it in GAMES (reconnect, room
// sweep, queue pairing, emotes, invites) and calls attach() for every socket.
const path = require("path");
const { pathToFileURL } = require("node:url");
const { cleanLook, plusOf } = require("../server-accounts");
const { INTRO_MS, rateDuel, codeFor, cleanNick, cleanTier, seatRef, seatNick, nameOf } = require("../server-core");

/** code -> room */
const rooms = new Map();
/** players waiting for a random opponent: { socket, nick, tier, look, mode, since, pair } */
let queue = [];
/** the rules module, once loaded (server-taktik.js registers the "@/" resolver it needs) */
let RD = null;
import(pathToFileURL(path.join(__dirname, "..", "src", "lib", "rondo.ts")).href)
  .then((m) => (RD = m))
  .catch((e) => console.error("rondo rules:", e?.message));
/** pause between rounds / hands (the phones show who took it and the known answers) */
const RD_ROUND_GAP_MS = 3_000;
const RD_HAND_GAP_MS = 4_500;
/** pair mode deals this many spare pairs for hands nobody wins */
const RD_SPARE_PAIRS = 6;
/** this many hands in a row that nobody takes = both phones are gone: the match ends unrated */
const RD_IDLE_HANDS = 3;
/** the handshake cap a phone needs to sit in a pair room (older apps would see no club and never get a turn) */
const RD_PAIR_CAP = "rdpair";

const other = (mark) => (mark === "X" ? "O" : "X");
const msLeft = (until) => Math.max(0, (until || 0) - Date.now());

function view(room) {
  return {
    code: room.code,
    mode: room.mode,
    target: room.target,
    started: room.started,
    round: room.round,
    club: room.mode === "club" ? (room.clubs[room.round] ?? null) : null,
    pair: room.mode === "pair" ? (room.pairs[room.round] ?? null) : null,
    score: room.score,
    turn: room.turn,
    remainingMs: msLeft(room.deadline),
    turnMs: room.turnMs,
    names: room.names,
    // pair mode: how long each player's box stays locked after a wrong answer
    locked: { X: msLeft(room.missUntil.X), O: msLeft(room.missUntil.O) },
    roundEnd: room.roundEnd,
    winner: room.winner,
    // pair mode: over with no winner (both idle for RD_IDLE_HANDS hands)
    ended: room.ended,
    flash: room.flash,
    // one extra-time joker per player per match (club mode only)
    jokers: room.jokers,
    players: room.players.map((p) => ({ id: p.id, ref: seatRef(p), nick: seatNick(p), mark: p.mark, tier: p.tier ?? null, avatar: p.avatar ?? null, frame: p.frame ?? null })),
  };
}

function newRoom(code, players, mode = "club", target = RD.RONDO_TARGET) {
  const pair = mode === "pair";
  const time = pair ? 0 : 1;
  return {
    code,
    mode,
    target: pair ? target : RD.RONDO_TARGET,
    clubs: pair ? [] : RD.dealRondo(),
    pairs: pair ? RD.dealRondoPairs(undefined, target * 2 - 1 + RD_SPARE_PAIRS) : [],
    round: 0,
    score: { X: 0, O: 0 },
    turn: "X",
    names: [],
    missUntil: { X: 0, O: 0 },
    idle: 0,
    roundEnd: null,
    winner: null,
    ended: false,
    flash: null,
    jokers: { X: { time }, O: { time } },
    started: false,
    deadline: 0,
    turnMs: 0,
    timer: null,
    players,
  };
}

/** This socket's rd:* handlers; `ctx` as in server-games/wm.js. */
function attach(socket, ctx) {
  const { io, dropLater, dropLoneRoom, matchQueues } = ctx;
  const rdEmit = (room) => io.to("rd:" + room.code).emit("rd:update", view(room));

  const rdSetClock = (room, ms, onEnd) => {
    clearTimeout(room.timer);
    room.turnMs = ms;
    room.deadline = Date.now() + ms;
    room.timer = setTimeout(onEnd, ms);
  };
  // club mode: the mover's clock; when it runs out they lose the round
  const rdStartTurn = (room, ms) => rdSetClock(room, ms, () => rdRoundOver(room, other(room.turn), "timeout"));
  // pair mode: one shared clock a hand; nobody in time = no hand
  const rdStartHand = (room) => rdSetClock(room, RD.RONDO_PAIR_HAND_MS, () => rdRoundOver(room, null, "timeout", { answers: RD.rondoPairAnswers(room.pairs[room.round]) }));

  const rdNextRound = (room) => {
    room.round++;
    room.names = [];
    room.roundEnd = null;
    room.flash = null;
    room.missUntil = { X: 0, O: 0 };
    if (room.mode === "pair") {
      // more pairs if the spares ran out (many hands nobody won); unseen ones first, then any
      if (room.round >= room.pairs.length) {
        const fresh = RD.dealRondoPairs(undefined, RD.RONDO_PAIRS.length).filter((id) => !room.pairs.includes(id));
        room.pairs = [...room.pairs, ...(fresh.length ? fresh : RD.dealRondoPairs(undefined, RD_SPARE_PAIRS)).slice(0, RD_SPARE_PAIRS)];
      }
      rdStartHand(room);
    } else {
      // the other player starts the next club
      room.turn = room.round % 2 ? "O" : "X";
      rdStartTurn(room, RD.RONDO_FIRST_TURN_MS);
    }
    rdEmit(room);
  };

  /** A round / hand ends: `winnerMark` null = nobody took it (pair mode timeout). */
  const rdRoundOver = (room, winnerMark, reason, extra = {}) => {
    if (!rooms.has(room.code) || room.winner || room.ended || room.roundEnd) return;
    clearTimeout(room.timer);
    room.deadline = 0;
    if (winnerMark) room.score[winnerMark]++;
    room.roundEnd = { winner: winnerMark, reason, ...extra };
    if (winnerMark && room.score[winnerMark] >= room.target) {
      room.winner = winnerMark;
      rateDuel("rd", room, winnerMark);
      return rdEmit(room);
    }
    // nobody plays any more: stop dealing (no rating either way)
    room.idle = winnerMark ? 0 : room.idle + 1;
    if (room.mode === "pair" && room.idle >= RD_IDLE_HANDS) {
      room.ended = true;
      return rdEmit(room);
    }
    rdEmit(room);
    room.timer = setTimeout(() => rooms.has(room.code) && !room.winner && !room.ended && rdNextRound(room), room.mode === "pair" ? RD_HAND_GAP_MS : RD_ROUND_GAP_MS);
  };
  const rdBegin = (room) => {
    room.started = true;
    room.turn = "X";
    if (room.mode === "pair") rdStartHand(room);
    else rdStartTurn(room, RD.RONDO_FIRST_TURN_MS);
    rdEmit(room);
  };
  const rdJoinRoom = (s, room) => {
    s.data.rdCode = room.code;
    s.join("rd:" + room.code);
  };

  socket.on("rd:create", ({ nick, mode, target }, cb) => {
    if (!RD) return cb?.({ ok: false, error: "not_ready" });
    dropLoneRoom(rooms, socket.data.rdCode, socket);
    const room = newRoom(codeFor(rooms), [{ id: socket.id, uid: socket.data.uid, nick: cleanNick(nick), mark: "X" }], RD.cleanRondoMode(mode), RD.cleanRondoTarget(target));
    rooms.set(room.code, room);
    rdJoinRoom(socket, room);
    cb?.({ ok: true, room: view(room) });
  });

  socket.on("rd:join", ({ code, nick }, cb) => {
    const room = rooms.get(String(code || "").toUpperCase());
    if (!room) return cb?.({ ok: false, error: "not_found" });
    if (!room.players.some((p) => p.id === socket.id)) {
      if (room.players.length >= 2) return cb?.({ ok: false, error: "full" });
      if (room.mode === "pair" && !socket.data.caps?.includes(RD_PAIR_CAP)) return cb?.({ ok: false, error: "update" });
      room.players.push({ id: socket.id, uid: socket.data.uid, nick: cleanNick(nick), mark: room.players[0]?.mark === "X" ? "O" : "X" });
    }
    rdJoinRoom(socket, room);
    rdEmit(room);
    cb?.({ ok: true, room: view(room) });
  });

  socket.on("rd:start", () => {
    const room = rooms.get(socket.data.rdCode);
    if (!room || room.started || room.players.length < 2 || room.players[0].id !== socket.id) return;
    rdBegin(room);
  });

  // a typed name: the server judges it; a wrong one only tells the mover (and costs time)
  socket.on("rd:answer", ({ name }) => {
    const room = rooms.get(socket.data.rdCode);
    if (!room || !room.started || room.winner || room.ended || room.roundEnd) return;
    const me = room.players.find((p) => p.id === socket.id);
    const guess = nameOf(name);
    if (!me || !guess) return;
    if (room.mode === "pair") {
      if (msLeft(room.missUntil[me.mark]) > 0) return;
      const pairId = room.pairs[room.round];
      const v = RD.judgeRondoPair(guess, pairId, []);
      if (!v.ok) {
        room.missUntil[me.mark] = Date.now() + RD.RONDO_PAIR_MISS_MS;
        socket.emit("rd:wrong", { guess, reason: v.reason });
        return rdEmit(room);
      }
      room.names.push({ mark: me.mark, name: v.player.name });
      return rdRoundOver(room, me.mark, "answer", { name: v.player.name, answers: RD.rondoPairAnswers(pairId) });
    }
    if (me.mark !== room.turn) return;
    const v = RD.judgeRondo(guess, room.clubs[room.round], room.names.map((n) => n.name));
    if (!v.ok) return socket.emit("rd:wrong", { guess, reason: v.reason });
    room.names.push({ mark: me.mark, name: v.player.name });
    room.flash = { mark: me.mark, name: v.player.name };
    room.turn = other(room.turn);
    rdStartTurn(room, RD.RONDO_TURN_MS);
    rdEmit(room);
  });

  // +10 s on your own clock, once a match (club mode)
  socket.on("rd:joker", ({ kind }) => {
    const room = rooms.get(socket.data.rdCode);
    const me = room?.players.find((p) => p.id === socket.id);
    if (!room || !me || kind !== "time" || room.mode !== "club" || !room.started || room.winner || room.roundEnd || room.turn !== me.mark || !(room.jokers[me.mark].time > 0)) return;
    room.jokers[me.mark].time--;
    rdStartTurn(room, msLeft(room.deadline) + 10_000);
    rdEmit(room);
  });

  socket.on("rd:forfeit", () => {
    const room = rooms.get(socket.data.rdCode);
    const me = room?.players.find((p) => p.id === socket.id);
    if (!room || !me || !room.started || room.winner || room.ended || room.players.length < 2) return;
    clearTimeout(room.timer);
    room.deadline = 0;
    room.winner = other(me.mark);
    room.roundEnd = { winner: room.winner, reason: "forfeit" };
    rateDuel("rd", room, room.winner);
    rdEmit(room);
  });

  socket.on("rd:rematch", () => {
    const room = rooms.get(socket.data.rdCode);
    if (!room || !(room.winner || room.ended) || room.players.length < 2 || room.players[0].id !== socket.id) return;
    const players = room.players.map((p) => ({ ...p, mark: other(p.mark) }));
    Object.assign(room, newRoom(room.code, players, room.mode, room.target));
    rdBegin(room);
  });

  const rdPair = (waiting, found) => {
    const room = newRoom(
      codeFor(rooms),
      [
        { id: waiting.socket.id, uid: waiting.socket.data.uid, nick: waiting.nick, mark: "X", tier: waiting.tier, ...waiting.look },
        { id: found.socket.id, uid: found.socket.data.uid, nick: found.nick, mark: "O", tier: found.tier, ...found.look },
      ],
      waiting.mode,
      RD.RONDO_PAIR_TARGET,
    );
    rooms.set(room.code, room);
    rdJoinRoom(waiting.socket, room);
    rdJoinRoom(found.socket, room);
    io.to("rd:" + room.code).emit("rd:matched", { code: room.code, mode: room.mode, players: view(room).players });
    // the VS intro first, then the first club / pair
    setTimeout(() => rooms.has(room.code) && !room.started && room.players.length === 2 && rdBegin(room), INTRO_MS);
  };

  socket.on("rd:queue", ({ nick, tier, avatar, frame, mode }) => {
    if (!RD) return;
    queue = queue.filter((w) => w.socket.id !== socket.id);
    queue.push({ socket, nick: cleanNick(nick), tier: cleanTier(tier), look: cleanLook({ avatar, frame }, cleanTier(tier), plusOf(socket.data.uid)), mode: RD.cleanRondoMode(mode), since: Date.now(), pair: rdPair });
    matchQueues();
  });
  socket.on("rd:unqueue", () => {
    queue = queue.filter((w) => w.socket.id !== socket.id);
  });

  const rdDrop = () => {
    queue = queue.filter((w) => w.socket.id !== socket.id);
    const room = rooms.get(socket.data.rdCode);
    if (!room) return;
    socket.data.rdCode = null;
    socket.leave("rd:" + room.code);
    const leaver = room.players.find((p) => p.id === socket.id);
    if (leaver && room.started && !room.winner && !room.ended && room.players.length === 2) rateDuel("rd", room, other(leaver.mark));
    room.players = room.players.filter((p) => p.id !== socket.id);
    clearTimeout(room.timer);
    if (room.players.length === 0) rooms.delete(room.code);
    else {
      room.started = false;
      room.deadline = 0;
      io.to("rd:" + room.code).emit("rd:peer-left", view(room));
    }
  };
  socket.on("rd:leave", rdDrop);
  socket.on("disconnect", (reason) => {
    queue = queue.filter((w) => w.socket.id !== socket.id);
    const room = rooms.get(socket.data.rdCode);
    dropLater("rd", () => !!room && room.started && !room.winner && !room.ended && room.players.length === 2, rdDrop)(reason);
  });
}

module.exports = {
  id: "rd",
  rooms,
  view,
  queue: () => queue,
  setQueue: (q) => (queue = q),
  // the two modes never meet in the queue
  pairOk: (a, b) => a.mode === b.mode,
  invitable: (room) => room.started === false,
  attach,
};
