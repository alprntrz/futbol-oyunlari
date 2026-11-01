/**
 * The game server end to end: server.js runs on a free port with a throwaway data folder and no
 * Next site (SOCKETS_ONLY=1), and two socket.io clients play each online game the way the phones
 * do. This is the safety net for refactoring server.js (docs/server-bolme-plani.md): event names,
 * payloads and behaviour must stay exactly as old app versions expect.
 */
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";

import { houseHand, themeForDay } from "@/lib/duel";
import { quizQuestions } from "@/lib/quiz";
import { houseRondoAnswer, rondoPairAnswers } from "@/lib/rondo";
import { criterionById, generateGrid, GRID_PLAYERS, seededRandom } from "@/lib/tiki";

const require = createRequire(import.meta.url);
const { io } = require("socket.io-client") as typeof import("socket.io-client");
type Socket = import("socket.io-client").Socket;

const REJOIN_MS = 1500;
const DATA = mkdtempSync(join(tmpdir(), "tiktako-server-"));
let URL = "";
let server: ChildProcess;
const open: Socket[] = [];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const freePort = () =>
  new Promise<number>((resolve) => {
    const s = createServer();
    s.listen(0, () => {
      const port = (s.address() as { port: number }).port;
      s.close(() => resolve(port));
    });
  });

before(async () => {
  const port = await freePort();
  URL = `http://localhost:${port}`;
  server = spawn(process.execPath, ["server.js"], {
    env: { ...process.env, PORT: String(port), NODE_ENV: "production", SOCKETS_ONLY: "1", REJOIN_MS: String(REJOIN_MS), ACCOUNTS_DB: join(DATA, "accounts.db"), QZ_STATS_FILE: join(DATA, "qz.json") },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("server did not start")), 20_000);
    server.stdout!.on("data", (d) => String(d).includes("Ready on") && (clearTimeout(t), resolve()));
    server.on("exit", (c) => reject(new Error(`server exited ${c}`)));
  });
  // the rules modules (rondo.ts, whoami.ts, taktik) load just after start
  await wait(1500);
});

after(() => {
  for (const s of open) s.close();
  server?.kill();
});

const CAPS = ["mate", "coach", "arab", "hon", "rdpair"];
function client(auth: Record<string, unknown> = {}): Promise<Socket> {
  const s = io(URL, { transports: ["websocket"], forceNew: true, reconnectionDelay: 100, auth: { caps: CAPS, ...auth } });
  open.push(s);
  return new Promise((r) => s.on("connect", () => r(s)));
}
const ask = <T,>(s: Socket, event: string, payload: unknown = {}) => new Promise<T>((r) => s.emit(event, payload, r));
/** The latest payload of an event on a socket. */
function latest<T>(s: Socket, event: string) {
  const box: { v: T | null } = { v: null };
  s.on(event, (v: T) => (box.v = v));
  return box;
}
const grid = () => {
  const g = generateGrid(seededRandom(7));
  return { rows: g.rows.map((c) => c.id), cols: g.cols.map((c) => c.id) };
};

test("HTTP: app version endpoint answers", async () => {
  const r = await fetch(`${URL}/api/app/version`);
  assert.equal(r.status, 200);
  assert.ok((await r.json()).min);
});

test("Tic-Tac-Toe: room, turn order, jokers, forfeit", async () => {
  const [a, b] = await Promise.all([client(), client()]);
  const st = latest<{ turn: string; started: boolean; jokers: Record<string, { time: number; hint: number }>; remainingMs: number; winner: string | null; flash: unknown }>(a, "ht:update");
  const c = await ask<{ ok: boolean; room: { code: string } }>(a, "ht:create", { nick: "a", grid: grid() });
  assert.ok(c.ok);
  assert.ok((await ask<{ ok: boolean }>(b, "ht:join", { code: c.room.code, nick: "b" })).ok);
  a.emit("ht:start");
  await wait(300);
  assert.equal(st.v?.started, true);
  b.emit("ht:joker", { kind: "time" });
  await wait(200);
  assert.equal(st.v?.jokers.O.time, 1, "not O's turn");
  const before = st.v!.remainingMs;
  a.emit("ht:joker", { kind: "time" });
  await wait(200);
  assert.equal(st.v?.jokers.X.time, 0);
  assert.ok(st.v!.remainingMs > before + 10_000, "+15 s");
  a.emit("ht:move", { cell: 0, name: null });
  await wait(200);
  assert.equal(st.v?.turn, "O", "a wrong answer passes the turn");
  b.emit("ht:forfeit");
  await wait(300);
  assert.equal(st.v?.winner, "X");
});

