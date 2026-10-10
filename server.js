/**
 * Custom Next.js server with Socket.IO for online race rooms.
 * Run with: npm run dev  (see package.json scripts)
 */
const { createServer } = require("http");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);
const app = next({ dev });
const handle = app.getRequestHandler();

/** code -> room */
const rooms = new Map();

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
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
const HT_TURN_MS = 45_000;
const HT_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];
/** code -> hat-trick room */
const htRooms = new Map();
/** players waiting for a random opponent: { socket, nick, grid } */
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
    players: room.players.map((p) => ({ id: p.id, nick: p.nick, mark: p.mark })),
  };
}

function htCode() {
  const code = makeCode();
  return htRooms.has(code) ? htCode() : code;
}

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res));
  const io = new Server(server, { cors: { origin: "*" } });

  io.on("connection", (socket) => {
    let joinedCode = null;

    socket.on("room:create", ({ nick, difficulty, matchId }, cb) => {
      const code = makeCode();
      const room = {
        code,
        difficulty: difficulty === "hard" ? "hard" : "normal",
        matchId,
        started: false,
        players: [
          {
            id: socket.id,
            nick: String(nick || "Oyuncu 1").slice(0, 20),
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
      cb({ ok: true, room: publicRoom(room) });
    });

    socket.on("room:join", ({ code, nick }, cb) => {
      const room = rooms.get(String(code || "").toUpperCase());
      if (!room) return cb({ ok: false, error: "not_found" });
      const existing = room.players.find((p) => p.id === socket.id);
      if (existing) {
        // Re-join after navigation: same socket, keep state as-is
        joinedCode = room.code;
        socket.join(room.code);
        return cb({ ok: true, room: publicRoom(room) });
      }
      if (room.players.length >= 2) return cb({ ok: false, error: "full" });
      room.players.push({
        id: socket.id,
        nick: String(nick || "Oyuncu 2").slice(0, 20),
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
      cb({ ok: true, room: publicRoom(room) });
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

    // ── Hat-trick ──

    const htEmit = (room) => io.to("ht:" + room.code).emit("ht:update", htPublic(room));

    const htStartTurn = (room) => {
      clearTimeout(room.timer);
      room.deadline = Date.now() + HT_TURN_MS;
      room.timer = setTimeout(() => {
        if (room.winner || !htRooms.has(room.code)) return;
        room.flash = { mark: room.turn, reason: "timeout" };
        room.turn = room.turn === "X" ? "O" : "X";
        htStartTurn(room);
        htEmit(room);
      }, HT_TURN_MS);
    };

    socket.on("ht:create", ({ nick, grid }, cb) => {
      if (!grid || !Array.isArray(grid.rows) || !Array.isArray(grid.cols)) return cb?.({ ok: false, error: "bad_grid" });
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
        players: [{ id: socket.id, nick: String(nick || "").slice(0, 20), mark: "X" }],
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
        const mark = room.players[0]?.mark === "X" ? "O" : "X";
        room.players.push({ id: socket.id, nick: String(nick || "").slice(0, 20), mark });
      }
      socket.data.htCode = room.code;
      socket.join("ht:" + room.code);
      htEmit(room);
      cb?.({ ok: true, room: htPublic(room) });
    });

    // Random opponent: the first waiting player is paired with the next one.
    // The waiting player's phone already dealt the grid; the room starts at once.
    socket.on("ht:queue", ({ nick, grid }) => {
      if (!grid || !Array.isArray(grid.rows) || !Array.isArray(grid.cols)) return;
      htQueue = htQueue.filter((w) => w.socket.connected && w.socket.id !== socket.id);
      const waiting = htQueue.shift();
      if (!waiting) {
        htQueue.push({ socket, nick: String(nick || "").slice(0, 20), grid });
        return;
      }
      const code = htCode();
      const room = {
        code,
        grid: waiting.grid,
        started: true,
        board: Array(9).fill(null),
        turn: "X",
        winner: null,
        flash: null,
        deadline: null,
        timer: null,
        players: [
          { id: waiting.socket.id, nick: waiting.nick, mark: "X" },
          { id: socket.id, nick: String(nick || "").slice(0, 20), mark: "O" },
        ],
      };
      htRooms.set(code, room);
      for (const s of [waiting.socket, socket]) {
        s.data.htCode = code;
        s.join("ht:" + code);
      }
      htStartTurn(room);
      io.to("ht:" + code).emit("ht:matched", { code });
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
      if (name) {
        const i = Number(cell);
        // Taken square or a name already on the board: resync the sender only
        if (!(i >= 0 && i < 9) || room.board[i] || room.board.some((c) => c && c.name === name)) {
          return socket.emit("ht:update", htPublic(room));
        }
        room.board[i] = { mark: me.mark, name: String(name).slice(0, 60) };
        room.flash = null;
        room.winner = htResult(room.board);
      } else {
        room.flash = { mark: me.mark, reason: "wrong" };
      }
      if (room.winner) {
        clearTimeout(room.timer);
        room.deadline = null;
      } else {
        room.turn = room.turn === "X" ? "O" : "X";
        htStartTurn(room);
      }
      htEmit(room);
    });

    // Host deals a new grid; marks swap so the other player starts
    socket.on("ht:rematch", ({ grid }) => {
      const room = htRooms.get(socket.data.htCode);
      if (!room || !room.winner || room.players[0].id !== socket.id || !grid) return;
      room.grid = grid;
      room.board = Array(9).fill(null);
      room.winner = null;
      room.flash = null;
      for (const p of room.players) p.mark = p.mark === "X" ? "O" : "X";
      room.turn = "X";
      htStartTurn(room);
      htEmit(room);
    });

    socket.on("disconnect", () => {
      htQueue = htQueue.filter((w) => w.socket.id !== socket.id);
      const room = htRooms.get(socket.data.htCode);
      if (!room) return;
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
  });

  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
