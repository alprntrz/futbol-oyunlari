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
import { houseRondoAnswer } from "@/lib/rondo";
import { generateGrid, seededRandom } from "@/lib/tiki";

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

const CAPS = ["mate", "coach", "arab", "hon"];
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

test("Tic-Tac-Toe: two queued players are paired", async () => {
  const [a, b] = await Promise.all([client(), client()]);
  const m = latest<{ code: string }>(a, "ht:matched");
  a.emit("ht:queue", { nick: "a", grid: grid(), tier: 0 });
  b.emit("ht:queue", { nick: "b", grid: grid(), tier: 0 });
  await wait(1500);
  assert.ok(m.v?.code);
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

test("Quiz: room, start, 50/50 keeps the answer", async () => {
  const [a, b] = await Promise.all([client(), client()]);
  const st = latest<{ phase: string }>(a, "qz:update");
  const qs = quizQuestions(3, "players", "easy", seededRandom(4));
  const c = await ask<{ ok: boolean; room: { code: string } }>(a, "qz:create", { nick: "a", settings: { seconds: 15 }, questions: qs });
  assert.ok(c.ok);
  await ask(b, "qz:join", { code: c.room.code, nick: "b" });
  a.emit("qz:start");
  for (let i = 0; i < 40 && st.v?.phase !== "question"; i++) await wait(150);
  assert.equal(st.v?.phase, "question");
  const f = await ask<{ ok: boolean; remove: number[] }>(a, "qz:joker", { kind: "fifty" });
  assert.ok(f.ok);
  assert.ok(!f.remove.includes(qs[0].answer));
  assert.equal((await ask<{ ok: boolean }>(a, "qz:joker", { kind: "fifty" })).ok, false, "once a match");
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
  a.emit("rd:answer", { name: houseRondoAnswer(st.v!.club, [], 0)! });
  await wait(200);
  assert.equal(st.v?.names.length, 1);
  assert.equal(st.v?.turn, "O");
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
