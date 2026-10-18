// Who Am I? online (wm:*): one hidden footballer for both players, turns of a yes / no question
// from a menu or a guess. The rules are src/lib/whoami.ts (shared with the phone); this file keeps
// the rooms, the random queue, the clock and the answers. server.js lists it in GAMES (reconnect,
// room sweep, queue pairing, emotes, invites) and calls attach() for every socket.
const path = require("path");
const { pathToFileURL } = require("node:url");
const { cleanLook, plusOf } = require("../server-accounts");
const { codeFor, cleanNick, cleanTier, seatRef, seatNick, nameOf } = require("../server-core");

/** code -> room */
const rooms = new Map();
/** players waiting for a random opponent: { socket, nick, tier, look, since, pair } */
let queue = [];
/** the rules module, once loaded */
let WM = null;
import(pathToFileURL(path.join(__dirname, "..", "src", "lib", "whoami.ts")).href)
  .then((m) => (WM = m))
  .catch((e) => console.error("whoami rules:", e?.message));

function view(room) {
  return {
    code: room.code,
    started: room.started,
    turn: room.turn,
    turns: room.turns,
    maxTurns: WM?.WM_MAX_TURNS ?? 24,
    remainingMs: room.deadline ? Math.max(0, room.deadline - Date.now()) : 0,
    turnMs: room.turnMs,
    hearts: room.hearts,
    log: room.log,
    winner: room.winner,
    endReason: room.endReason,
    // the answer only once the game is over
    hidden: room.winner ? room.hidden : null,
    players: room.players.map((p) => ({ id: p.id, ref: seatRef(p), nick: seatNick(p), mark: p.mark, tier: p.tier ?? null, avatar: p.avatar ?? null, frame: p.frame ?? null })),
  };
}

function newRoom(code, players) {
  return { code, hidden: WM.wmDeal().name, log: [], hearts: { X: WM.WM_HEARTS, O: WM.WM_HEARTS }, turn: "X", turns: 0, winner: null, endReason: null, started: false, deadline: 0, turnMs: 0, timer: null, players };
}

/**
 * This socket's wm:* handlers. `ctx` is what server.js lends a game: `io`, `rateDuel` (Elo for a
 * two-player result), `dropLater` (a live seat waits REJOIN_MS after a drop), `dropLoneRoom`,
 * `matchQueues` (pair the random queues now) and `INTRO_MS` (the VS screen before the first clock).
 */
