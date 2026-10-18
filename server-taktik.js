/**
 * Pitch Chess (Taktik Tahtası) online: a lobby of up to 5 friends (the host + 4 invited),
 * the other seats filled by house managers, 8 in all. The server owns the game: it runs
 * the shared engine (src/lib/taktik, TypeScript loaded through the "@/" alias below), the
 * set-up clock, the matches and the gold; phones only send moves (`tt:act`), checked here.
 * A manager who drops out has TT_REJOIN_MS to come back (same install id), then a house
 * manager takes the seat over and the game goes on.
 *
 * Events: tt:create / tt:join (also rejoin) / tt:leave / tt:start / tt:act; the server
 * sends tt:state (everything a phone shows, plus `you`) and tt:players (the card pool, once).
 */
const { register } = require("node:module");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

// the "@/…" alias of tsconfig, and extensionless relative imports inside src/ (scripts/lib/alias.mjs, which isn't in the image)
const SRC = path.join(__dirname, "src") + "/";
register(
  "data:text/javascript," +
    encodeURIComponent(`
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
const ROOT = ${JSON.stringify(SRC)};
export async function resolve(spec, ctx, next) {
  if (spec.startsWith("@/")) {
    const base = ROOT + spec.slice(2);
    const file = [base + ".ts", base + ".tsx", base + "/index.ts", base].find((f) => existsSync(f));
    return next(pathToFileURL(file).href, ctx);
  }
  if (spec.startsWith(".") && !/\\.[cm]?[jt]sx?$/.test(spec) && ctx.parentURL?.includes("/src/")) {
    const url = new URL(spec, ctx.parentURL);
    for (const ext of [".ts", ".tsx", "/index.ts"]) if (existsSync(url.pathname + ext)) return next(url.href + ext, ctx);
  }
  return next(spec, ctx);
}`)
);

/** the engine, once loaded (a few hundred ms at start-up) */
let E = null;
const engineReady = Promise.all(["lib/taktik/engine.ts", "lib/taktik/bot.ts", "lib/taktik/rules.ts", "lib/taktik/ops.ts"].map((f) => import(pathToFileURL(SRC + f).href)))
  .then(([engine, bot, rules, ops]) => {
    E = { ...engine, ...bot, ...rules, ...ops };
  })
  .catch((e) => console.error("taktik engine:", e?.message));

const TT_MAX_HUMANS = 5;
/** the phone plays the match out (kick-off, 12 slices, result) and flies the gold in */
const TT_MATCH_MS = 16_000;
/** the managers' cards before the first round */
const TT_INTRO_MS = 5_000;
const TT_REJOIN_MS = 60_000;
/** a finished or empty room is kept this long for anyone still looking at it */
const TT_KEEP_MS = 120_000;
const PERSONALITIES = ["loyal", "econ", "roller", "opportunist", "loyal", "econ", "opportunist"];
const COACHES = ["pass", "bus", "press"];
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** code -> room */
const ttRooms = new Map();