test("Tic-Tac-Toe: the server judges names, a made-up or misfit one is a miss", async () => {
  const [a, b] = await Promise.all([client(), client()]);
  type Cell = { mark: string; name: string } | null;
  const st = latest<{ turn: string; board: Cell[]; flash: { reason: string } | null }>(a, "ht:update");
  const g = grid();
  const c = await ask<{ ok: boolean; room: { code: string } }>(a, "ht:create", { nick: "a", grid: g });
  assert.ok(c.ok);
  await ask(b, "ht:join", { code: c.room.code, nick: "b" });
  a.emit("ht:start");
  await wait(300);
  a.emit("ht:move", { cell: 0, name: "Nobody Madeup" });
  await wait(200);
  assert.equal(st.v?.board[0], null, "a name that isn't a footballer takes nothing");
  assert.equal(st.v?.turn, "O");
  // a real footballer who fits square 1 (row 0, col 1)
  const [row, col] = [criterionById(g.rows[0])!, criterionById(g.cols[1])!];
  const fit = GRID_PLAYERS.find((p) => row.test(p) && col.test(p))!;
  b.emit("ht:move", { cell: 1, name: fit.name });
  await wait(200);
  assert.equal(st.v?.board[1]?.name, fit.name);
  // the same name can't be used again, and a footballer who doesn't fit the square is a miss
  const misfit = GRID_PLAYERS.find((p) => !criterionById(g.rows[1])!.test(p))!;
  a.emit("ht:move", { cell: 3, name: misfit.name });
  await wait(200);
  assert.equal(st.v?.board[3], null);
  assert.equal(st.v?.flash?.reason, "wrong");
});

test("Possession: the server works out the claimed hexes", async () => {
  const [a, b] = await Promise.all([client(), client()]);
  type Cell = { mark: string; name: string } | null;
  const st = latest<{ turn: string; owners: Cell[] }>(a, "pp:update");
  const board = Array.from({ length: 31 }, (_, i) => ["spain", "italy", "barcelona", "milan", "inter", "roma", "france", "brazil"][i % 8]);
  const c = await ask<{ ok: boolean; room: { code: string } }>(a, "pp:create", { nick: "a", board });
  assert.ok(c.ok);
  await ask(b, "pp:join", { code: c.room.code, nick: "b" });
  a.emit("pp:start");
  await wait(300);
  // hex 0 is "spain"; claim it and every neighbour with a name that is not a footballer
  a.emit("pp:move", { name: "Nobody Madeup", claims: [0, 1, 4, 5] });
  await wait(200);
  assert.ok(st.v?.owners.every((o) => o === null), "a made-up name takes nothing");
  assert.equal(st.v?.turn, "O");
  // a Spanish player who never played for Italy-board clubs: the phone claims extra hexes, the server keeps only fits
  const spain = criterionById("spain")!;
  const p = GRID_PLAYERS.find((x) => spain.test(x) && !["italy", "barcelona", "milan", "inter", "roma", "france", "brazil"].some((id) => criterionById(id)!.test(x)))!;
  b.emit("pp:move", { name: p.name, claims: [0, 1, 4, 5] });
  await wait(200);
  assert.deepEqual(st.v?.owners.map((o, i) => (o ? i : -1)).filter((i) => i >= 0), [0]);
});

test("Possession: the same footballer in another spelling cannot be claimed twice", async () => {
  const [a, b] = await Promise.all([client(), client()]);
  type Cell = { mark: string; name: string } | null;
  const st = latest<{ turn: string; owners: Cell[] }>(a, "pp:update");
  const board = Array.from({ length: 31 }, (_, i) => ["spain", "italy", "barcelona", "milan", "inter", "roma", "france", "brazil"][i % 8]);
  const c = await ask<{ ok: boolean; room: { code: string } }>(a, "pp:create", { nick: "a", board });
  assert.ok(c.ok);
  await ask(b, "pp:join", { code: c.room.code, nick: "b" });
  a.emit("pp:start");
  await wait(300);
  a.emit("pp:move", { name: null });
  await wait(200);
  // O takes hex 0 ("spain") with a Spanish player
  const p = GRID_PLAYERS.find((x) => criterionById("spain")!.test(x))!;
  b.emit("pp:move", { name: p.name, claims: [0] });
  await wait(200);
  assert.equal(st.v?.owners[0]?.name, p.name);
  assert.equal(st.v?.turn, "X");
  // X replays the same footballer in capitals on another "spain" hex: refused, and the turn stays
  a.emit("pp:move", { name: p.name.toUpperCase(), claims: [8] });
  await wait(200);
  assert.equal(st.v?.owners[8], null, "a used name in another case takes nothing");
  assert.equal(st.v?.turn, "X", "a refused name does not pass the turn");
});

