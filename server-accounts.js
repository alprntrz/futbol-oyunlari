/**
 * Accounts for the app (v1.1): Sign in with Apple / Google, a session token, and
 * the player's XP kept on the server so it follows them to a new phone.
 *
 * Privacy (keep site/privacy.html true): we store the provider + its opaque user
 * id, nickname, avatar id and XP. No e-mail, no name, no IP. Deleting the account
 * removes every row and revokes the Apple token.
 *
 * Storage: node:sqlite in ACCOUNTS_DB (default data/accounts.db; on Fly /data).
 *
 * Env:
 *   APPLE_AUDIENCES   bundle ids accepted in Apple tokens (default com.alprntrz.tiktako)
 *   GOOGLE_CLIENT_IDS OAuth client ids accepted in Google tokens (comma separated)
 *   APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY  Sign in with Apple key, used to
 *                     exchange the auth code and revoke tokens on account deletion
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const DB_FILE = process.env.ACCOUNTS_DB || path.join(__dirname, "data", "accounts.db");
const APPLE_AUD = (process.env.APPLE_AUDIENCES || "com.alprntrz.tiktako").split(",").map((s) => s.trim()).filter(Boolean);
const GOOGLE_AUD = (process.env.GOOGLE_CLIENT_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
const DAILY_BONUS = 20;
const GAMES = new Set(["xi", "ht", "qz", "mystery", "bingo", "pp"]);
const AVATARS = new Set(Array.from({ length: 12 }, (_, i) => `c${i + 1}`));
const MAX_AWARD = 200; // one game never pays more than this (quiz max is ~140)

fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
const db = new DatabaseSync(DB_FILE);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    sub TEXT NOT NULL,
    nick TEXT NOT NULL DEFAULT '',
    avatar TEXT NOT NULL DEFAULT 'c1',
    xp INTEGER NOT NULL DEFAULT 0,
    by_game TEXT NOT NULL DEFAULT '{}',
    bonus_day TEXT NOT NULL DEFAULT '',
    apple_refresh TEXT,
    created INTEGER NOT NULL,
    UNIQUE (provider, sub)
  );
  CREATE TABLE IF NOT EXISTS sessions (
    hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS awards (
    user_id TEXT NOT NULL,
    key TEXT NOT NULL,
    PRIMARY KEY (user_id, key)
  );
`);

// jose is ESM-only on some installs; load it lazily
let josePromise = null;
const jose = () => (josePromise ??= import("jose"));
let appleKeys = null;
let googleKeys = null;

async function verifyApple(token) {
  const { createRemoteJWKSet, jwtVerify } = await jose();
  appleKeys ??= createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));
  const { payload } = await jwtVerify(token, appleKeys, { issuer: "https://appleid.apple.com", audience: APPLE_AUD });
  return String(payload.sub);
}

async function verifyGoogle(token) {
  if (!GOOGLE_AUD.length) throw new Error("google not configured");
  const { createRemoteJWKSet, jwtVerify } = await jose();
  googleKeys ??= createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
  const { payload } = await jwtVerify(token, googleKeys, { issuer: ["https://accounts.google.com", "accounts.google.com"], audience: GOOGLE_AUD });
  return String(payload.sub);
}

/** Client secret for Apple's token endpoints (a short-lived ES256 JWT). */
async function appleClientSecret() {
  const { APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY } = process.env;
  if (!APPLE_TEAM_ID || !APPLE_KEY_ID || !APPLE_PRIVATE_KEY) return null;
  const { SignJWT, importPKCS8 } = await jose();
  const key = await importPKCS8(APPLE_PRIVATE_KEY.replace(/\\n/g, "\n"), "ES256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: APPLE_KEY_ID })
    .setIssuer(APPLE_TEAM_ID)
    .setIssuedAt()
    .setExpirationTime("5m")
    .setAudience("https://appleid.apple.com")
    .setSubject(APPLE_AUD[0])
    .sign(key);
}

async function appleForm(endpoint, fields) {
  const secret = await appleClientSecret();
  if (!secret) return null;
  const body = new URLSearchParams({ client_id: APPLE_AUD[0], client_secret: secret, ...fields });
  const res = await fetch(`https://appleid.apple.com/auth/${endpoint}`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
  return res.ok ? (endpoint === "token" ? res.json() : {}) : null;
}

const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const today = () => new Date().toISOString().slice(0, 10);

function publicUser(u) {
  return { id: u.id, provider: u.provider, nick: u.nick, avatar: u.avatar, xp: u.xp, byGame: JSON.parse(u.by_game || "{}"), bonusToday: u.bonus_day === today() };
}

function userFromRequest(req) {
  const m = /^Bearer (\S+)$/.exec(req.headers.authorization || "");
  if (!m) return null;
  const s = db.prepare("SELECT user_id FROM sessions WHERE hash = ?").get(sha(m[1]));
  return s ? db.prepare("SELECT * FROM users WHERE id = ?").get(s.user_id) : null;
}

function addXp(user, key, game, amount, cap = MAX_AWARD) {
  if (!GAMES.has(game)) return false;
  const gained = Math.max(0, Math.min(cap, Math.round(Number(amount) || 0)));
  if (!gained) return false;
  const k = String(key).slice(0, 120);
  const fresh = db.prepare("INSERT OR IGNORE INTO awards (user_id, key) VALUES (?, ?)").run(user.id, k).changes > 0;
  if (!fresh) return false;
  const byGame = JSON.parse(user.by_game || "{}");
  byGame[game] = (byGame[game] || 0) + gained;
  user.xp += gained;
  user.by_game = JSON.stringify(byGame);
  db.prepare("UPDATE users SET xp = ?, by_game = ? WHERE id = ?").run(user.xp, user.by_game, user.id);
  return true;
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 32 * 1024) throw new Error("too large");
  }
  return raw ? JSON.parse(raw) : {};
}

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

