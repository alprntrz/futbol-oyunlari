// Missing 11 race online (room:*, race:*; web app only, no screen in the mobile app): players solve
// the same match's lineup and the first to finish wins. The server keeps the room and everyone's
// progress. server.js calls attach() for every socket and sweeps empty rooms.
const { codeFor, cleanNick } = require("../server-core");

/** code -> room */
const rooms = new Map();

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

/** This socket's room:* / race:* handlers; `ctx`: `io`, `dropLoneRoom`. */
function attach(socket, ctx) {
  const { io, dropLoneRoom } = ctx;
  let joinedCode = null;

  socket.on("room:create", ({ nick, difficulty, matchId }, cb) => {
    dropLoneRoom(rooms, joinedCode, socket);
    const code = codeFor(rooms);
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
}

module.exports = { id: "race", rooms, attach };