test("Tic-Tac-Toe: two queued players are paired", async () => {
  const [a, b] = await Promise.all([client(), client()]);
  const m = latest<{ code: string }>(a, "ht:matched");
  a.emit("ht:queue", { nick: "a", grid: grid(), tier: 0 });
  b.emit("ht:queue", { nick: "b", grid: grid(), tier: 0 });
  await wait(1500);
  assert.ok(m.v?.code);
});

test("Tic-Tac-Toe: a new game takes both players out of the old room", async () => {
  const [a, b] = await Promise.all([client(), client()]);
  const c = await ask<{ ok: boolean; room: { code: string } }>(a, "ht:create", { nick: "a", grid: grid() });
  await ask(b, "ht:join", { code: c.room.code, nick: "b" });
  a.emit("ht:start");
  await wait(300);
  // both walk away from game 1 without a word (back button) and queue for a new one
  const m = latest<{ code: string }>(a, "ht:matched");
  a.emit("ht:queue", { nick: "a", grid: grid(), tier: 0 });
  b.emit("ht:queue", { nick: "b", grid: grid(), tier: 0 });
  await wait(1500);
  const code2 = m.v?.code ?? "";
  assert.ok(code2 && code2 !== c.room.code);
  // the old room is gone (with its clock), so its updates can't reach the new game
  const old = await ask<{ ok: boolean; error?: string }>(b, "ht:join", { code: c.room.code, nick: "b" });
  assert.equal(old.error, "not_found");
  // a late leave from game 1's screen doesn't take b out of game 2
  b.emit("ht:leave", { code: c.room.code });
  const st = latest<{ code: string; turn: string; started: boolean }>(a, "ht:update");
  a.emit("ht:move", { cell: 0, name: null });
  await wait(300);
  assert.equal(st.v?.code, code2);
  assert.equal(st.v?.started, true, "b is still seated in game 2");
  assert.equal(st.v?.turn, "O", "a's miss passed the turn in game 2");
  // a move out of turn is answered with the room as it is
  const resync = latest<{ turn: string }>(a, "ht:update");
  a.emit("ht:move", { cell: 1, name: null });
  await wait(300);
  assert.equal(resync.v?.turn, "O");
  // leaving game 2 tells the other player
  const left = latest<{ code: string }>(b, "ht:peer-left");
  a.emit("ht:leave", { code: code2 });
  await wait(300);
  assert.equal(left.v?.code, code2);
});

type SeatRoom = { code: string; started: boolean; winner: string | null; players: { id: string; mark: string }[] };
/**
 * Possession, Rondo and Who Am I? (same fix as Tic-Tac-Toe above): a new game takes both players
 * out of the old room, a late leave from the old screen is harmless, and walking out of a live
 * match gives the one who stays the win (`reason` reads where each game puts "left").
 */
async function newGameLeavesOldRoom(g: string, create: object, queue: object, reason: (r: SeatRoom) => string | undefined) {
  const [a, b] = await Promise.all([client(), client()]);
  const c = await ask<{ ok: boolean; room: { code: string } }>(a, `${g}:create`, { nick: "a", ...create });
  assert.ok(c.ok);
  await ask(b, `${g}:join`, { code: c.room.code, nick: "b" });
  a.emit(`${g}:start`);
  await wait(300);
  // both walk away from game 1 without a word (back button) and queue for a new one
  const m = latest<{ code: string }>(a, `${g}:matched`);
  a.emit(`${g}:queue`, { nick: "a", tier: 0, ...queue });
  b.emit(`${g}:queue`, { nick: "b", tier: 0, ...queue });
  await wait(1500);
  const code2 = m.v?.code ?? "";
  assert.ok(code2 && code2 !== c.room.code);
  // the old room is gone (with its clock), so its updates can't reach the new game
  const old = await ask<{ ok: boolean; error?: string }>(b, `${g}:join`, { code: c.room.code, nick: "b" });
  assert.equal(old.error, "not_found");
  // a late leave from game 1's screen doesn't take b out of game 2
  const st = latest<SeatRoom>(a, `${g}:update`);
  b.emit(`${g}:leave`, { code: c.room.code });
  await wait(3000);
  assert.equal(st.v?.code, code2);
  assert.equal(st.v?.started, true, "game 2 started");
  assert.equal(st.v?.players.length, 2, "b is still seated in game 2");
  // a walks out of the live game: b wins it and sees the result
  const left = latest<SeatRoom>(b, `${g}:peer-left`);
  a.emit(`${g}:leave`, { code: code2 });
  await wait(300);
  assert.equal(left.v?.code, code2);
  assert.equal(left.v?.winner, st.v?.players.find((p) => p.id === b.id)?.mark);
  assert.equal(reason(left.v!), "left");
}

