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
// matched random games open with a short VS screen before X's clock starts
const HT_INTRO_MS = 3500;
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
    steals: room.steals,
    used: room.used,
    drawOffer: room.drawOffer ?? null,
    endReason: room.endReason ?? null,
    players: room.players.map((p) => ({ id: p.id, nick: p.nick, mark: p.mark })),
  };
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
const QZ_INTRO_MS = 3000;
const QZ_REVEAL_MS = 4000;
/** the phones animate the old options out and the new ones in before the clock runs */
const QZ_GAP_MS = 900;
/** an open random room starts this long after it was opened */
const QZ_FILL_MS = 15_000;
/** code -> quiz room */
const qzRooms = new Map();
/** the random room currently taking players, if any */
let qzOpenCode = null;

const QZ_NAMES = ["emre", "burak", "mert", "kerem", "can", "ozan", "baris", "efe", "arda", "yusuf", "selin", "zeynep", "ece", "deniz", "berk", "kaan", "onur", "tolga", "hakan", "cem", "umut", "eren", "furkan", "batu", "sinan", "melis", "volkan", "tuna", "doruk", "lucas", "mateo", "jonas", "luca"];
const QZ_TAILS = ["", "", "07", "10", "1907", "1903", "1905", "34", "35", "06", "16", "61", "99", "23", "_fb", "_gs", "_bjk", "_ts"];
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

function qzValidQuestions(qs) {
  return (
    Array.isArray(qs) &&
    qs.length >= 1 &&
    qs.length <= 20 &&
    qs.every((q) => q && q.text && Array.isArray(q.options) && q.options.length === 4 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4)
  );
}

function qzSettings(s) {
  const seconds = [10, 15, 20].includes(Number(s?.seconds)) ? Number(s.seconds) : 15;
  const maxPlayers = Math.max(2, Math.min(QZ_MAX, Number(s?.maxPlayers) || QZ_MAX));
  const category = ["mixed", "players", "matches"].includes(s?.category) ? s.category : "mixed";
  return { seconds, maxPlayers, category };
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
    remainingMs: room.deadline ? Math.max(0, room.deadline - Date.now()) : 0,
    players: room.players.map((p) => ({
      id: p.id,
      nick: p.nick,
      score: p.score,
      answered: room.answers.has(p.id),
      choice: reveal || (viewer && room.answers.has(viewer)) || p.id === viewer ? (room.answers.get(p.id)?.choice ?? null) : null,
      gained: reveal ? (p.gained ?? 0) : 0,
    })),
  };
}

