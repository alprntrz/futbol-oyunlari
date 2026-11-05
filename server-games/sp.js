// The Spot online (sp:*; "Beyaz Nokta" in Turkish): a one-on-one penalty shootout. The rules are
// src/lib/spot.ts (shared with the phone); this file keeps the rooms, the random queue and the clock.
// Picks stay on the server until both are in, so no phone can see the other side's choice. server.js
// lists it in GAMES (reconnect, room sweep, queue pairing, emotes, invites) and calls attach() per socket.
const path = require("path");
const { pathToFileURL } = require("node:url");
const { cleanLook, plusOf } = require("../server-accounts");
const { INTRO_MS, rateDuel, codeFor, cleanNick, cleanTier, seatRef, seatNick } = require("../server-core");

/** code -> room */
const rooms = new Map();
/** players waiting for a random opponent: { socket, nick, tier, look, since, pair } */
let queue = [];
/** the rules module, once loaded */
let SP = null;
import(pathToFileURL(path.join(__dirname, "..", "src", "lib", "spot.ts")).href)
  .then((m) => (SP = m))
  .catch((e) => console.error("spot rules:", e?.message));

function view(room) {
  return {
    code: room.code,
    started: room.started,
    kicks: room.kicks,
    phase: room.phase,
    // who has picked, never what
    picked: { X: !!room.picks.X, O: !!room.picks.O },
    remainingMs: room.deadline ? Math.max(0, room.deadline - Date.now()) : 0,
    pickMs: SP?.SPOT_PICK_MS ?? 8000,
    winner: room.winner,
    endReason: room.endReason,
    again: room.again,
    players: room.players.map((p) => ({ id: p.id, ref: seatRef(p), nick: seatNick(p), mark: p.mark, tier: p.tier ?? null, avatar: p.avatar ?? null, frame: p.frame ?? null })),
  };
}

function newRoom(code, players) {
  return { code, kicks: [], picks: { X: null, O: null }, phase: "pick", winner: null, endReason: null, started: false, deadline: 0, timer: null, again: [], players };
}