test("Possession: a new game takes both players out of the old room", async () => {
  const board = Array.from({ length: 31 }, (_, i) => ["spain", "italy", "barcelona", "milan", "inter", "roma", "france", "brazil"][i % 8]);
  await newGameLeavesOldRoom("pp", { board }, { board }, (r) => (r as SeatRoom & { flash: { reason: string } | null }).flash?.reason);
});

test("Rondo: a new game takes both players out of the old room", async () => {
  await newGameLeavesOldRoom("rd", {}, {}, (r) => (r as SeatRoom & { roundEnd: { reason: string } | null }).roundEnd?.reason);
});

test("Rondo pair: a new game takes both players out of the old room", async () => {
  await newGameLeavesOldRoom("rd", { mode: "pair", target: 2 }, { mode: "pair" }, (r) => (r as SeatRoom & { roundEnd: { reason: string } | null }).roundEnd?.reason);
});

test("Who Am I?: a new game takes both players out of the old room", async () => {
  await newGameLeavesOldRoom("wm", {}, {}, (r) => (r as SeatRoom & { endReason: string | null }).endReason ?? undefined);
});

test("Possession: room, a miss passes the turn", async () => {
  const [a, b] = await Promise.all([client(), client()]);
  const st = latest<{ turn: string; started: boolean }>(a, "pp:update");
  const board = Array.from({ length: 31 }, (_, i) => ["spain", "italy", "barcelona", "milan", "inter", "roma", "france", "brazil"][i % 8]);
  const c = await ask<{ ok: boolean; room: { code: string } }>(a, "pp:create", { nick: "a", board });
  assert.ok(c.ok);
  await ask(b, "pp:join", { code: c.room.code, nick: "b" });
  a.emit("pp:start");
  await wait(300);
  assert.equal(st.v?.started, true);
  a.emit("pp:move", { name: null });
  await wait(200);
  assert.equal(st.v?.turn, "O");
});

test("Card Duel: two queued hands are matched", async () => {
  const [a, b] = await Promise.all([client(), client()]);
  const m = latest<{ code: string }>(a, "dz:matched");
  const theme = themeForDay(Math.floor(Date.now() / 86_400_000));
  a.emit("dz:queue", { nick: "a", hand: houseHand(theme, seededRandom(1)), tier: 0 });
  b.emit("dz:queue", { nick: "b", hand: houseHand(theme, seededRandom(2)), tier: 0 });
  await wait(1500);
  assert.ok(m.v?.code);
});

test("Quiz: the server deals the questions, 50/50 keeps the answer", async () => {
  const [a, b] = await Promise.all([client(), client()]);
  const st = latest<{ phase: string; total: number; answer: number | null }>(a, "qz:update");
  const qs = quizQuestions(3, "players", "easy", seededRandom(4));
  const c = await ask<{ ok: boolean; room: { code: string } }>(a, "qz:create", { nick: "a", settings: { seconds: 15 }, questions: qs });
  assert.ok(c.ok);
  await ask(b, "qz:join", { code: c.room.code, nick: "b" });
  a.emit("qz:start");
  for (let i = 0; i < 40 && st.v?.phase !== "question"; i++) await wait(150);
  assert.equal(st.v?.phase, "question");
  // the phone asked for 3: the server deals its own set, rounded to a length the app offers
  assert.equal(st.v?.total, 5);
  const f = await ask<{ ok: boolean; remove: number[] }>(a, "qz:joker", { kind: "fifty" });
  assert.ok(f.ok);
  assert.equal((await ask<{ ok: boolean }>(a, "qz:joker", { kind: "fifty" })).ok, false, "once a match");
  a.emit("qz:answer", { choice: 0 });
  b.emit("qz:answer", { choice: 0 });
  const phase = () => st.v?.phase as string | undefined;
  for (let i = 0; i < 40 && phase() !== "reveal"; i++) await wait(100);
  assert.equal(phase(), "reveal");
  assert.ok(st.v?.answer != null && !f.remove.includes(st.v.answer));
});

