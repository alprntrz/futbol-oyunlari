// Tic-Tac-Toe online (ht:*; "Hat-trick" in code, 3×3 criteria grid). The host's phone builds the
// grid and sends criterion ids; both phones validate guesses against the same bundled player list.
// The server owns the turn, the 45 s clock, jokers, the series (first to 3) and the result.
// server.js lists it in GAMES (reconnect, room sweep, queue pairing, emotes, invites, Live
// Activity) and calls attach() for every socket.
const { cleanLook, plusOf } = require("../server-accounts");
const { INTRO_MS, socketOf, rateDuel, codeFor, cleanNick, cleanTier, seatRef, seatNick, critId, nameOf } = require("../server-core");
const { liveSend, liveTurnProps } = require("../server-live");

/**
 * Criteria newer apps added ("mate-…" played with, "coach-…" managed by, "arab-…" Saudi / Egyptian clubs, "hon-…" honour counts and birth decades): the caps
 * a phone needs to draw a Tic-Tac-Toe grid. Older apps send no caps.
 */
const gridNeeds = (grid) =>
  [...(grid?.rows ?? []), ...(grid?.cols ?? [])].map((id) => (typeof id === "string" ? id.split("-")[0] : "")).filter((k) => k === "mate" || k === "coach" || k === "arab" || k === "hon");
const canDraw = (s, grid) => gridNeeds(grid).every((k) => !!s?.data.caps?.includes(k));
/** knows every criterion kind the app can deal (so the host may use them all) */
const knowsMates = (s) => ["mate", "coach", "hon"].every((k) => !!s?.data.caps?.includes(k));
const htAllKnowMates = (room) => room.players.every((p) => knowsMates(socketOf(p.id)));

const HT_TURN_MS = 45_000;
/** a match is a series: first to this many game wins takes it */
const HT_TARGET = 3;
/** comeback bonus: whoever lost the last game of the series gets this much extra on each turn */
const HT_COMEBACK_MS = 10_000;
const HT_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];
/** code -> hat-trick room */
const rooms = new Map();
/** players waiting for a random opponent: { socket, nick, grid, league, tier, since, pair } */
let queue = [];

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