/** This socket's sp:* handlers; `ctx` as in server-games/wm.js. */
function attach(socket, ctx) {
  const { io, dropLater, matchQueues } = ctx;
  const spEmit = (room) => io.to("sp:" + room.code).emit("sp:update", view(room));
  const spEnd = (room, winner, reason) => {
    clearTimeout(room.timer);
    room.deadline = 0;
    room.winner = winner;
    room.endReason = reason;
    rateDuel("sp", room, winner);
    spEmit(room);
  };
  const spNextKick = (room) => {
    clearTimeout(room.timer);
    room.phase = "pick";
    room.picks = { X: null, O: null };
    room.deadline = Date.now() + SP.SPOT_PICK_MS;
    room.timer = setTimeout(() => rooms.has(room.code) && !room.winner && spResolve(room), SP.SPOT_PICK_MS);
    spEmit(room);
  };
  // both picks are in, or the clock ran out: the kick plays out, then the next one or full time
  const spResolve = (room) => {
    clearTimeout(room.timer);
    const kicker = SP.spotKicker(room.kicks);
    const shot = room.picks[kicker];
    const dive = room.picks[SP.spotOther(kicker)];
    room.kicks.push({ kicker, shot, dive, goal: SP.spotIsGoal(shot, dive) });
    room.phase = "reveal";
    room.deadline = 0;
    spEmit(room);
    room.timer = setTimeout(() => {
      if (!rooms.has(room.code) || room.winner) return;
      const result = SP.spotResult(room.kicks);
      if (result) spEnd(room, result, "full");
      else spNextKick(room);
    }, SP.SPOT_REVEAL_MS);
  };
  const spBegin = (room) => {
    room.started = true;
    spNextKick(room);
  };
  const spJoinRoom = (s, room) => {
    s.data.spCode = room.code;
    s.join("sp:" + room.code);
  };

  socket.on("sp:create", ({ nick }, cb) => {
    if (!SP) return cb?.({ ok: false, error: "not_ready" });
    leaveRoom(socket);
    const room = newRoom(codeFor(rooms), [{ id: socket.id, uid: socket.data.uid, nick: cleanNick(nick), mark: "X" }]);
    rooms.set(room.code, room);
    spJoinRoom(socket, room);
    cb?.({ ok: true, room: view(room) });
  });
  socket.on("sp:join", ({ code, nick }, cb) => {
    const room = rooms.get(String(code || "").toUpperCase());
    if (!room) return cb?.({ ok: false, error: "not_found" });
    if (socket.data.spCode !== room.code) leaveRoom(socket);
    if (!room.players.some((p) => p.id === socket.id)) {
      if (room.players.length >= 2) return cb?.({ ok: false, error: "full" });
      room.players.push({ id: socket.id, uid: socket.data.uid, nick: cleanNick(nick), mark: room.players[0]?.mark === "X" ? "O" : "X" });
    }
    spJoinRoom(socket, room);
    spEmit(room);
    cb?.({ ok: true, room: view(room) });
  });
  socket.on("sp:start", () => {
    const room = rooms.get(socket.data.spCode);
    if (!room || room.started || room.players.length < 2 || room.players[0].id !== socket.id) return;
    spBegin(room);
  });
  // one pick per kick, no changing it
  socket.on("sp:pick", ({ dir }) => {
    const room = rooms.get(socket.data.spCode);
    const me = room?.players.find((p) => p.id === socket.id);
    const pick = SP?.spotCleanDir(dir);
    if (!room || !me || !pick || !room.started || room.winner || room.phase !== "pick" || room.picks[me.mark] || room.players.length !== 2) return;
    room.picks[me.mark] = pick;
    if (room.picks.X && room.picks.O) spResolve(room);
    else spEmit(room);
  });
  socket.on("sp:forfeit", () => {
    const room = rooms.get(socket.data.spCode);
    const me = room?.players.find((p) => p.id === socket.id);
    if (!room || !me || !room.started || room.winner || room.players.length < 2) return;
    spEnd(room, me.mark === "X" ? "O" : "X", "forfeit");
  });
  // a rematch needs both: the first to ask waits for the other
  socket.on("sp:rematch", () => {
    const room = rooms.get(socket.data.spCode);
    const me = room?.players.find((p) => p.id === socket.id);
    if (!room || !me || !room.winner || room.players.length < 2 || room.again.includes(me.mark)) return;
    room.again = [...room.again, me.mark];
    if (room.again.length < 2) return spEmit(room);
    const players = room.players.map((p) => ({ ...p, mark: p.mark === "X" ? "O" : "X" }));
    Object.assign(room, newRoom(room.code, players));
    spBegin(room);
  });
  const spPair = (waiting, other) => {
    const room = newRoom(codeFor(rooms), [
      { id: waiting.socket.id, uid: waiting.socket.data.uid, nick: waiting.nick, mark: "X", tier: waiting.tier, ...waiting.look },
      { id: other.socket.id, uid: other.socket.data.uid, nick: other.nick, mark: "O", tier: other.tier, ...other.look },
    ]);
    for (const s of [waiting.socket, other.socket]) leaveRoom(s);
    rooms.set(room.code, room);
    spJoinRoom(waiting.socket, room);
    spJoinRoom(other.socket, room);
    io.to("sp:" + room.code).emit("sp:matched", { code: room.code, players: view(room).players });
    setTimeout(() => rooms.has(room.code) && !room.started && room.players.length === 2 && spBegin(room), INTRO_MS);
  };
  socket.on("sp:queue", ({ nick, tier, avatar, frame }) => {
    if (!SP) return;
    leaveRoom(socket);
    queue = queue.filter((w) => w.socket.id !== socket.id);
    queue.push({ socket, nick: cleanNick(nick), tier: cleanTier(tier), look: cleanLook({ avatar, frame }, cleanTier(tier), plusOf(socket.data.uid)), since: Date.now(), pair: spPair });
    matchQueues();
  });
  socket.on("sp:unqueue", () => {
    queue = queue.filter((w) => w.socket.id !== socket.id);
  });
  /** Takes socket `s` out of its room (as ht.js): a room left empty is deleted with its clock, and
   *  walking out of a live game loses it: the one who stays wins and sees the result. */
  function leaveRoom(s) {
    const room = rooms.get(s.data.spCode);
    s.leave("sp:" + s.data.spCode);
    s.data.spCode = null;
    if (!room) return;
    const leaver = room.players.find((p) => p.id === s.id);
    if (leaver && room.started && !room.winner && room.players.length === 2) {
      room.winner = leaver.mark === "X" ? "O" : "X";
      room.endReason = "left";
      rateDuel("sp", room, room.winner);
    }
    room.players = room.players.filter((p) => p.id !== s.id);
    clearTimeout(room.timer);
    room.deadline = 0;
    room.again = [];
    if (room.players.length === 0) rooms.delete(room.code);
    else {
      if (!room.winner) room.started = false;
      io.to("sp:" + room.code).emit("sp:peer-left", view(room));
    }
  }
  const spDrop = () => {
    queue = queue.filter((w) => w.socket.id !== socket.id);
    leaveRoom(socket);
  };
  // the room screen closing: only its own room (a late leave never ends the next game)
  socket.on("sp:leave", ({ code }) => {
    if (typeof code === "string" && code === socket.data.spCode) spDrop();
  });
  socket.on("disconnect", (reason) => {
    queue = queue.filter((w) => w.socket.id !== socket.id);
    const room = rooms.get(socket.data.spCode);
    dropLater("sp", () => !!room && room.started && !room.winner && room.players.length === 2, spDrop)(reason);
  });
}

module.exports = {
  id: "sp",
  rooms,
  view,
  queue: () => queue,
  setQueue: (q) => (queue = q),
  invitable: (room) => room.started === false,
  attach,
};
