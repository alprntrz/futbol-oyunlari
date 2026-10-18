/**
 * Custom Next.js server with Socket.IO for the online games (each in server-games/, Pitch Chess in
 * server-taktik.js) and the shared plumbing: reconnect, matchmaking, report / block, invites,
 * emotes, Live Activity. Plan and layout: docs/server-bolme-plani.md.
 * Run with: npm run dev  (see package.json scripts)
 */
const crypto = require("crypto");
const { createServer } = require("http");
const next = require("next");
const { Server } = require("socket.io");
const { setLiveIo, liveStrings } = require("./server-live");
const { attachTaktik, ttRooms } = require("./server-taktik");
// the online games moved to their own files (server-games/), after server-taktik: it registers the "@/" resolver they load rules with
const ht = require("./server-games/ht");
const wm = require("./server-games/wm");
const pp = require("./server-games/pp");
const dz = require("./server-games/dz");
const rd = require("./server-games/rd");
const qz = require("./server-games/qz");
const race = require("./server-games/race");
const { handleAccountApi, handleRcWebhook, userIdFromToken, setPresence, setFriendAdded, friendIdByCode, inviteCard, cleanLook } = require("./server-accounts");
const { refForSocket, addReport, cleanBlocks } = require("./server-refs");
const { handleAppApi } = require("./server-app");
const { REJOIN_MS, setIo, refById, cleanNick, takePairs, qzNick } = require("./server-core");


const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);
// SOCKETS_ONLY=1: the game server without the Next site (tests start it this way; production never sets it)
const SOCKETS_ONLY = process.env.SOCKETS_ONLY === "1";
const app = SOCKETS_ONLY ? null : next({ dev });
const handle = SOCKETS_ONLY
  ? (req, res) => {
      res.writeHead(404);
      res.end();
    }
  : app.getRequestHandler();

/**
 * The two-player online games as the shared plumbing sees them (reconnect, room sweep, random
 * queues, emotes, invites). Each one's rooms live in `rooms`, a seat's room code in
 * `socket.data[id + "Code"]` and its socket.io room is `id + ":" + code`; `view` is what the
 * phones get as `id + ":update"`. `pairOk` limits who may meet in the queue; `invitable` says a
 * friend can still be invited into a room (none: no invites). A new game adds one entry here.
 */
const GAMES = [
  ht,
  pp,
  dz,
  rd,
  wm,
];
const gameById = (id) => GAMES.find((g) => g.id === id);