test("Rondo: names are judged by the server, a wrong one only to the mover", async () => {
  const [a, b] = await Promise.all([client(), client()]);
  const st = latest<{ club: string; turn: string; names: { name: string }[] }>(a, "rd:update");
  const wrongA = latest<{ reason: string }>(a, "rd:wrong");
  const wrongB = latest<{ reason: string }>(b, "rd:wrong");
  const c = await ask<{ ok: boolean; room: { code: string } }>(a, "rd:create", { nick: "a" });
  await ask(b, "rd:join", { code: c.room.code, nick: "b" });
  a.emit("rd:start");
  await wait(300);
  a.emit("rd:answer", { name: "zzz nobody" });
  await wait(200);
  assert.equal(wrongA.v?.reason, "unknown");
  assert.equal(wrongB.v, null);
  // right after a wrong name the next one is ignored for a moment (RD_CLUB_MISS_MS)
  a.emit("rd:answer", { name: houseRondoAnswer(st.v!.club, [], 0)! });
  await wait(200);
  assert.equal(st.v?.names.length, 0);
  await wait(300);
  a.emit("rd:answer", { name: houseRondoAnswer(st.v!.club, [], 0)! });
  await wait(200);
  assert.equal(st.v?.names.length, 1);
  assert.equal(st.v?.turn, "O");
});

test("Rondo pair duel: both race, a wrong name locks the box, the first right one takes the hand with the known answers", async () => {
  const [a, b] = await Promise.all([client(), client()]);
  type Room = { mode: string; target: number; pair: string | null; club: string | null; score: Record<string, number>; locked: Record<string, number>; roundEnd: { winner: string | null; reason: string; name?: string; answers?: string[] } | null };
  const st = latest<Room>(a, "rd:update");
  const wrongB = latest<{ reason: string }>(b, "rd:wrong");
  const c = await ask<{ ok: boolean; room: Room & { code: string } }>(a, "rd:create", { nick: "a", mode: "pair", target: 2 });
  assert.equal(c.room.mode, "pair");
  assert.equal(c.room.target, 2);
  await ask(b, "rd:join", { code: c.room.code, nick: "b" });
  a.emit("rd:start");
  await wait(300);
  assert.ok(st.v?.pair, "a pair is dealt");
  assert.equal(st.v?.club, null);
  // b misses: only b hears it, and b's box locks for a moment
  b.emit("rd:answer", { name: "zzz nobody" });
  await wait(200);
  assert.equal(wrongB.v?.reason, "unknown");
  assert.ok((st.v?.locked.O ?? 0) > 0);
  b.emit("rd:answer", { name: rondoPairAnswers(st.v!.pair!)[0] });
  await wait(200);
  assert.equal(st.v?.roundEnd ?? null, null, "a locked player's answer does not count");
  // a takes the hand out of turn: pair mode has no turns
  const best = rondoPairAnswers(st.v!.pair!);
  a.emit("rd:answer", { name: best[1] });
  await wait(200);
  assert.equal(st.v?.score.X, 1);
  assert.equal(st.v?.roundEnd?.reason, "answer");
  assert.equal(st.v?.roundEnd?.winner, "X");
  assert.equal(st.v?.roundEnd?.name, best[1]);
  assert.deepEqual(st.v?.roundEnd?.answers, best);
});

test("Rondo pair duel: an old app can't join a pair room", async () => {
  const [a, old] = await Promise.all([client(), client({ caps: ["mate", "coach", "arab", "hon"] })]);
  const c = await ask<{ ok: boolean; room: { code: string } }>(a, "rd:create", { nick: "a", mode: "pair" });
  const j = await ask<{ ok: boolean; error?: string }>(old, "rd:join", { code: c.room.code, nick: "old" });
  assert.equal(j.ok, false);
  assert.equal(j.error, "update");
  const classic = await ask<{ ok: boolean; room: { code: string } }>(a, "rd:create", { nick: "a" });
  assert.equal((await ask<{ ok: boolean }>(old, "rd:join", { code: classic.room.code, nick: "old" })).ok, true);
});

test("Who Am I?: questions are answered, the player stays hidden", async () => {
  const [a, b] = await Promise.all([client(), client()]);
  const st = latest<{ log: unknown[]; hidden: string | null; hearts: Record<string, number>; turn: string }>(a, "wm:update");
  const c = await ask<{ ok: boolean; room: { code: string; hidden: string | null } }>(a, "wm:create", { nick: "a" });
  assert.equal(c.room.hidden, null);
  await ask(b, "wm:join", { code: c.room.code, nick: "b" });
  a.emit("wm:start");
  await wait(300);
  a.emit("wm:ask", { q: { kind: "pos", id: "F" } });
  await wait(200);
  assert.equal(st.v?.log.length, 1);
  assert.equal(st.v?.hidden, null);
  b.emit("wm:guess", { name: "Zzz Nobody" });
  await wait(200);
  assert.equal(st.v?.hearts.O, 2);
});