function attach(socket, ctx) {
  const { io, rateDuel, dropLater, dropLoneRoom, matchQueues, INTRO_MS } = ctx;
  const wmEmit = (room) => io.to("wm:" + room.code).emit("wm:update", view(room));
  const wmEnd = (room, winner, reason) => {
    clearTimeout(room.timer);
    room.deadline = 0;
    room.winner = winner;
    room.endReason = reason;
    rateDuel("wm", room, winner);
    wmEmit(room);
  };
  // next turn, or a draw once the turns run out
  const wmNext = (room) => {
    room.turns++;
    if (room.turns >= WM.WM_MAX_TURNS) return wmEnd(room, "draw", "turns");
    room.turn = room.turn === "X" ? "O" : "X";
    wmStartTurn(room);
    wmEmit(room);
  };
  const wmStartTurn = (room) => {
    clearTimeout(room.timer);
    room.turnMs = WM.WM_TURN_MS;
    room.deadline = Date.now() + WM.WM_TURN_MS;
    // out of time: the turn passes (no heart lost)
    room.timer = setTimeout(() => {
      if (!rooms.has(room.code) || room.winner) return;
      room.log.push({ mark: room.turn, timeout: true });
      wmNext(room);
    }, WM.WM_TURN_MS);
  };
  const wmBegin = (room) => {
    room.started = true;
    room.turn = "X";
    wmStartTurn(room);
    wmEmit(room);
  };
  const wmJoinRoom = (s, room) => {
    s.data.wmCode = room.code;
    s.join("wm:" + room.code);
  };
  const wmMine = () => {
    const room = rooms.get(socket.data.wmCode);
    const me = room?.players.find((p) => p.id === socket.id);
    return room && me && room.started && !room.winner && room.players.length === 2 && room.turn === me.mark ? { room, me } : null;
  };

  socket.on("wm:create", ({ nick }, cb) => {
    if (!WM) return cb?.({ ok: false, error: "not_ready" });
    dropLoneRoom(rooms, socket.data.wmCode, socket);
    const room = newRoom(codeFor(rooms), [{ id: socket.id, uid: socket.data.uid, nick: cleanNick(nick), mark: "X" }]);
    rooms.set(room.code, room);
    wmJoinRoom(socket, room);
    cb?.({ ok: true, room: view(room) });
  });
  socket.on("wm:join", ({ code, nick }, cb) => {
    const room = rooms.get(String(code || "").toUpperCase());
    if (!room) return cb?.({ ok: false, error: "not_found" });
    if (!room.players.some((p) => p.id === socket.id)) {
      if (room.players.length >= 2) return cb?.({ ok: false, error: "full" });
      room.players.push({ id: socket.id, uid: socket.data.uid, nick: cleanNick(nick), mark: room.players[0]?.mark === "X" ? "O" : "X" });
    }
    wmJoinRoom(socket, room);
    wmEmit(room);
    cb?.({ ok: true, room: view(room) });
  });
  socket.on("wm:start", () => {
    const room = rooms.get(socket.data.wmCode);
    if (!room || room.started || room.players.length < 2 || room.players[0].id !== socket.id) return;
    wmBegin(room);
  });
  // a question from the menu: the server answers it for both to see
  socket.on("wm:ask", ({ q }) => {
    const at = wmMine();
    const question = at && WM.wmCleanQuestion(q);
    if (!at || !question) return;
    const hidden = WM.wmByName(at.room.hidden);
    at.room.log.push({ mark: at.me.mark, q: question, yes: !!hidden && WM.wmAnswer(hidden, question) });
    wmNext(at.room);
  });
  // naming the player: right wins, wrong costs a heart (the last one loses)
  socket.on("wm:guess", ({ name }) => {
    const at = wmMine();
    const guess = nameOf(name);
    if (!at || !guess) return;
    const hidden = WM.wmByName(at.room.hidden);
    const right = !!hidden && WM.wmIsRight(guess, hidden);
    at.room.log.push({ mark: at.me.mark, guess, right });
    if (right) return wmEnd(at.room, at.me.mark, "named");
    at.room.hearts[at.me.mark]--;
    if (at.room.hearts[at.me.mark] <= 0) return wmEnd(at.room, at.me.mark === "X" ? "O" : "X", "hearts");
    wmNext(at.room);
  });
  socket.on("wm:forfeit", () => {
    const room = rooms.get(socket.data.wmCode);
    const me = room?.players.find((p) => p.id === socket.id);
    if (!room || !me || !room.started || room.winner || room.players.length < 2) return;
    wmEnd(room, me.mark === "X" ? "O" : "X", "forfeit");
  });
  socket.on("wm:rematch", () => {
    const room = rooms.get(socket.data.wmCode);
    if (!room || !room.winner || room.players.length < 2 || room.players[0].id !== socket.id) return;
    const players = room.players.map((p) => ({ ...p, mark: p.mark === "X" ? "O" : "X" }));
    Object.assign(room, newRoom(room.code, players));
    wmBegin(room);
  });
  const wmPair = (waiting, other) => {
    const room = newRoom(codeFor(rooms), [
      { id: waiting.socket.id, uid: waiting.socket.data.uid, nick: waiting.nick, mark: "X", tier: waiting.tier, ...waiting.look },
      { id: other.socket.id, uid: other.socket.data.uid, nick: other.nick, mark: "O", tier: other.tier, ...other.look },
    ]);
    rooms.set(room.code, room);
    wmJoinRoom(waiting.socket, room);
    wmJoinRoom(other.socket, room);
    io.to("wm:" + room.code).emit("wm:matched", { code: room.code, players: view(room).players });
    setTimeout(() => rooms.has(room.code) && !room.started && room.players.length === 2 && wmBegin(room), INTRO_MS);
  };
  socket.on("wm:queue", ({ nick, tier, avatar, frame }) => {
    if (!WM) return;
    queue = queue.filter((w) => w.socket.id !== socket.id);
    queue.push({ socket, nick: cleanNick(nick), tier: cleanTier(tier), look: cleanLook({ avatar, frame }, cleanTier(tier), plusOf(socket.data.uid)), since: Date.now(), pair: wmPair });
    matchQueues();
  });
  socket.on("wm:unqueue", () => {
    queue = queue.filter((w) => w.socket.id !== socket.id);
  });
  const wmDrop = () => {
    queue = queue.filter((w) => w.socket.id !== socket.id);
    const room = rooms.get(socket.data.wmCode);
    if (!room) return;
    socket.data.wmCode = null;
    socket.leave("wm:" + room.code);
    const leaver = room.players.find((p) => p.id === socket.id);
    if (leaver && room.started && !room.winner && room.players.length === 2) rateDuel("wm", room, leaver.mark === "X" ? "O" : "X");
    room.players = room.players.filter((p) => p.id !== socket.id);
    clearTimeout(room.timer);
    if (room.players.length === 0) rooms.delete(room.code);
    else {
      room.started = false;
      room.deadline = 0;
      io.to("wm:" + room.code).emit("wm:peer-left", view(room));
    }
  };
  socket.on("wm:leave", wmDrop);
  socket.on("disconnect", (reason) => {
    queue = queue.filter((w) => w.socket.id !== socket.id);
    const room = rooms.get(socket.data.wmCode);
    dropLater("wm", () => !!room && room.started && !room.winner && room.players.length === 2, wmDrop)(reason);
  });
}

module.exports = {
  id: "wm",
  rooms,
  view,
  queue: () => queue,
  setQueue: (q) => (queue = q),
  invitable: (room) => room.started === false,
  attach,
};