/**
 * /api/account/* routes. Returns true when it handled the request.
 * `cleanNick` is server.js's nickname filter.
 */
async function handleAccountApi(req, res, cleanNick) {
  const url = req.url.split("?")[0];
  if (!url.startsWith("/api/account")) return false;
  try {
    // Sign in (or up): verify the provider's token, open a session
    if (url === "/api/account/signin" && req.method === "POST") {
      const b = await readJson(req);
      const provider = b.provider === "google" ? "google" : b.provider === "apple" ? "apple" : null;
      if (!provider || typeof b.token !== "string") return send(res, 400, { error: "bad request" }), true;
      let sub;
      try {
        sub = provider === "apple" ? await verifyApple(b.token) : await verifyGoogle(b.token);
      } catch {
        return send(res, 401, { error: "invalid token" }), true;
      }
      let user = db.prepare("SELECT * FROM users WHERE provider = ? AND sub = ?").get(provider, sub);
      const isNew = !user;
      if (!user) {
        const id = crypto.randomUUID();
        const nick = cleanNick(String(b.nick || "")) || "";
        const avatar = AVATARS.has(b.avatar) ? b.avatar : "c1";
        db.prepare("INSERT INTO users (id, provider, sub, nick, avatar, created) VALUES (?, ?, ?, ?, ?, ?)").run(id, provider, sub, nick, avatar, Date.now());
        user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
      }
      // Apple: keep the refresh token so account deletion can revoke it
      if (provider === "apple" && typeof b.authorizationCode === "string" && !user.apple_refresh) {
        const tok = await appleForm("token", { grant_type: "authorization_code", code: b.authorizationCode }).catch(() => null);
        if (tok?.refresh_token) db.prepare("UPDATE users SET apple_refresh = ? WHERE id = ?").run(tok.refresh_token, user.id);
      }
      // the XP this phone earned as a guest moves into the account, once
      const guest = b.guest && typeof b.guest === "object" ? b.guest : null;
      if (guest && typeof b.installId === "string") {
        for (const [game, amount] of Object.entries(guest.byGame || {})) addXp(user, `import-${b.installId}-${game}`, game, amount, 50000);
      }
      const token = crypto.randomBytes(32).toString("base64url");
      db.prepare("INSERT INTO sessions (hash, user_id, created) VALUES (?, ?, ?)").run(sha(token), user.id, Date.now());
      return send(res, 200, { token, isNew, user: publicUser(db.prepare("SELECT * FROM users WHERE id = ?").get(user.id)) }), true;
    }

    const user = userFromRequest(req);
    if (!user) return send(res, 401, { error: "signed out" }), true;

    if (url === "/api/account/me" && req.method === "GET") return send(res, 200, { user: publicUser(user) }), true;

    // XP awards made on the phone; each key counts once (same rule as the phone)
    if (url === "/api/account/xp" && req.method === "POST") {
      const b = await readJson(req);
      const list = Array.isArray(b.awards) ? b.awards.slice(0, 50) : [];
      for (const a of list) addXp(user, a.key, a.game, a.amount);
      return send(res, 200, { user: publicUser(user) }), true;
    }

    // Daily sign-in bonus, once per UTC day
    if (url === "/api/account/daily" && req.method === "POST") {
      const day = today();
      let gained = 0;
      if (user.bonus_day !== day) {
        // not a game: it adds to the total only
        user.bonus_day = day;
        user.xp += DAILY_BONUS;
        db.prepare("UPDATE users SET bonus_day = ?, xp = ? WHERE id = ?").run(day, user.xp, user.id);
        gained = DAILY_BONUS;
      }
      return send(res, 200, { gained, user: publicUser(user) }), true;
    }

    if (url === "/api/account/profile" && req.method === "PUT") {
      const b = await readJson(req);
      const nick = b.nick !== undefined ? cleanNick(String(b.nick)) || user.nick : user.nick;
      const avatar = AVATARS.has(b.avatar) ? b.avatar : user.avatar;
      db.prepare("UPDATE users SET nick = ?, avatar = ? WHERE id = ?").run(nick, avatar, user.id);
      return send(res, 200, { user: publicUser({ ...user, nick, avatar }) }), true;
    }

    if (url === "/api/account/signout" && req.method === "POST") {
      const m = /^Bearer (\S+)$/.exec(req.headers.authorization || "");
      db.prepare("DELETE FROM sessions WHERE hash = ?").run(sha(m[1]));
      return send(res, 200, { ok: true }), true;
    }

    // Delete the account and everything tied to it (Guideline 5.1.1(v))
    if (url === "/api/account" && req.method === "DELETE") {
      if (user.apple_refresh) await appleForm("revoke", { token: user.apple_refresh, token_type_hint: "refresh_token" }).catch(() => null);
      db.prepare("DELETE FROM awards WHERE user_id = ?").run(user.id);
      db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);
      db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
      return send(res, 200, { ok: true }), true;
    }

    return send(res, 404, { error: "not found" }), true;
  } catch {
    return send(res, 400, { error: "bad request" }), true;
  }
}

module.exports = { handleAccountApi };