test("Reconnect: a short drop keeps the seat, a long one counts as left", async () => {
  const a = await client();
  const b = await client({ rk: "BBBBBBBBBBBBBBBBBBBB" });
  const away = latest<{ away: boolean }>(a, "peer:away");
  let left = false;
  a.on("ht:peer-left", () => (left = true));
  const c = await ask<{ room: { code: string } }>(a, "ht:create", { nick: "a", grid: grid() });
  await ask(b, "ht:join", { code: c.room.code, nick: "b" });
  a.emit("ht:start");
  await wait(300);
  // the phone comes back as a new connection naming its old one and its key
  const b2 = await client({ rk: "BBBBBBBBBBBBBBBBBBBB", prev: b.id });
  let back = false;
  b2.on("seat:back", () => (back = true));
  await wait(400);
  assert.ok(back || away.v?.away === false, "seat handed over");
  // a stranger with the wrong key gets nothing
  const x = await client({ rk: "XXXXXXXXXXXXXXXXXXXX", prev: a.id });
  let stolen = false;
  x.on("seat:back", () => (stolen = true));
  await wait(400);
  assert.equal(stolen, false);
  // gone for good
  b2.io.reconnection(false);
  b2.io.engine.close();
  await wait(REJOIN_MS + 1000);
  assert.ok(left, "seat dropped after REJOIN_MS");
});

test("Blocking keeps two players apart in the queue", async () => {
  const [a0, b0] = await Promise.all([client({ pid: "pidaaaaaaaaaa" }), client({ pid: "pidbbbbbbbbbb" })]);
  const c = await ask<{ room: { code: string } }>(a0, "ht:create", { nick: "a", grid: grid() });
  const j = await ask<{ room: { players: { nick: string; ref: string }[] } }>(b0, "ht:join", { code: c.room.code, nick: "b" });
  const refB = j.room.players.find((p) => p.nick === "b")!.ref;
  assert.match(refB, /^[a-f0-9]{16}$/);
  const [a, b] = await Promise.all([client({ pid: "pidaaaaaaaaaa", blocks: [refB] }), client({ pid: "pidbbbbbbbbbb" })]);
  const m = latest<{ code: string }>(a, "ht:matched");
  a.emit("ht:queue", { nick: "a", grid: grid(), tier: 0 });
  b.emit("ht:queue", { nick: "b", grid: grid(), tier: 0 });
  await wait(1800);
  assert.equal(m.v, null);
  a.emit("ht:unqueue");
  b.emit("ht:unqueue");
});

test("Signed-in players hear their rating change", async () => {
  // (node:sqlite has no type declarations in this project's @types/node)
  const { DatabaseSync } = require("node:sqlite") as { DatabaseSync: new (file: string) => { prepare: (sql: string) => { run: (...v: unknown[]) => void }; close: () => void } };
  const db = new DatabaseSync(join(DATA, "accounts.db"));
  for (const [u, t] of [["u1", "tokA"], ["u2", "tokB"]]) {
    db.prepare("INSERT INTO users (id, provider, sub, nick, avatar, created) VALUES (?,?,?,?,?,?)").run(u, "apple", "s" + u, u, "striker", Date.now());
    db.prepare("INSERT INTO sessions (hash, user_id, created) VALUES (?,?,?)").run(createHash("sha256").update(t).digest("hex"), u, Date.now());
  }
  db.close();
  const [a, b] = await Promise.all([client({ token: "tokA" }), client({ token: "tokB" })]);
  const ea = latest<{ delta: number }>(a, "elo");
  const eb = latest<{ delta: number }>(b, "elo");
  const c = await ask<{ room: { code: string } }>(a, "rd:create", { nick: "a" });
  await ask(b, "rd:join", { code: c.room.code, nick: "b" });
  a.emit("rd:start");
  await wait(300);
  b.emit("rd:forfeit");
  await wait(400);
  assert.ok((ea.v?.delta ?? 0) > 0);
  assert.ok((eb.v?.delta ?? 0) < 0);
});

test("Missing 11 race (web): a room opens", async () => {
  const a = await client();
  const r = await ask<{ ok?: boolean; code?: string; room?: { code: string } }>(a, "room:create", { nick: "a", difficulty: "normal", matchId: "1" });
  assert.ok(r.code || r.room?.code || r.ok);
});

/** a phone losing its connection without a goodbye (tunnel, app in the background) */
const drop = (s: Socket) => {
  s.io.reconnection(false);
  s.io.engine.close();
};

