/**
 * Push notifications end to end (server-push.js via server-accounts.js / server.js): server.js runs
 * on a free port with a throwaway database, and a local HTTP stub stands in for Expo's push service
 * (PUSH_ENDPOINT), so no real network is used. Accounts and sessions are written straight into the
 * database, as in server.int.test.mts.
 */
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { createServer as createHttpServer, type Server } from "node:http";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, test } from "node:test";

import { generateGrid, seededRandom } from "@/lib/tiki";

const require = createRequire(import.meta.url);
const { io } = require("socket.io-client") as typeof import("socket.io-client");
type Socket = import("socket.io-client").Socket;

type Row = Record<string, unknown>;
type Db = { prepare: (sql: string) => { run: (...v: unknown[]) => void; get: (...v: unknown[]) => Row | undefined; all: (...v: unknown[]) => Row[] }; close: () => void };
// (node:sqlite has no type declarations in this project's @types/node)
const { DatabaseSync } = require("node:sqlite") as { DatabaseSync: new (file: string) => Db };

const DATA = mkdtempSync(join(tmpdir(), "tiktako-push-"));
const DB_FILE = join(DATA, "accounts.db");
const ADMIN = "test-admin-token";
let URL = "";
let server: ChildProcess;
let stub: Server;
const open: Socket[] = [];

/** What the stub Expo service got: messages sent, receipt ids asked for. */
type Message = { to: string; title: string; body: string; data: Record<string, string>; channelId: string };
let sent: Message[] = [];
const DEAD = "ExponentPushToken[deaddeaddead]";
const LATE_DEAD = "ExponentPushToken[latedeadlate]";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const freePort = () =>
  new Promise<number>((resolve) => {
    const s = createServer();
    s.listen(0, () => {
      const port = (s.address() as { port: number }).port;
      s.close(() => resolve(port));
    });
  });

/** Expo's push API as far as the server uses it: tickets per message, receipts per id. */
function startStub(port: number) {
  stub = createHttpServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const body = JSON.parse(raw || "null");
      res.writeHead(200, { "content-type": "application/json" });
      if (req.url === "/send") {
        const list = body as Message[];
        sent.push(...list);
        const data = list.map((m, i) =>
          m.to === DEAD ? { status: "error", message: "gone", details: { error: "DeviceNotRegistered" } } : { status: "ok", id: m.to === LATE_DEAD ? "late-dead" : `ticket-${i}` }
        );
        return res.end(JSON.stringify({ data }));
      }
      const ids = (body as { ids: string[] }).ids;
      const data = Object.fromEntries(ids.map((id) => [id, id === "late-dead" ? { status: "error", details: { error: "DeviceNotRegistered" } } : { status: "ok" }]));
      res.end(JSON.stringify({ data }));
    });
  });
  return new Promise<void>((r) => stub.listen(port, r));
}

before(async () => {
  const [port, stubPort] = await Promise.all([freePort(), freePort()]);
  await startStub(stubPort);
  URL = `http://localhost:${port}`;
  server = spawn(process.execPath, ["server.js"], {
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "production",
      SOCKETS_ONLY: "1",
      ACCOUNTS_DB: DB_FILE,
      QZ_STATS_FILE: join(DATA, "qz.json"),
      PUSH_ENDPOINT: `http://localhost:${stubPort}/send`,
      PUSH_RECEIPT_ENDPOINT: `http://localhost:${stubPort}/getReceipts`,
      PUSH_RECEIPT_DELAY_MS: "300",
      PUSH_ADMIN_TOKEN: ADMIN,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("server did not start")), 20_000);
    server.stdout!.on("data", (d) => String(d).includes("Ready on") && (clearTimeout(t), resolve()));
    server.on("exit", (c) => reject(new Error(`server exited ${c}`)));
  });
});

after(() => {
  for (const s of open) s.close();
  server?.kill();
  stub?.close();
});

beforeEach(() => {
  sent = [];
});

const db = () => new DatabaseSync(DB_FILE);
let users = 0;
/** A signed-in account straight in the database: its id, session token and friend code. */
function makeUser(nick: string) {
  const n = ++users;
  const id = `push-u${n}`;
  const token = `push-session-${n}`;
  const code = `PSH${String(n).padStart(3, "0")}`;
  const d = db();
  d.prepare("INSERT INTO users (id, provider, sub, nick, avatar, created, friend_code) VALUES (?,?,?,?,?,?,?)").run(id, "apple", "s" + id, nick, "striker", Date.now(), code);
  d.prepare("INSERT INTO sessions (hash, user_id, created) VALUES (?,?,?)").run(createHash("sha256").update(token).digest("hex"), id, Date.now());
  d.close();
  return { id, token, code };
}
function befriend(a: string, b: string) {
  const d = db();
  for (const [x, y] of [[a, b], [b, a]]) d.prepare("INSERT INTO friends (user_id, friend_id, created) VALUES (?,?,?)").run(x, y, Date.now());
  d.close();
}
const tokensOf = (uid: string) => {
  const d = db();
  const rows = d.prepare("SELECT token, lang, invites, friends, news FROM push_tokens WHERE user_id = ? ORDER BY updated").all(uid);
  d.close();
  return rows;
};
const tokenFor = (n: number | string) => `ExponentPushToken[test${String(n).padStart(8, "0")}]`;