function ttCode() {
  let code;
  do code = Array.from({ length: 5 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");
  while (ttRooms.has(code));
  return code;
}

const isPid = (v) => typeof v === "string" && v.length >= 8 && v.length <= 64;

/** what everyone sees; `you` is added per phone */
function publicState(room) {
  const base = {
    code: room.code,
    phase: room.phase,
    // time left, not a clock time: phones' clocks differ
    leftMs: room.phase === "plan" ? Math.max(0, room.planEnds - Date.now()) : 0,
    seats: room.seats.map((s) => ({ id: s.id, nick: s.nick, avatar: s.avatar, frame: s.frame, host: s.pid === room.hostPid, away: !!s.away, gone: !!s.gone })),
  };
  if (!room.lobby) return base;
  // the card pool never changes: it goes out once (tt:players)
  const { players, ...lobby } = room.lobby;
  void players;
  return { ...base, lobby };
}

function attachTaktik(io, { cleanNick, houseNick, cleanLook }) {
  const sockOf = (seat) => (seat.sid ? io.sockets.sockets.get(seat.sid) : null);

  /** send the state to every phone in the room (coalesced: a burst of moves is one message) */
  const send = (room, now = false) => {
    const go = () => {
      room.sendTimer = null;
      const st = publicState(room);
      for (const s of room.seats) sockOf(s)?.emit("tt:state", { ...st, you: s.id });
    };
    if (now) {
      clearTimeout(room.sendTimer);
      return go();
    }
    if (!room.sendTimer) room.sendTimer = setTimeout(go, 80);
  };

  const close = (room) => {
    clearTimeout(room.timer);
    clearTimeout(room.sendTimer);
    for (const s of room.seats) clearTimeout(s.awayTimer);
    ttRooms.delete(room.code);
  };

  const humansAlive = (room) => room.seats.some((s) => !s.gone && room.lobby.managers[s.id]?.place === null);

  /** the set-up phase: the clock runs on the server; at zero every side kicks off at once */
  const plan = (room, extraMs = 0) => {
    room.phase = "plan";
    room.planEnds = Date.now() + E.planSeconds() * 1000 + extraMs;
    clearTimeout(room.timer);
    room.timer = setTimeout(() => kick(room), room.planEnds - Date.now());
    send(room, true);
  };

  const kick = (room) => {
    if (!ttRooms.has(room.code) || room.phase !== "plan") return;
    E.endRound(room.lobby, E.botTurn);
    room.phase = "match";
    send(room, true);
    clearTimeout(room.timer);
    room.timer = setTimeout(() => {
      if (!ttRooms.has(room.code)) return;
      if (room.lobby.over || !humansAlive(room)) {
        room.phase = "over";
        send(room, true);
        room.timer = setTimeout(() => close(room), TT_KEEP_MS);
        return;
      }
      plan(room);
    }, TT_MATCH_MS);
  };

  /** a seat whose phone is gone for good: a house manager plays it from now on */
  const handOver = (room, seat) => {
    seat.gone = true;
    seat.sid = null;
    if (room.lobby) {
      const m = room.lobby.managers[seat.id];
      if (m && !m.bot) m.bot = PERSONALITIES[seat.id % PERSONALITIES.length];
    }
    send(room);
    if (room.lobby && !room.seats.some((s) => !s.gone)) {
      // nobody left to watch: the game ends here
      clearTimeout(room.timer);
      room.timer = setTimeout(() => close(room), 5_000);
    }
  };

  const away = (room, seat) => {
    if (seat.gone) return;
    seat.sid = null;
    if (!room.lobby) {
      // still in the lobby: just leave it (the host's seat passes on)
      room.seats = room.seats.filter((s) => s !== seat);
      if (!room.seats.length) return close(room);
      if (room.hostPid === seat.pid) room.hostPid = room.seats[0].pid;
      return send(room);
    }
    seat.away = Date.now();
    clearTimeout(seat.awayTimer);
    seat.awayTimer = setTimeout(() => handOver(room, seat), TT_REJOIN_MS);
    send(room);
  };

  const seatOf = (socket) => {
    const room = ttRooms.get(socket.data.ttCode);
    const seat = room?.seats.find((s) => s.sid === socket.id);
    return seat ? { room, seat } : null;
  };

  // phones that went away without a goodbye
  setInterval(() => {
    for (const room of ttRooms.values()) for (const s of room.seats) if (s.sid && !s.gone && !io.sockets.sockets.has(s.sid)) away(room, s);
  }, 10_000).unref();

  return (socket) => {
    const look = (p) => cleanLook({ avatar: p.avatar, frame: p.frame }, Number.isInteger(p.tier) ? p.tier : 0);

    // (not async: a thrown error must stay inside server.js's socket guard; the engine is loaded long before anyone plays)
    socket.on("tt:create", (p, cb) => {
      if (!E || !isPid(p.pid)) return cb?.({ ok: false });
      const old = seatOf(socket);
      if (old) away(old.room, old.seat);
      const room = {
        code: ttCode(),
        phase: "lobby",
        hostPid: p.pid,
        seats: [{ id: 0, pid: p.pid, uid: socket.data.uid, sid: socket.id, nick: cleanNick(p.nick), coach: COACHES.includes(p.coach) ? p.coach : "pass", ...look(p) }],
        lobby: null,
        timer: null,
        sendTimer: null,
      };
      // a lobby nobody starts goes after a while
      room.timer = setTimeout(() => room.phase === "lobby" && close(room), 30 * 60_000);
      ttRooms.set(room.code, room);
      socket.data.ttCode = room.code;
      cb?.({ ok: true, code: room.code });
      send(room, true);
    });

    // join a lobby, or come back into a game you were in (same install id, within a minute)
    socket.on("tt:join", (p, cb) => {
      const room = ttRooms.get(String(p.code || "").toUpperCase());
      if (!E || !room || !isPid(p.pid)) return cb?.({ ok: false, error: "not_found" });
      const mine = room.seats.find((s) => s.pid === p.pid);
      if (mine) {
        if (mine.gone) return cb?.({ ok: false, error: "gone" });
        clearTimeout(mine.awayTimer);
        mine.away = null;
        mine.sid = socket.id;
      } else {
        if (room.phase !== "lobby") return cb?.({ ok: false, error: "started" });
        if (room.seats.length >= TT_MAX_HUMANS) return cb?.({ ok: false, error: "full" });
        room.seats.push({ id: room.seats.length, pid: p.pid, uid: socket.data.uid, sid: socket.id, nick: cleanNick(p.nick), coach: COACHES.includes(p.coach) ? p.coach : "pass", ...look(p) });
      }
      socket.data.ttCode = room.code;
      if (room.lobby) socket.emit("tt:players", room.lobby.players);
      cb?.({ ok: true, code: room.code });
      send(room, true);
    });

    socket.on("tt:leave", () => {
      const at = seatOf(socket);
      if (!at) return;
      socket.data.ttCode = null;
      // leaving a live game is like dropping out: a minute to come back
      away(at.room, at.seat);
    });

    socket.on("tt:start", (p, cb) => {
      const at = seatOf(socket);
      if (!E || !at || at.room.phase !== "lobby" || at.room.hostPid !== at.seat.pid) return cb?.({ ok: false });
      const room = at.room;
      room.seats.forEach((s, i) => (s.id = i));
      const humans = room.seats.map((s) => ({ name: s.nick, coach: s.coach }));
      const bots = PERSONALITIES.slice(0, 8 - humans.length).map((personality) => ({ name: houseNick(), personality }));
      room.lobby = E.newLobby(Math.floor(Math.random() * 2 ** 31), humans, bots);
      for (const s of room.seats) sockOf(s)?.emit("tt:players", room.lobby.players);
      cb?.({ ok: true });
      plan(room, TT_INTRO_MS);
    });

    // a move on your own manager during set-up: the same list the phone runs (src/lib/taktik/ops.ts), arguments checked there
    socket.on("tt:act", (p, cb) => {
      const at = seatOf(socket);
      if (!at || typeof p.op !== "string" || at.room.phase !== "plan" || at.seat.gone) return cb?.({ ok: false });
      const l = at.room.lobby;
      const m = l.managers[at.seat.id];
      if (!m || m.place !== null) return cb?.({ ok: false });
      const r = E.applyOp(l, m, p);
      cb?.({ ok: r === true || r === "ok", r: typeof r === "string" ? r : undefined });
      send(at.room);
    });

    socket.on("disconnect", () => {
      const at = seatOf(socket);
      if (at) away(at.room, at.seat);
    });
  };
}

module.exports = { attachTaktik, ttRooms, engineReady };