function view(room) {
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

// A grid comes from a phone and goes to the other phone: short criterion ids only
const htGridOk = (g) => !!g && Array.isArray(g.rows) && Array.isArray(g.cols) && g.rows.length === 3 && g.cols.length === 3 && [...g.rows, ...g.cols].every(critId);

/** The Live Activity of an away phone: whose turn, the mover's clock, the series */
function live(room) {
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

/** This socket's ht:* handlers; `ctx` as in server-games/wm.js. */
function attach(socket, ctx) {
  const { io, dropLater, dropLoneRoom, matchQueues } = ctx;

  const htEmit = (room) => {
    io.to("ht:" + room.code).emit("ht:update", view(room));
    live(room);
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
      if (room.winner || !rooms.has(room.code)) return;
      room.flash = { mark: room.turn, reason: "timeout" };
      room.turn = room.turn === "X" ? "O" : "X";
      htStartTurn(room);
      htEmit(room);
    }, ms);
  };

  // A joker on your turn: "time" adds 15 s to your clock; "hint" is shown on your own phone
  // (the server only counts it, and tells the other player it was used)
  socket.on("ht:joker", ({ kind }) => {
    const room = rooms.get(socket.data.htCode);
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
    dropLoneRoom(rooms, socket.data.htCode, socket);
    const code = codeFor(rooms);
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
    rooms.set(code, room);
    socket.data.htCode = code;
    socket.join("ht:" + code);
    cb?.({ ok: true, room: view(room) });
  });

  socket.on("ht:join", ({ code, nick }, cb) => {
    const room = rooms.get(String(code || "").toUpperCase());
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
    cb?.({ ok: true, room: view(room) });
  });

  // Random opponent: two waiting players of the same league (and, at first, the
  // same rank) are paired. The older one's phone already dealt the grid; the room starts at once.
  const htPair = (waiting, other) => {
    const code = codeFor(rooms);
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
    rooms.set(code, room);
    for (const s of [waiting.socket, other.socket]) {
      s.data.htCode = code;
      s.join("ht:" + code);
    }
    htStartTurn(room, INTRO_MS);
    io.to("ht:" + code).emit("ht:matched", { code, players: view(room).players });
  };

  socket.on("ht:queue", ({ nick, grid, league, tier, avatar, frame }) => {
    if (!htGridOk(grid)) return;
    const lg = typeof league === "string" ? league.slice(0, 12) : "all";
    queue = queue.filter((w) => w.socket.id !== socket.id);
    queue.push({ socket, nick: cleanNick(nick), grid, league: lg, tier: cleanTier(tier), look: cleanLook({ avatar, frame }, cleanTier(tier), plusOf(socket.data.uid)), since: Date.now(), pair: htPair });
    matchQueues();
  });

  socket.on("ht:unqueue", () => {
    queue = queue.filter((w) => w.socket.id !== socket.id);
  });

  socket.on("ht:start", () => {
    const room = rooms.get(socket.data.htCode);
    if (!room || room.started || room.players.length < 2 || room.players[0].id !== socket.id) return;
    room.started = true;
    htStartTurn(room);
    htEmit(room);
  });

  // name = validated player name, or null for a wrong guess (turn passes)
  socket.on("ht:move", ({ cell, name }) => {
    const room = rooms.get(socket.data.htCode);
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
        return socket.emit("ht:update", view(room));
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
    const room = rooms.get(socket.data.htCode);
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
    const room = rooms.get(socket.data.htCode);
    const me = room?.players.find((p) => p.id === socket.id);
    if (!room || !me || !room.started || room.winner || room.drawOffer || room.players.length < 2) return;
    room.drawOffer = me.mark;
    htEmit(room);
  });

  socket.on("ht:draw-reply", ({ accept }) => {
    const room = rooms.get(socket.data.htCode);
    const me = room?.players.find((p) => p.id === socket.id);
    if (!room || !me || room.winner || !room.drawOffer || room.drawOffer === me.mark) return;
    if (accept) return htEnd(room, "draw", "agreed");
    room.flash = { mark: room.drawOffer, reason: "declined" };
    room.drawOffer = null;
    htEmit(room);
  });

  socket.on("ht:forfeit", () => {
    const room = rooms.get(socket.data.htCode);
    const me = room?.players.find((p) => p.id === socket.id);
    if (!room || !me || !room.started || room.winner) return;
    htEnd(room, me.mark === "X" ? "O" : "X", "forfeit");
  });

  // Host deals a new grid; marks swap so the other player starts
  socket.on("ht:rematch", ({ grid }) => {
    const room = rooms.get(socket.data.htCode);
    if (!room || !room.winner || room.players[0].id !== socket.id || !htGridOk(grid)) return;
    // every phone in the room must be able to draw the next grid (newer criteria)
    if (!room.players.every((p) => canDraw(socketOf(p.id), grid))) return;
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
    queue = queue.filter((w) => w.socket.id !== socket.id);
    const room = rooms.get(socket.data.htCode);
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
      rooms.delete(room.code);
    } else {
      clearTimeout(room.timer);
      room.started = false;
      room.deadline = null;
      io.to("ht:" + room.code).emit("ht:peer-left", view(room));
    }
  };
  socket.on("disconnect", (reason) => {
    queue = queue.filter((w) => w.socket.id !== socket.id);
    const room = rooms.get(socket.data.htCode);
    dropLater("ht", () => !!room && room.started && room.players.length === 2 && !htSeries(room).over, htDrop)(reason);
  });
}

module.exports = {
  id: "ht",
  rooms,
  view,
  live,
  queue: () => queue,
  setQueue: (q) => (queue = q),
  // the older player's grid is used: the other phone must be able to draw it
  pairOk: (a, b) => a.league === b.league && canDraw(b.socket, a.grid),
  invitable: () => true,
  attach,
};