function api(path: string, session: string | null, method: string, body?: unknown) {
  return fetch(`${URL}/api/account${path}`, {
    method,
    headers: { "content-type": "application/json", ...(session ? { authorization: `Bearer ${session}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const register = (session: string, token: string, extra: Record<string, unknown> = {}) => api("/push", session, "POST", { token, platform: "ios", lang: "en", ...extra });

function client(auth: Record<string, unknown> = {}): Promise<Socket> {
  const s = io(URL, { transports: ["websocket"], forceNew: true, auth: { caps: ["mate", "coach", "arab", "hon"], ...auth } });
  open.push(s);
  return new Promise((r) => s.on("connect", () => r(s)));
}
const ask = <T,>(s: Socket, event: string, payload: unknown = {}) => new Promise<T>((r) => s.emit(event, payload, r));
const grid = () => {
  const g = generateGrid(seededRandom(7));
  return { rows: g.rows.map((c) => c.id), cols: g.cols.map((c) => c.id) };
};

test("push token: needs a session, checks token, platform; default switches", async () => {
  const u = makeUser("alice");
  assert.equal((await api("/push", null, "POST", { token: tokenFor(1), platform: "ios" })).status, 401);
  assert.equal((await register(u.token, "not-a-token")).status, 400);
  assert.equal((await register(u.token, `ExponentPushToken[${"x".repeat(300)}]`)).status, 400);
  assert.equal((await register(u.token, tokenFor(1), { platform: "windows" })).status, 400);
  const r = await register(u.token, tokenFor(1), { lang: "TURKISH" });
  assert.equal(r.status, 200);
  assert.deepEqual((await r.json()).prefs, { invites: true, friends: true, news: false });
  assert.deepEqual(tokensOf(u.id).map((t) => [t.lang, t.invites, t.friends, t.news]), [["en", 1, 1, 0]]);
});

test("push token: switches update, delete removes, at most 5 per account", async () => {
  const u = makeUser("bob");
  await register(u.token, tokenFor(10), { lang: "tr", prefs: { news: true, friends: false } });
  assert.deepEqual(tokensOf(u.id).map((t) => [t.lang, t.invites, t.friends, t.news]), [["tr", 1, 0, 1]]);
  // a re-register without prefs keeps the switches
  await register(u.token, tokenFor(10), { lang: "tr" });
  assert.equal(tokensOf(u.id)[0].news, 1);
  for (let i = 11; i <= 16; i++) {
    await register(u.token, tokenFor(i));
    await wait(5);
  }
  const left = tokensOf(u.id).map((t) => t.token);
  assert.equal(left.length, 5);
  assert.ok(!left.includes(tokenFor(10)) && !left.includes(tokenFor(11)), "the oldest went");
  assert.equal((await api("/push", u.token, "DELETE", { token: tokenFor(16) })).status, 200);
  assert.equal(tokensOf(u.id).length, 4);
  // another account can't delete my token
  const other = makeUser("mallory");
  await api("/push", other.token, "DELETE", { token: tokenFor(15) });
  assert.equal(tokensOf(u.id).length, 4);
});

test("signing out with the token and deleting the account remove tokens", async () => {
  const u = makeUser("carol");
  await register(u.token, tokenFor(20));
  await api("/signout", u.token, "POST", { pushToken: tokenFor(20) });
  assert.equal(tokensOf(u.id).length, 0);
  const v = makeUser("dave");
  await register(v.token, tokenFor(21));
  await register(v.token, tokenFor(22));
  assert.equal((await api("", v.token, "DELETE")).status, 200);
  assert.equal(tokensOf(v.id).length, 0);
});

test("invite to a friend whose app is closed goes out as a push; switch off = offline", async () => {
  const host = makeUser("Hosty");
  const friend = makeUser("Frieda");
  befriend(host.id, friend.id);
  await register(friend.token, tokenFor(30), { lang: "tr" });
  const a = await client({ token: host.token });
  const room = (await ask<{ room: { code: string } }>(a, "ht:create", { nick: "Hosty", grid: grid() })).room.code;
  const r = await ask<{ ok: boolean; push?: boolean }>(a, "fr:invite", { to: friend.code, game: "ht", room });
  assert.deepEqual(r, { ok: true, push: true });
  await wait(300);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, tokenFor(30));
  assert.equal(sent[0].body, "Hosty seni Tic-Tac-Toe oynamaya çağırıyor");
  assert.deepEqual(sent[0].data, { type: "invite", game: "ht", room, category: "invites" });
  assert.equal(sent[0].channelId, "invites");
  // invites switched off: no push, and the friend counts as offline again
  await register(friend.token, tokenFor(30), { prefs: { invites: false } });
  await wait(3100); // the 3 s invite rate limit
  const r2 = await ask<{ ok: boolean; error?: string }>(a, "fr:invite", { to: friend.code, game: "ht", room });
  assert.deepEqual(r2, { ok: false, error: "offline" });
});

test("invite: a friend with the app open gets the banner, no push; in the background gets both", async () => {
  const host = makeUser("Hana");
  const friend = makeUser("Ferd");
  befriend(host.id, friend.id);
  await register(friend.token, tokenFor(40));
  const [a, b] = await Promise.all([client({ token: host.token }), client({ token: friend.token })]);
  const banners: unknown[] = [];
  b.on("fr:invited", (i) => banners.push(i));
  const room = (await ask<{ room: { code: string } }>(a, "ht:create", { nick: "Hana", grid: grid() })).room.code;
  assert.deepEqual(await ask(a, "fr:invite", { to: friend.code, game: "ht", room }), { ok: true });
  await wait(300);
  assert.equal(banners.length, 1);
  assert.equal(sent.length, 0);
  b.emit("app:state", { active: false });
  await wait(3100);
  assert.deepEqual(await ask(a, "fr:invite", { to: friend.code, game: "ht", room }), { ok: true, push: true });
  await wait(300);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].body, "Hana invited you to play Tic-Tac-Toe");
});

test("invite: no push when the friend's phone blocked the sender", async () => {
  const host = makeUser("Blocked");
  const friend = makeUser("Blocker");
  befriend(host.id, friend.id);
  await register(friend.token, tokenFor(50));
  // learn the host's ref from a room seat, then the friend's phone sends its block list and goes away
  const a = await client({ token: host.token });
  const room = await ask<{ room: { code: string; players: { ref: string }[] } }>(a, "ht:create", { nick: "Blocked", grid: grid() });
  const hostRef = room.room.players[0].ref;
  const b = await client({ token: friend.token, blocks: [hostRef] });
  b.close();
  await wait(200);
  const r = await ask<{ ok: boolean; error?: string }>(a, "fr:invite", { to: friend.code, game: "ht", room: room.room.code });
  assert.deepEqual(r, { ok: false, error: "offline" });
  await wait(300);
  assert.equal(sent.length, 0);
});

test("being added as a friend sends a 'friends' push", async () => {
  const adder = makeUser("Adder");
  const added = makeUser("Addee");
  await register(added.token, tokenFor(60));
  assert.equal((await api("/friends", adder.token, "POST", { code: added.code })).status, 200);
  await wait(300);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].body, "Adder added you as a friend");
  assert.deepEqual(sent[0].data, { type: "friend", category: "friends" });
});

test("dead tokens are dropped from tickets and from receipts", async () => {
  const host = makeUser("Deadhost");
  const f1 = makeUser("Dead1");
  const f2 = makeUser("Dead2");
  befriend(host.id, f1.id);
  befriend(host.id, f2.id);
  await register(f1.token, DEAD);
  await register(f2.token, LATE_DEAD);
  const a = await client({ token: host.token });
  const room = (await ask<{ room: { code: string } }>(a, "ht:create", { nick: "Deadhost", grid: grid() })).room.code;
  await ask(a, "fr:invite", { to: f1.code, game: "ht", room });
  await wait(300);
  assert.equal(tokensOf(f1.id).length, 0, "ticket said DeviceNotRegistered");
  await wait(3000);
  await ask(a, "fr:invite", { to: f2.code, game: "ht", room });
  await wait(1000);
  assert.equal(tokensOf(f2.id).length, 0, "receipt said DeviceNotRegistered");
});

test("admin news push: token required, only phones that opted in", async () => {
  const yes = makeUser("NewsYes");
  const no = makeUser("NewsNo");
  await register(yes.token, tokenFor(70), { lang: "tr", prefs: { news: true } });
  await register(no.token, tokenFor(71));
  const post = (auth: string | null, body: unknown) =>
    fetch(`${URL}/api/admin/push`, { method: "POST", headers: { "content-type": "application/json", ...(auth ? { authorization: auth } : {}) }, body: JSON.stringify(body) });
  const news = { title_tr: "Yeni oyun", body_tr: "Rondo geldi", title_en: "New game", body_en: "Rondo is here" };
  assert.equal((await post(null, news)).status, 401);
  assert.equal((await post("Bearer wrong", news)).status, 401);
  assert.equal((await post(`Bearer ${ADMIN}`, { title_tr: "x" })).status, 400);
  const r = await post(`Bearer ${ADMIN}`, news);
  assert.equal(r.status, 200);
  const tos = sent.map((m) => m.to);
  assert.ok(tos.includes(tokenFor(70)));
  assert.ok(!tos.includes(tokenFor(71)), "news is off by default");
  assert.deepEqual(
    sent.filter((m) => m.to === tokenFor(70)).map((m) => [m.title, m.body]),
    [["Yeni oyun", "Rondo geldi"]]
  );
});