test("Quiz: a dropped player keeps the seat and comes back into the running quiz", async () => {
  const a = await client();
  const b = await client({ rk: "QQQQQQQQQQQQQQQQQQQQ" });
  const st = latest<{ phase: string; players: { id: string }[] }>(a, "qz:update");
  const qs = quizQuestions(5, "players", "easy", seededRandom(5));
  const c = await ask<{ ok: boolean; room: { code: string } }>(a, "qz:create", { nick: "a", settings: { seconds: 15 }, questions: qs });
  await ask(b, "qz:join", { code: c.room.code, nick: "b" });
  a.emit("qz:start");
  for (let i = 0; i < 40 && st.v?.phase !== "question"; i++) await wait(150);
  const oldId = b.id;
  drop(b);
  await wait(400);
  assert.equal(st.v?.players.length, 2, "the seat waits");
  const b2 = await client({ rk: "QQQQQQQQQQQQQQQQQQQQ", prev: oldId });
  const res = await ask<{ ok: boolean; room?: { phase: string; players: { id: string }[] } }>(b2, "qz:join", { code: c.room.code, nick: "b" });
  assert.ok(res.ok, "back in");
  assert.notEqual(res.room?.phase, "lobby");
  assert.ok(res.room?.players.some((p) => p.id === b2.id));
  a.emit("qz:leave");
  b2.emit("qz:leave");
});

test("Lobby: a host who drops keeps the room for REJOIN_MS", async () => {
  const [a, b] = await Promise.all([client(), client()]);
  const c = await ask<{ ok: boolean; room: { code: string } }>(a, "ht:create", { nick: "a", grid: grid() });
  drop(a);
  await wait(400);
  assert.ok((await ask<{ ok: boolean }>(b, "ht:join", { code: c.room.code, nick: "b" })).ok, "room still open");
  b.emit("ht:leave", { code: c.room.code });
});

test("Pitch Chess lobby: a host who drops stays host, marked away", async () => {
  const [a, b] = await Promise.all([client(), client()]);
  const st = latest<{ seats: { host: boolean; away: boolean }[] }>(b, "tt:state");
  const c = await ask<{ ok: boolean; code: string }>(a, "tt:create", { pid: "hostpid01", nick: "a" });
  assert.ok(c.ok);
  assert.ok((await ask<{ ok: boolean }>(b, "tt:join", { code: c.code, pid: "guestpid01", nick: "b" })).ok);
  drop(a);
  await wait(500);
  assert.equal(st.v?.seats.length, 2, "seat kept");
  assert.ok(st.v?.seats[0].host && st.v.seats[0].away, "still host, away");
  b.emit("tt:leave");
});

test("Card Duel: a rematch starts only once both players ask", async () => {
  const [a, b] = await Promise.all([client(), client()]);
  const st = latest<{ game: number; round: number; deadline: number; over: boolean }>(a, "dz:update");
  const theme = themeForDay(Math.floor(Date.now() / 86_400_000));
  const ha = houseHand(theme, seededRandom(11));
  const hb = houseHand(theme, seededRandom(12));
  const c = await ask<{ ok: boolean; room: { code: string } }>(a, "dz:create", { nick: "a", hand: ha });
  assert.ok((await ask<{ ok: boolean }>(b, "dz:join", { code: c.room.code, nick: "b", hand: hb })).ok);
  a.emit("dz:start");
  for (let r = 0; r < 7; r++) {
    for (let i = 0; i < 60 && !(st.v?.round === r && st.v.deadline); i++) await wait(100);
    a.emit("dz:pick", { card: ha[r] });
    b.emit("dz:pick", { card: hb[r] });
  }
  for (let i = 0; i < 30 && !st.v?.over; i++) await wait(100);
  assert.ok(st.v?.over, "match over");
  const game = st.v!.game;
  a.emit("dz:rematch");
  await wait(300);
  assert.ok(st.v?.over && st.v.game === game, "one ask is not enough");
  b.emit("dz:rematch");
  await wait(300);
  assert.ok(!st.v?.over && st.v?.game === game + 1, "both asked: new match");
  a.emit("dz:leave");
  b.emit("dz:leave");
});

/** Accounts with session tokens, written straight into the server's accounts.db. */
function addAccounts(pairs: [string, string][]) {
  // (node:sqlite has no type declarations in this project's @types/node)
  const { DatabaseSync } = require("node:sqlite") as { DatabaseSync: new (file: string) => { prepare: (sql: string) => { run: (...v: unknown[]) => void }; close: () => void } };
  const db = new DatabaseSync(join(DATA, "accounts.db"));
  for (const [u, t] of pairs) {
    db.prepare("INSERT INTO users (id, provider, sub, nick, avatar, created) VALUES (?,?,?,?,?,?)").run(u, "apple", "s" + u, u, "striker", Date.now());
    db.prepare("INSERT INTO sessions (hash, user_id, created) VALUES (?,?,?)").run(createHash("sha256").update(t).digest("hex"), u, Date.now());
  }
  db.close();
}

