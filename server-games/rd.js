// Rondo online (rd:*): a club comes up, the two players take turns naming someone who played there;
// out of time loses the round, first to 2. The rules are src/lib/rondo.ts (shared with the phone);
// this file deals the clubs, judges every name and runs the clock. server.js lists it in GAMES
// (reconnect, room sweep, queue pairing, emotes, invites) and calls attach() for every socket.
const path = require("path");
const { pathToFileURL } = require("node:url");
const { cleanLook, plusOf } = require("../server-accounts");
const { INTRO_MS, rateDuel, codeFor, cleanNick, cleanTier, seatRef, seatNick, nameOf } = require("../server-core");

/** code -> room */
const rooms = new Map();
/** players waiting for a random opponent: { socket, nick, tier, look, since, pair } */
let queue = [];
/** the rules module, once loaded (server-taktik.js registers the "@/" resolver it needs) */
let RD = null;
import(pathToFileURL(path.join(__dirname, "..", "src", "lib", "rondo.ts")).href)
  .then((m) => (RD = m))
  .catch((e) => console.error("rondo rules:", e?.message));
/** pause between rounds (the phones show who took it) */
const RD_ROUND_GAP_MS = 3_000;

function view(room) {
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

function newRoom(code, players) {
  return { code, clubs: RD.dealRondo(), round: 0, score: { X: 0, O: 0 }, turn: "X", names: [], roundEnd: null, winner: null, flash: null, jokers: { X: { time: 1 }, O: { time: 1 } }, started: false, deadline: 0, turnMs: 0, timer: null, players };
}

/** This socket's rd:* handlers; `ctx` as in server-games/wm.js. */
function attach(socket, ctx) {
  const { io, dropLater, dropLoneRoom, matchQueues } = ctx;
  const rdEmit = (room) => io.to("rd:" + room.code).emit("rd:update", view(room));

  // the mover's clock: when it runs out they lose the round
  const rdStartTurn = (room, ms) => {
    clearTimeout(room.timer);
    room.turnMs = ms;
    room.deadline = Date.now() + ms;
    room.timer = setTimeout(() => rdRoundOver(room, room.turn === "X" ? "O" : "X", "timeout"), ms);
  };
  const rdRoundOver = (room, winnerMark, reason) => {
    if (!rooms.has(room.code) || room.winner || room.roundEnd) return;
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
      if (!rooms.has(room.code) || room.winner) return;
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
    dropLoneRoom(rooms, socket.data.rdCode, socket);
    const room = newRoom(codeFor(rooms), [{ id: socket.id, uid: socket.data.uid, nick: cleanNick(nick), mark: "X" }]);
    rooms.set(room.code, room);
    rdJoinRoom(socket, room);
    cb?.({ ok: true, room: view(room) });
  });

  socket.on("rd:join", ({ code, nick }, cb) => {
    const room = rooms.get(String(code || "").toUpperCase());
    if (!room) return cb?.({ ok: false, error: "not_found" });
    if (!room.players.some((p) => p.id === socket.id)) {
      if (room.players.length >= 2) return cb?.({ ok: false, error: "full" });
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
    const room = rooms.get(socket.data.rdCode);
    const me = room?.players.find((p) => p.id === socket.id);
    if (!room || !me || kind !== "time" || !room.started || room.winner || room.roundEnd || room.turn !== me.mark || !(room.jokers[me.mark].time > 0)) return;
    room.jokers[me.mark].time--;
    rdStartTurn(room, Math.max(0, room.deadline - Date.now()) + 10_000);
    rdEmit(room);
  });

  socket.on("rd:forfeit", () => {
    const room = rooms.get(socket.data.rdCode);
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
    const room = rooms.get(socket.data.rdCode);
    if (!room || !room.winner || room.players.length < 2 || room.players[0].id !== socket.id) return;
    const players = room.players.map((p) => ({ ...p, mark: p.mark === "X" ? "O" : "X" }));
    Object.assign(room, newRoom(room.code, players));
    rdBegin(room);
  });

  const rdPair = (waiting, other) => {
    const room = newRoom(codeFor(rooms), [
      { id: waiting.socket.id, uid: waiting.socket.data.uid, nick: waiting.nick, mark: "X", tier: waiting.tier, ...waiting.look },
      { id: other.socket.id, uid: other.socket.data.uid, nick: other.nick, mark: "O", tier: other.tier, ...other.look },
    ]);
    rooms.set(room.code, room);
    rdJoinRoom(waiting.socket, room);
    rdJoinRoom(other.socket, room);
    io.to("rd:" + room.code).emit("rd:matched", { code: room.code, players: view(room).players });
    // the VS intro first, then the first club
    setTimeout(() => rooms.has(room.code) && !room.started && room.players.length === 2 && rdBegin(room), INTRO_MS);
  };

  socket.on("rd:queue", ({ nick, tier, avatar, frame }) => {
    if (!RD) return;
    queue = queue.filter((w) => w.socket.id !== socket.id);
    queue.push({ socket, nick: cleanNick(nick), tier: cleanTier(tier), look: cleanLook({ avatar, frame }, cleanTier(tier), plusOf(socket.data.uid)), since: Date.now(), pair: rdPair });
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
    if (leaver && room.started && !room.winner && room.players.length === 2) rateDuel("rd", room, leaver.mark === "X" ? "O" : "X");
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
    dropLater("rd", () => !!room && room.started && !room.winner && room.players.length === 2, rdDrop)(reason);
  });
}

module.exports = {
  id: "rd",
  rooms,
  view,
  queue: () => queue,
  setQueue: (q) => (queue = q),
  invitable: (room) => room.started === false,
  attach,
};