(app ? app.prepare() : Promise.resolve()).then(() => {
  const server = createServer(async (req, res) => {
    // /api/account/*: sign-in and the account's XP (server-accounts.js); the rest is the Next site
    if (req.url.startsWith("/api/account") && (await handleAccountApi(req, res, cleanNick))) return;
    // RevenueCat tells us about Plus renewals / refunds (server-accounts.js)
    if (req.url.split("?")[0] === "/api/rc/webhook" && req.method === "POST" && (await handleRcWebhook(req, res))) return;
    // /api/app/*: minimum app version, anonymous crash reports (server-app.js)
    if (req.url.startsWith("/api/app/") && (await handleAppApi(req, res))) return;
    handle(req, res);
  });
  // small payload cap: the biggest message is a 20-question quiz (a few KB)
  // A phone that drops out (tunnel, app in the background) and comes back within REJOIN_MS gets
  // its old socket id, rooms and socket.data back plus the events it missed (Socket.IO connection
  // state recovery); live Tic-Tac-Toe / Possession / Card Duel matches wait that long before the
  // seat counts as left (`dropLater` below).
  const io = new Server(server, {
    cors: { origin: "*" },
    maxHttpBufferSize: 64 * 1024,
    connectionStateRecovery: { maxDisconnectionDuration: REJOIN_MS, skipMiddlewares: true },
    // notice a phone that vanished (no clean close through the proxy) within ~20 s, not 45
    pingInterval: 10_000,
    pingTimeout: 10_000,
  });
  // socket id + game → the timer that will count a dropped player as gone
  const awayTimers = new Map();
  // socket id → socket.data of a phone that dropped out of a live match (for a takeover, below)
  const awayData = new Map();
  setIo(io);
  setLiveIo(io);
  // a signed-in user is "online" for friends while any of their sockets is open
  const socketsOf = (uid) => [...io.sockets.sockets.values()].filter((s) => uid && s.data.uid === uid);
  setPresence((uid) => socketsOf(uid).length > 0);
  // someone added you by your code: your open app says so
  setFriendAdded((uid, from) => {
    for (const s of socketsOf(uid)) s.emit("fr:added", { from });
  });

  // pair waiting players as their allowed rank gap widens with time
  const matchQueues = () => {
    for (const g of GAMES) {
      const { pairs, rest } = takePairs(g.queue(), g.pairOk);
      g.setQueue(rest);
      for (const [a, b] of pairs) a.pair(a, b);
    }
  };
  setInterval(matchQueues, 1000).unref();

  // Rooms nobody is connected to any more are cleared once a minute, timers included
  const alive = (id) => io.sockets.sockets.has(id);
  setInterval(() => {
    for (const map of [race.rooms, ...GAMES.map((g) => g.rooms)]) {
      for (const [code, room] of map) {
        if (room.players.some((p) => alive(p.id))) continue;
        clearTimeout(room.timer);
        map.delete(code);
      }
    }
    qz.sweep(alive);
  }, 60_000).unref();

  /** A room this socket opened and is still alone in: dropped when it opens another */
  const dropLoneRoom = (map, code, socket) => {
    const room = map.get(code);
    if (!room || room.players.length !== 1 || room.players[0].id !== socket.id) return;
    clearTimeout(room.timer);
    map.delete(code);
  };

  // Pitch Chess online lobbies (server-taktik.js): handlers added per socket below
  const taktikSocket = attachTaktik(io, { cleanNick, houseNick: qzNick, cleanLook });

  io.on("connection", (socket) => {
    // Every handler is guarded: a missing or odd payload is answered with nothing, never
    // a thrown error, and a socket that floods events (over 60 in 5 s) is dropped.
    const on = socket.on.bind(socket);
    let burst = 0;
    let burstFrom = Date.now();
    socket.on = (event, fn) =>
      on(event, (...args) => {
        try {
          if (event === "disconnect") return fn(...args);
          if (Date.now() - burstFrom > 5000) {
            burst = 0;
            burstFrom = Date.now();
          }
          if (++burst > 60) return socket.disconnect(true);
          // (payload, ack): a payload that isn't an object reads as {}, an ack only if it's a function
          const payload = args[0] !== null && typeof args[0] === "object" ? args[0] : {};
          const ack = typeof args[args.length - 1] === "function" ? args[args.length - 1] : undefined;
          fn(payload, ack);
        } catch (e) {
          console.error(`socket ${event}:`, e?.message);
        }
      });
    // signed-in app players send their session token: their online results are rated
    socket.data.uid = userIdFromToken(socket.handshake.auth?.token);
    // older apps send no install id: a ref for this connection only (reportable, blockable for the session)
    socket.data.ref ??= refForSocket(socket.data.uid, socket.handshake.auth?.pid) ?? crypto.randomBytes(8).toString("hex");
    refById.set(socket.id, socket.data.ref);
    socket.data.blocks ??= cleanBlocks(socket.handshake.auth?.blocks);
    socket.on("disconnect", () => setTimeout(() => !io.sockets.sockets.has(socket.id) && refById.delete(socket.id), REJOIN_MS + 5000));
    // the phone's block list (refs) changed: matchmaking and invites skip those players
    socket.on("blk:set", ({ refs }) => {
      socket.data.blocks = cleanBlocks(refs);
    });
    // report a player (their nickname, cheating, other): one every 5 s
    socket.on("rep:send", (p, cb) => {
      if (Date.now() - (socket.data.lastReport ?? 0) < 5000) return cb?.({ ok: false, error: "slow" });
      socket.data.lastReport = Date.now();
      cb?.({ ok: addReport(socket.data.ref, p) });
    });

    // Losing the connection in a live match: the other player hears "away" and the seat waits
    // REJOIN_MS for this phone to come back (recovered socket, below) before `drop` runs. Leaving on
    // purpose (the app closing its socket) or outside a live match drops at once.
    const dropLater = (game, live, drop) => (reason) => {
      const code = socket.data[game + "Code"];
      if (!code || !live() || reason === "client namespace disconnect" || reason === "server namespace disconnect") return drop();
      const key = socket.id + game;
      clearTimeout(awayTimers.get(key));
      awayData.set(socket.id, socket.data);
      io.to(game + ":" + code).emit("peer:away", { game, away: true, ms: REJOIN_MS });
      awayTimers.set(
        key,
        setTimeout(() => {
          awayTimers.delete(key);
          if (![...awayTimers.keys()].some((k) => k.startsWith(socket.id))) awayData.delete(socket.id);
          drop();
        }, REJOIN_MS)
      );
    };
    // Invite a friend into a room you opened: the friend's open app shows a banner
    // with Join. Only between friends (friend codes), at most one every 3 s.
    socket.on("fr:invite", ({ to, game, room }, cb) => {
      const uid = socket.data.uid;
      const code = String(room).toUpperCase();
      const g = gameById(game);
      const open = game === "tt" ? ttRooms.get(code)?.phase === "lobby" : !!g?.invitable && g.rooms.has(code) && g.invitable(g.rooms.get(code));
      if (!uid || typeof room !== "string" || !open) return cb?.({ ok: false });
      if (Date.now() - (socket.data.lastInvite ?? 0) < 3000) return cb?.({ ok: false, error: "slow" });
      const friend = friendIdByCode(uid, to);
      if (!friend) return cb?.({ ok: false, error: "not_friend" });
      const targets = socketsOf(friend);
      if (!targets.length) return cb?.({ ok: false, error: "offline" });
      socket.data.lastInvite = Date.now();
      const from = inviteCard(uid);
      for (const s of targets) if (!s.data.blocks?.has(socket.data.ref)) s.emit("fr:invited", { from, game, room: room.toUpperCase() });
      cb?.({ ok: true });
    });

    taktikSocket(socket);

    // app features this phone knows (older apps send none): "mate" / "coach" = "played with" / "managed by" grid criteria
    socket.data.caps = Array.isArray(socket.handshake.auth?.caps) ? socket.handshake.auth.caps.filter((c) => typeof c === "string").slice(0, 8) : [];
    // ── Missing 11 race, web only (server-games/race.js) ──
    race.attach(socket, { io, dropLoneRoom });

    // ── Possession Play (server-games/pp.js) ──
    pp.attach(socket, { io, dropLater, dropLoneRoom, matchQueues });

    // ── Rondo (server-games/rd.js) ──
    rd.attach(socket, { io, dropLater, dropLoneRoom, matchQueues });

    // ── Who Am I? (server-games/wm.js) ──
    wm.attach(socket, { io, dropLater, dropLoneRoom, matchQueues });

    // ── Live Activity: the token of this phone's activity for the match it's in, and whether the app is open
    socket.on("la:token", ({ game, token, s }) => {
      if (!gameById(game)?.live || typeof token !== "string" || token.length > 200) return;
      const code = socket.data[game + "Code"];
      if (!code) return;
      socket.data.la = { game, code, token, s: liveStrings(s), last: null, wasMyTurn: false };
    });
    socket.on("la:clear", () => {
      socket.data.la = null;
    });
    socket.on("app:state", ({ active }) => {
      socket.data.active = active !== false;
      // each background spell starts fresh: push the current state, alert only on later turns
      const la = socket.data.la;
      if (la) {
        la.last = null;
        la.wasMyTurn = null;
        // going away: push the current state now, so a turn that comes later is seen as new
        if (!socket.data.active) {
          const g = gameById(la.game);
          if (g?.live && g.rooms.has(la.code)) g.live(g.rooms.get(la.code));
        }
      }
    });

    // ── Quick emotes: a fixed set (no free text), to the other player in the game you're in ──
    const EMOTES = new Set(["clap", "wow", "laugh", "fire", "gg", "think", "cry", "cool"]);
    socket.on("em:send", ({ game, emote }) => {
      if (!EMOTES.has(emote) || Date.now() - (socket.data.lastEmote ?? 0) < 1500) return;
      const code = gameById(game) ? socket.data[game + "Code"] : null;
      if (!code) return;
      socket.data.lastEmote = Date.now();
      socket.to(game + ":" + code).emit("em:recv", { game, emote });
    });

    // ── Card Duel (server-games/dz.js) ──
    dz.attach(socket, { io, dropLater, dropLoneRoom, matchQueues });

    // Coming back to a live match. Either Socket.IO recovered the session (same socket id, rooms and
    // data), or (the usual case behind Fly's proxy) the phone is back before the server noticed the
    // old connection die, so it arrives as a new socket: then it names its old socket id (`prev`) and
    // proves it with the random key it sent on that one (`rk`, never shown to anyone else), and takes
    // its seats over. Either way the drop is cancelled, the other player hears it's back, and both get
    // the match as it is now.
    const rk = typeof socket.handshake.auth?.rk === "string" && /^[A-Za-z0-9]{16,40}$/.test(socket.handshake.auth.rk) ? socket.handshake.auth.rk : null;
    socket.data.rk ??= rk;
    const welcomeBack = (prevId, data) => {
      let back = false;
      for (const { id: game, rooms: map, view } of GAMES) {
        const room = map.get(data[game + "Code"]);
        const seat = room?.players.find((p) => p.id === prevId);
        if (!seat) continue;
        clearTimeout(awayTimers.get(prevId + game));
        awayTimers.delete(prevId + game);
        if (prevId !== socket.id) {
          seat.id = socket.id;
          socket.data[game + "Code"] = room.code;
          socket.join(game + ":" + room.code);
        }
        socket.to(game + ":" + room.code).emit("peer:away", { game, away: false });
        io.to(game + ":" + room.code).emit(game + ":update", view(room));
        back = true;
      }
      awayData.delete(prevId);
      if (back) socket.emit("seat:back");
    };
    const prev = socket.handshake.auth?.prev;
    if (socket.recovered) welcomeBack(socket.id, socket.data);
    else if (rk && typeof prev === "string" && prev !== socket.id) {
      const old = io.sockets.sockets.get(prev);
      const data = old ? old.data : awayData.get(prev);
      if (data && data.rk === rk) {
        if (data.la) socket.data.la = data.la;
        welcomeBack(prev, data);
        if (old) {
          // the old connection is a ghost now: it must not leave the rooms it handed over
          for (const g of GAMES) old.data[g.id + "Code"] = null;
          old.disconnect(true);
        }
      }
    }

    // ── Tic-Tac-Toe (server-games/ht.js) ──
    ht.attach(socket, { io, dropLater, dropLoneRoom, matchQueues });

    // ── Quiz (server-games/qz.js) ──
    qz.attach(socket, { io });

  });

  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
