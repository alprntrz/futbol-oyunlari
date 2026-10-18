// Possession Play online (pp:*, 31 hexes). The host's phone deals the board (criterion ids). The
// mover's phone works out which hexes a footballer claims (both phones share the player list); the
// server applies the move, runs both chess clocks and decides the result. server.js lists it in GAMES
// (reconnect, room sweep, queue pairing, emotes, invites, Live Activity) and calls attach() per socket.
const { cleanLook, plusOf } = require("../server-accounts");
const { INTRO_MS, rateDuel, codeFor, cleanNick, cleanTier, seatRef, seatNick, critId, nameOf } = require("../server-core");
const { liveSend, liveTurnProps } = require("../server-live");

const PP_HEXES = 31;
const PP_CLOCK_MS = 120_000;
/** code -> possession room */
const rooms = new Map();
/** players waiting for a random opponent: { socket, nick, board, tier, since, pair } */
let queue = [];

function ppResult(owners) {
  if (!owners.every(Boolean)) return null;
  const x = owners.filter((o) => o.mark === "X").length;
  return x === PP_HEXES - x ? "draw" : x > PP_HEXES - x ? "X" : "O";
}

function view(room) {
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
    players: room.players.map((p) => ({ id: p.id, ref: seatRef(p), nick: seatNick(p), mark: p.mark })),
  };
}