test("XP: parallel /xp requests can't pass the daily cap, in the total or the week's league", async () => {
  addAccounts([["uxp", "tokXP"]]);
  const http = require("node:http") as typeof import("node:http");
  const { port } = new globalThis.URL(URL);
  // every request is in (user row loaded) before any body arrives
  const reqs = Array.from({ length: 20 }, (_, i) => {
    const r = http.request({ port, method: "POST", path: "/api/account/xp", headers: { authorization: "Bearer tokXP", "content-type": "application/json" } });
    const done = new Promise<void>((ok) => r.on("response", (res) => (res.resume(), res.on("end", ok))));
    r.flushHeaders();
    return { r, i, done };
  });
  await wait(300);
  for (const { r, i } of reqs) r.end(JSON.stringify({ awards: [{ key: `par-${i}`, game: "qz", amount: 200 }] }));
  await Promise.all(reqs.map((x) => x.done));
  const { DatabaseSync } = require("node:sqlite") as { DatabaseSync: new (file: string) => { prepare: (sql: string) => { get: (...v: unknown[]) => Record<string, number> }; close: () => void } };
  const db = new DatabaseSync(join(DATA, "accounts.db"));
  const u = db.prepare("SELECT xp, xp_today FROM users WHERE id = ?").get("uxp");
  const league = db.prepare("SELECT SUM(xp) AS xp FROM league_members WHERE user_id = ?").get("uxp");
  db.close();
  assert.equal(u.xp, 3000);
  assert.equal(u.xp_today, 3000);
  assert.equal(league.xp, 3000);
});

test("Card Duel: leaving a live match is rated at most 3 times a day for the same two accounts", async () => {
  addAccounts([["udz1", "tokDZ1"], ["udz2", "tokDZ2"]]);
  const [a, b] = await Promise.all([client({ token: "tokDZ1" }), client({ token: "tokDZ2" })]);
  let elos = 0;
  a.on("elo", () => elos++);
  const theme = themeForDay(Math.floor(Date.now() / 86_400_000));
  const ha = houseHand(theme, seededRandom(21));
  const hb = houseHand(theme, seededRandom(22));
  const c = await ask<{ ok: boolean; room: { code: string } }>(a, "dz:create", { nick: "a", hand: ha });
  for (let i = 0; i < 5; i++) {
    assert.ok((await ask<{ ok: boolean }>(b, "dz:join", { code: c.room.code, nick: "b", hand: hb })).ok);
    a.emit("dz:start");
    await wait(150);
    b.emit("dz:leave");
    await wait(150);
  }
  assert.equal(elos, 3);
  a.emit("dz:leave");
});

test("Quiz: the same two accounts get at most 3 rated quizzes a day", async () => {
  addAccounts([["uqz1", "tokQZ1"], ["uqz2", "tokQZ2"]]);
  // four rooms at once, each player on its own socket per room
  let elos = 0;
  const answer = (s: Socket) => s.on("qz:update", (v: { phase: string }) => v.phase === "question" && s.emit("qz:answer", { choice: 0 }));
  const done: Promise<void>[] = [];
  for (let i = 0; i < 4; i++) {
    const [a, b] = await Promise.all([client({ token: "tokQZ1" }), client({ token: "tokQZ2" })]);
    a.on("elo", () => elos++);
    answer(a);
    answer(b);
    const qs = quizQuestions(5, "players", "easy", seededRandom(30 + i));
    const c = await ask<{ ok: boolean; room: { code: string } }>(a, "qz:create", { nick: "a", settings: { seconds: 15 }, questions: qs });
    await ask(b, "qz:join", { code: c.room.code, nick: "b" });
    done.push(new Promise((ok) => a.on("qz:update", (v: { phase: string }) => v.phase === "done" && ok())));
    a.emit("qz:start");
  }
  await Promise.all(done);
  await wait(300);
  assert.equal(elos, 3);
});

test("Reports: a guest's report is kept but marked as not signed in", async () => {
  const s = await client({ pid: "reporterguest01" });
  const target = createHash("sha256").update("x").digest("hex").slice(0, 16);
  assert.ok((await ask<{ ok: boolean }>(s, "rep:send", { ref: target, reason: "nick" })).ok);
  await wait(200);
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  const line = readFileSync(join(DATA, "reports.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l)).find((r) => r.ref === target);
  assert.equal(line?.signed, false);
});