// ── Possession Play (31 hexes) online rooms ───────────────────────────────
// The host's phone deals the board (criterion ids). The mover's phone works
// out which hexes a footballer claims (both phones share the player list);
// the server applies the move, runs both chess clocks and decides the result.
const PP_HEXES = 31;
const PP_CLOCK_MS = 120_000;
/** code -> possession room */
const ppRooms = new Map();
/** players waiting for a random opponent: { socket, nick, board } */
let ppQueue = [];

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
    players: room.players.map((p) => ({ id: p.id, nick: p.nick, mark: p.mark })),
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

    // ── Possession Play ──
    const ppEmit = (room) => io.to("pp:" + room.code).emit("pp:update", ppPublic(room));

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
        ppEmit(room);
      }, room.clocks[room.turn]);
    };

    const ppJoinRoom = (s, room) => {
      s.data.ppCode = room.code;
      s.join("pp:" + room.code);
    };

    socket.on("pp:create", ({ nick, board }, cb) => {
      if (!Array.isArray(board) || board.length !== PP_HEXES) return cb?.({ ok: false, error: "bad_board" });
      const room = ppNewRoom(ppCode(), board, [{ id: socket.id, nick: String(nick || "").slice(0, 20), mark: "X" }]);
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
        room.players.push({ id: socket.id, nick: String(nick || "").slice(0, 20), mark });
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
      if (name) {
        const hexes = Array.isArray(claims) ? claims.map(Number).filter((i) => i >= 0 && i < PP_HEXES) : [];
        // The first claim is the chosen hex and must be neutral; the name must be new
        if (!hexes.length || room.owners[hexes[0]] || room.used.includes(name)) {
          return socket.emit("pp:update", ppPublic(room));
        }
        const stolen = hexes.filter((i) => room.owners[i] && room.owners[i].mark !== me.mark).length;
        for (const i of hexes) room.owners[i] = { mark: me.mark, name: String(name).slice(0, 60) };
        room.used.push(String(name).slice(0, 60));
        room.flash = { mark: me.mark, reason: "claim", name: String(name).slice(0, 60), count: hexes.length, stolen };
        room.winner = ppResult(room.owners);
      } else {
        room.flash = { mark: me.mark, reason: "wrong" };
      }
      if (room.winner) {
        clearTimeout(room.timer);
        room.turnStart = null;
      } else {
        room.turn = room.turn === "X" ? "O" : "X";
        ppStartTurn(room);
      }
      ppEmit(room);
    });

    socket.on("pp:rematch", ({ board }) => {
      const room = ppRooms.get(socket.data.ppCode);
      if (!room || !room.winner || room.players[0].id !== socket.id || !Array.isArray(board) || board.length !== PP_HEXES) return;
      const players = room.players.map((p) => ({ ...p, mark: p.mark === "X" ? "O" : "X" }));
      Object.assign(room, ppNewRoom(room.code, board, players), { started: true });
      ppStartTurn(room);
      ppEmit(room);
    });

    socket.on("pp:queue", ({ nick, board }) => {
      if (!Array.isArray(board) || board.length !== PP_HEXES) return;
      ppQueue = ppQueue.filter((w) => w.socket.connected && w.socket.id !== socket.id);
      const waiting = ppQueue.shift();
      if (!waiting) {
        ppQueue.push({ socket, nick: String(nick || "").slice(0, 20), board });
        return;
      }
      const room = ppNewRoom(ppCode(), waiting.board, [
        { id: waiting.socket.id, nick: waiting.nick, mark: "X" },
        { id: socket.id, nick: String(nick || "").slice(0, 20), mark: "O" },
      ]);
      room.started = true;
      ppRooms.set(room.code, room);
      ppJoinRoom(waiting.socket, room);
      ppJoinRoom(socket, room);
      ppStartTurn(room);
      io.to("pp:" + room.code).emit("pp:matched", { code: room.code });
    });

    socket.on("pp:unqueue", () => {
      ppQueue = ppQueue.filter((w) => w.socket.id !== socket.id);
    });

    socket.on("disconnect", () => {
      ppQueue = ppQueue.filter((w) => w.socket.id !== socket.id);
      const room = ppRooms.get(socket.data.ppCode);
      if (!room) return;
      room.players = room.players.filter((p) => p.id !== socket.id);
      clearTimeout(room.timer);
      if (room.players.length === 0) {
        ppRooms.delete(room.code);
      } else {
        room.started = false;
        room.turnStart = null;
        io.to("pp:" + room.code).emit("pp:peer-left", ppPublic(room));
      }
    });

    // ── Hat-trick ──

    const htEmit = (room) => io.to("ht:" + room.code).emit("ht:update", htPublic(room));

    // `graceMs` adds time before the first turn's clock (the "match found" intro)
    const htStartTurn = (room, graceMs = 0) => {
      clearTimeout(room.timer);
      room.deadline = Date.now() + HT_TURN_MS + graceMs;
      room.timer = setTimeout(() => {
        if (room.winner || !htRooms.has(room.code)) return;
        room.flash = { mark: room.turn, reason: "timeout" };
        room.turn = room.turn === "X" ? "O" : "X";
        htStartTurn(room);
        htEmit(room);
      }, HT_TURN_MS + graceMs);
    };

    socket.on("ht:create", ({ nick, grid, steals }, cb) => {
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
        // steal mode: 3 steals each, or null when off
        steals: steals ? { X: 3, O: 3 } : null,
        used: [],
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
        steals: null,
        used: [],
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
      htStartTurn(room, HT_INTRO_MS);
      io.to("ht:" + code).emit("ht:matched", { code, players: htPublic(room).players });
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
        const taken = i >= 0 && i < 9 ? room.board[i] : null;
        // A taken square is only allowed as a steal of the opponent's square
        const steal = !!taken && !!room.steals && taken.mark !== me.mark && room.steals[me.mark] > 0;
        // Bad square or a name already on the board: resync the sender only
        if (!(i >= 0 && i < 9) || (taken && !steal) || room.used.includes(name)) {
          return socket.emit("ht:update", htPublic(room));
        }
        if (steal) room.steals[me.mark]--;
        room.board[i] = { mark: me.mark, name: String(name).slice(0, 60) };
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
      htEmit(room);
    };

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
      if (!room || !room.winner || room.players[0].id !== socket.id || !grid) return;
      room.grid = grid;
      room.board = Array(9).fill(null);
      room.winner = null;
      room.flash = null;
      room.drawOffer = null;
      room.endReason = null;
      for (const p of room.players) p.mark = p.mark === "X" ? "O" : "X";
      if (room.steals) room.steals = { X: 3, O: 3 };
      room.used = [];
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
      if (qzOpenCode === room.code) qzOpenCode = null;
      for (const p of room.players) {
        p.score = 0;
        p.gained = 0;
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
      room.players.push({ id: "p" + Math.random().toString(36).slice(2, 10), nick: qzNick(), score: 0, bot: true, skill: 0.45 + Math.random() * 0.3 });
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
        players: [{ id: socket.id, nick: String(nick || "").slice(0, 20), score: 0 }],
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
        if (qzOpenCode === room.code) qzOpenCode = null;
        return;
      }
      if (room.hostId === socket.id) room.hostId = qzHumans(room)[0].id;
      if (room.phase === "question" && room.players.every((p) => room.answers.has(p.id))) qzReveal(room);
      else qzEmit(room);
    };

    socket.on("qz:create", ({ nick, settings, questions }, cb) => {
      if (!qzValidQuestions(questions)) return cb?.({ ok: false, error: "bad_questions" });
      if (socket.data.qzCode) qzLeave();
      const room = qzNewRoom(socket, nick, qzSettings(settings), questions, false);
      cb?.({ ok: true, room: qzPublic(room) });
    });

    socket.on("qz:join", ({ code, nick }, cb) => {
      const room = qzRooms.get(String(code || "").toUpperCase());
      if (!room) return cb?.({ ok: false, error: "not_found" });
      if (room.players.some((p) => p.id === socket.id)) return cb?.({ ok: true, room: qzPublic(room) });
      if (room.phase !== "lobby") return cb?.({ ok: false, error: "started" });
      if (room.players.length >= room.settings.maxPlayers) return cb?.({ ok: false, error: "full" });
      if (socket.data.qzCode) qzLeave();
      room.players.push({ id: socket.id, nick: String(nick || "").slice(0, 20), score: 0 });
      socket.data.qzCode = room.code;
      socket.join("qz:" + room.code);
      cb?.({ ok: true, room: qzPublic(room) });
      qzEmit(room);
      if (room.random && room.players.length >= room.settings.maxPlayers) qzBegin(room);
    });

    // Random: join the open room, or open one that starts after QZ_FILL_MS
    socket.on("qz:queue", ({ nick, questions }, cb) => {
      if (!qzValidQuestions(questions)) return cb?.({ ok: false, error: "bad_questions" });
      if (socket.data.qzCode) qzLeave();
      const open = qzOpenCode && qzRooms.get(qzOpenCode);
      if (open && open.phase === "lobby" && open.players.length < open.settings.maxPlayers) {
        open.players.push({ id: socket.id, nick: String(nick || "").slice(0, 20), score: 0 });
        socket.data.qzCode = open.code;
        socket.join("qz:" + open.code);
        cb?.({ ok: true, code: open.code });
        qzEmit(open);
        if (open.players.length >= open.settings.maxPlayers) qzBegin(open);
        return;
      }
      const room = qzNewRoom(socket, nick, qzSettings({}), questions, true);
      qzOpenCode = room.code;
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

    socket.on("qz:start", () => {
      const room = qzRooms.get(socket.data.qzCode);
      if (!room || room.hostId !== socket.id || room.phase !== "lobby" || room.players.length < 2) return;
      qzBegin(room);
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