function newRoom(code, board, players) {
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

/** Possession hexes that touch (same rule as NEIGHBOURS in mobile/src/lib/possession.ts) */
const PP_ROWS = [4, 5, 4, 5, 4, 5, 4];
const PP_NEIGHBOURS = (() => {
  const pos = PP_ROWS.flatMap((len, r) => Array.from({ length: len }, (_, c) => [r, c]));
  const at = (r, c) => (r < 0 || r >= PP_ROWS.length || c < 0 || c >= PP_ROWS[r] ? -1 : PP_ROWS.slice(0, r).reduce((a, b) => a + b, 0) + c);
  return pos.map(([r, c]) => {
    const adj = PP_ROWS[r] === 5 ? [c - 1, c] : [c, c + 1];
    return [at(r, c - 1), at(r, c + 1), ...adj.map((cc) => at(r - 1, cc)), ...adj.map((cc) => at(r + 1, cc))].filter((i) => i >= 0);
  });
})();

// a board comes from a phone and goes to the other phone: short criterion ids only
const ppBoardOk = (b) => Array.isArray(b) && b.length === PP_HEXES && b.every(critId);

/** The Live Activity of an away phone: whose turn, the mover's clock, hexes held */
function live(room) {
  if (!room.started) return;
  const held = (m) => room.owners.filter((o) => o?.mark === m).length;
  liveSend("pp", room, (p, opp, s) =>
    liveTurnProps(p, opp, s, {
      turn: room.turn,
      winner: room.winner,
      matchOver: true,
      score: `X ${held("X")} – ${held("O")} O`,
      endsAt: room.turnStart ? room.turnStart + room.clocks[room.turn] : 0,
      since: room.turnStart ?? 0,
    })
  );
}

/** This socket's pp:* handlers; `ctx` as in server-games/wm.js. */
function attach(socket, ctx) {
  const { io, dropLater, dropLoneRoom, matchQueues } = ctx;
  const ppEmit = (room) => {
    io.to("pp:" + room.code).emit("pp:update", view(room));
    live(room);
  };

  // Start the current player's clock; when it runs out they lose
  const ppStartTurn = (room) => {
    clearTimeout(room.timer);
    room.turnStart = Date.now();
    room.timer = setTimeout(() => {
      if (room.winner || !rooms.has(room.code)) return;
      room.clocks[room.turn] = 0;
      room.flash = { mark: room.turn, reason: "timeout" };
      room.winner = room.turn === "X" ? "O" : "X";
      room.turnStart = null;
      rateDuel("pp", room, room.winner);
      ppEmit(room);
    }, room.clocks[room.turn]);
  };

  const ppJoinRoom = (s, room) => {
    s.data.ppCode = room.code;
    s.join("pp:" + room.code);
  };

  socket.on("pp:create", ({ nick, board }, cb) => {
    if (!ppBoardOk(board)) return cb?.({ ok: false, error: "bad_board" });
    dropLoneRoom(rooms, socket.data.ppCode, socket);
    const room = newRoom(codeFor(rooms), board, [{ id: socket.id, uid: socket.data.uid, nick: cleanNick(nick), mark: "X" }]);
    rooms.set(room.code, room);
    ppJoinRoom(socket, room);
    cb?.({ ok: true, room: view(room) });
  });

  socket.on("pp:join", ({ code, nick }, cb) => {
    const room = rooms.get(String(code || "").toUpperCase());
    if (!room) return cb?.({ ok: false, error: "not_found" });
    if (!room.players.some((p) => p.id === socket.id)) {
      if (room.players.length >= 2) return cb?.({ ok: false, error: "full" });
      const mark = room.players[0]?.mark === "X" ? "O" : "X";
      room.players.push({ id: socket.id, uid: socket.data.uid, nick: cleanNick(nick), mark });
    }
    ppJoinRoom(socket, room);
    ppEmit(room);
    cb?.({ ok: true, room: view(room) });
  });

  socket.on("pp:start", () => {
    const room = rooms.get(socket.data.ppCode);
    if (!room || room.started || room.players.length < 2 || room.players[0].id !== socket.id) return;
    room.started = true;
    ppStartTurn(room);
    ppEmit(room);
  });

  // claims = hexes the named footballer takes (null name = wrong answer)
  socket.on("pp:move", ({ name, claims }) => {
    const room = rooms.get(socket.data.ppCode);
    if (!room || !room.started || room.winner) return;
    const me = room.players.find((p) => p.id === socket.id);
    if (!me || me.mark !== room.turn) return;
    room.clocks[me.mark] = Math.max(0, room.clocks[me.mark] - (Date.now() - room.turnStart));
    const player = nameOf(name);
    if (player) {
      const hexes = Array.isArray(claims) ? [...new Set(claims)].filter((i) => Number.isInteger(i) && i >= 0 && i < PP_HEXES) : [];
      // The first claim is the chosen hex and must be neutral; the rest must touch it; the name must be new
      const touching = hexes.slice(1).every((i) => PP_NEIGHBOURS[hexes[0]].includes(i));
      if (!hexes.length || hexes.length !== (claims?.length ?? 0) || !touching || room.owners[hexes[0]] || room.used.includes(player)) {
        return socket.emit("pp:update", view(room));
      }
      const stolen = hexes.filter((i) => room.owners[i] && room.owners[i].mark !== me.mark).length;
      for (const i of hexes) room.owners[i] = { mark: me.mark, name: player };
      room.used.push(player);
      room.flash = { mark: me.mark, reason: "claim", name: player, count: hexes.length, stolen };
      room.winner = ppResult(room.owners);
    } else {
      room.flash = { mark: me.mark, reason: "wrong" };
    }
    if (room.winner) {
      clearTimeout(room.timer);
      room.turnStart = null;
      rateDuel("pp", room, room.winner);
    } else {
      room.turn = room.turn === "X" ? "O" : "X";
      ppStartTurn(room);
    }
    ppEmit(room);
  });

  socket.on("pp:rematch", ({ board }) => {
    const room = rooms.get(socket.data.ppCode);
    if (!room || !room.winner || room.players[0].id !== socket.id || !ppBoardOk(board)) return;
    const players = room.players.map((p) => ({ ...p, mark: p.mark === "X" ? "O" : "X" }));
    Object.assign(room, newRoom(room.code, board, players), { started: true });
    ppStartTurn(room);
    ppEmit(room);
  });

  const ppPair = (waiting, other) => {
    const room = newRoom(codeFor(rooms), waiting.board, [
      { id: waiting.socket.id, uid: waiting.socket.data.uid, nick: waiting.nick, mark: "X", tier: waiting.tier, ...waiting.look },
      { id: other.socket.id, uid: other.socket.data.uid, nick: other.nick, mark: "O", tier: other.tier, ...other.look },
    ]);
    rooms.set(room.code, room);
    ppJoinRoom(waiting.socket, room);
    ppJoinRoom(other.socket, room);
    const look = (p) => ({ id: p.id, ref: seatRef(p), nick: seatNick(p), mark: p.mark, tier: p.tier ?? null, avatar: p.avatar ?? null, frame: p.frame ?? null });
    io.to("pp:" + room.code).emit("pp:matched", { code: room.code, players: room.players.map(look) });
    // the phones show the VS intro first; X's clock starts after it
    setTimeout(() => {
      if (!rooms.has(room.code) || room.started || room.players.length < 2) return;
      room.started = true;
      ppStartTurn(room);
      ppEmit(room);
    }, INTRO_MS);
  };

  socket.on("pp:queue", ({ nick, board, tier, avatar, frame }) => {
    if (!ppBoardOk(board)) return;
    queue = queue.filter((w) => w.socket.id !== socket.id);
    queue.push({ socket, nick: cleanNick(nick), board, tier: cleanTier(tier), look: cleanLook({ avatar, frame }, cleanTier(tier), plusOf(socket.data.uid)), since: Date.now(), pair: ppPair });
    matchQueues();
  });

  socket.on("pp:unqueue", () => {
    queue = queue.filter((w) => w.socket.id !== socket.id);
  });

  const ppDrop = () => {
    queue = queue.filter((w) => w.socket.id !== socket.id);
    const room = rooms.get(socket.data.ppCode);
    if (!room) return;
    const leaver = room.players.find((p) => p.id === socket.id);
    if (leaver && room.started && !room.winner && room.players.length === 2) rateDuel("pp", room, leaver.mark === "X" ? "O" : "X");
    room.players = room.players.filter((p) => p.id !== socket.id);
    clearTimeout(room.timer);
    if (room.players.length === 0) {
      rooms.delete(room.code);
    } else {
      room.started = false;
      room.turnStart = null;
      io.to("pp:" + room.code).emit("pp:peer-left", view(room));
    }
  };
  socket.on("disconnect", (reason) => {
    queue = queue.filter((w) => w.socket.id !== socket.id);
    const room = rooms.get(socket.data.ppCode);
    dropLater("pp", () => !!room && room.started && !room.winner && room.players.length === 2, ppDrop)(reason);
  });
}

module.exports = {
  id: "pp",
  rooms,
  view,
  live,
  queue: () => queue,
  setQueue: (q) => (queue = q),
  attach,
};
