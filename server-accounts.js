/**
 * Accounts for the app (v1.1): Sign in with Apple / Google, a session token, and
 * the player's XP kept on the server so it follows them to a new phone.
 *
 * Privacy (keep site/privacy.html true): we store the provider + its opaque user
 * id, nickname, avatar id, avatar frame and XP. No e-mail, no name, no IP. Deleting the account
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
const { refForUser, shownNick } = require("./server-refs");

const DB_FILE = process.env.ACCOUNTS_DB || path.join(__dirname, "data", "accounts.db");
const APPLE_AUD = (process.env.APPLE_AUDIENCES || "com.alprntrz.tiktako").split(",").map((s) => s.trim()).filter(Boolean);
const GOOGLE_AUD = (process.env.GOOGLE_CLIENT_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
const DAILY_BONUS = 20;
// "bonus": daily reward calendar and quests (not a game, kept apart in by_game)
const GAMES = new Set(["xi", "ht", "qz", "mystery", "bingo", "pp", "tt", "dz", "bonus"]);
// preset ids (mobile/src/lib/avatar.ts); c1..c12 are the colour ids of early v1.1 builds
const AVATARS = new Set([
  ...["striker", "keeper", "captain", "playmaker", "coach", "fan", "referee", "ball"],
  ...["curls", "mohawk", "bun", "bald", "braids", "shades", "celebration", "retro-keeper"].map((x) => `legend-${x}`),
  ...Array.from({ length: 12 }, (_, i) => `c${i + 1}`),
]);
const MAX_AWARD = 200; // one game never pays more than this (quiz max is ~140)
// game XP an account can bank in one UTC day: far above a long day of play, but a
// tampered phone can't push itself to the top of the boards and the league
const DAILY_XP_CAP = 3000;

fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
const db = new DatabaseSync(DB_FILE);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    sub TEXT NOT NULL,
    nick TEXT NOT NULL DEFAULT '',
    avatar TEXT NOT NULL DEFAULT 'striker',
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
  CREATE TABLE IF NOT EXISTS ratings (
    user_id TEXT NOT NULL,
    game TEXT NOT NULL,
    rating REAL NOT NULL DEFAULT 1000,
    games INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, game)
  );
  CREATE TABLE IF NOT EXISTS awards (
    user_id TEXT NOT NULL,
    key TEXT NOT NULL,
    PRIMARY KEY (user_id, key)
  );
  CREATE TABLE IF NOT EXISTS friends (
    user_id TEXT NOT NULL,
    friend_id TEXT NOT NULL,
    created INTEGER NOT NULL,
    PRIMARY KEY (user_id, friend_id)
  );
`);
// friend code: a short public handle to share (users added later get one on first use)
if (!db.prepare("PRAGMA table_info(users)").all().some((c) => c.name === "friend_code")) db.exec("ALTER TABLE users ADD COLUMN friend_code TEXT");
// avatar frame the player picked ('' = the best their rank has opened)
if (!db.prepare("PRAGMA table_info(users)").all().some((c) => c.name === "frame")) db.exec("ALTER TABLE users ADD COLUMN frame TEXT NOT NULL DEFAULT ''");
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS users_friend_code ON users (friend_code)");

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

// Avatar frames open with the rank (mobile/src/lib/cosmetics.ts FRAMES, src/lib/levels.ts RANKS)
const FRAME_RANK = { none: 0, bronze: 1, silver: 2, gold: 3, emerald: 4, galaxy: 5, legend: 6 };
const FRAME_BY_RANK = ["none", "bronze", "silver", "gold", "emerald", "galaxy", "legend"];
const RANK_FROM = [1, 5, 10, 15, 20, 30, 40];
const rankIndex = (xp) => {
  const level = levelOf(xp);
  let i = 0;
  while (i + 1 < RANK_FROM.length && level >= RANK_FROM[i + 1]) i++;
  return i;
};
/** the frame others see: the pick if the rank has opened it, else the best open one */
const frameOf = (u) => {
  const rank = rankIndex(u.xp ?? 0);
  return u.frame && FRAME_RANK[u.frame] !== undefined && FRAME_RANK[u.frame] <= rank ? u.frame : FRAME_BY_RANK[rank];
};

/**
 * The look a phone shows strangers in a random match (avatar + frame), checked:
 * a known avatar id, and a frame the sent rank has opened. Old apps send none.
 */
function cleanLook({ avatar, frame } = {}, tier = 0) {
  return {
    avatar: AVATARS.has(avatar) ? avatar : null,
    frame: FRAME_RANK[frame] !== undefined && FRAME_RANK[frame] <= tier ? frame : null,
  };
}

function publicUser(u) {
  const ratings = {};
  for (const r of db.prepare("SELECT game, rating, games, wins FROM ratings WHERE user_id = ?").all(u.id)) ratings[r.game] = { rating: Math.round(r.rating), games: r.games, wins: r.wins };
  return { id: u.id, provider: u.provider, nick: u.nick, avatar: u.avatar, frame: frameOf(u), xp: u.xp, byGame: JSON.parse(u.by_game || "{}"), bonusToday: u.bonus_day === today(), ratings };
}

function userFromRequest(req) {
  const m = /^Bearer (\S+)$/.exec(req.headers.authorization || "");
  if (!m) return null;
  const s = db.prepare("SELECT user_id FROM sessions WHERE hash = ?").get(sha(m[1]));
  return s ? db.prepare("SELECT * FROM users WHERE id = ?").get(s.user_id) : null;
}

// ── Friends: added by code (sharing your code is the consent), both ways at once.
// A friend sees your nickname, avatar, level and whether you're online. Nothing else.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_FRIENDS = 100;
/** user id -> times of recent "add friend" tries (in memory only) */
const addTries = new Map();
/** server.js tells us who has a socket open */
let isOnline = () => false;
const setPresence = (fn) => (isOnline = fn);
/** server.js tells the added player's open app ("X added you") */
let onFriendAdded = () => {};
const setFriendAdded = (fn) => (onFriendAdded = fn);

function friendCodeOf(user) {
  if (user.friend_code) return user.friend_code;
  for (;;) {
    const code = Array.from(crypto.randomBytes(6), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
    try {
      db.prepare("UPDATE users SET friend_code = ? WHERE id = ?").run(code, user.id);
      return (user.friend_code = code);
    } catch {
      // taken: try another
    }
  }
}

function friendList(user) {
  const rows = db
    .prepare("SELECT u.id, u.friend_code, u.nick, u.avatar, u.frame, u.xp FROM friends f JOIN users u ON u.id = f.friend_id WHERE f.user_id = ? ORDER BY f.created DESC")
    .all(user.id);
  return {
    code: friendCodeOf(user),
    friends: rows.map((u) => ({ code: friendCodeOf(u), ref: refForUser(u.id), nick: shownNick(refForUser(u.id), u.nick), avatar: u.avatar, frame: frameOf(u), level: levelOf(u.xp), online: isOnline(u.id) })),
  };
}

/** The user id behind a friend code, only if the two are friends (for invites). */
function friendIdByCode(userId, code) {
  const row = db.prepare("SELECT u.id FROM users u JOIN friends f ON f.friend_id = u.id WHERE f.user_id = ? AND u.friend_code = ?").get(userId, String(code || "").toUpperCase());
  return row?.id ?? null;
}

/** Nickname and avatar to show on an invite. */
function inviteCard(userId) {
  const u = db.prepare("SELECT nick, avatar, frame, xp, friend_code FROM users WHERE id = ?").get(userId);
  return u ? { nick: u.nick, avatar: u.avatar, frame: frameOf(u), code: u.friend_code } : null;
}

// ── Skill ratings (Elo) for the online modes: signed-in players only, no bots

const RATED = new Set(["ht", "qz", "pp", "dz"]);
const START = 1000;

function getRating(userId, game) {
  return db.prepare("SELECT rating, games, wins FROM ratings WHERE user_id = ? AND game = ?").get(userId, game) ?? { rating: START, games: 0, wins: 0 };
}

function putRating(userId, game, r) {
  db.prepare(
    "INSERT INTO ratings (user_id, game, rating, games, wins) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, game) DO UPDATE SET rating = excluded.rating, games = excluded.games, wins = excluded.wins"
  ).run(userId, game, r.rating, r.games, r.wins);
}

/**
 * A finished game between signed-in players. `places` is the finishing order,
 * ties share a place: [[winnerId], [loserId]] or [[a, b]] for a draw. Every pair is
 * an Elo game; K is split so a 5-player quiz moves ratings about as much as a duel.
 * Users that don't exist (deleted, guests) are skipped.
 */
function recordResult(game, places) {
  if (!RATED.has(game)) return;
  const exists = db.prepare("SELECT 1 FROM users WHERE id = ?");
  const placed = places.map((ids) => [...new Set(ids)].filter((id) => id && exists.get(id)));
  const all = placed.flat();
  if (all.length < 2 || new Set(all).size !== all.length) return;
  const cur = new Map(all.map((id) => [id, getRating(id, game)]));
  const delta = new Map(all.map((id) => [id, 0]));
  const K = 32 / (all.length - 1);
  placed.forEach((ids, pi) => {
    for (const a of ids) {
      placed.forEach((others, pj) => {
        for (const b of others) {
          if (a === b) continue;
          const score = pi < pj ? 1 : pi > pj ? 0 : 0.5;
          const expected = 1 / (1 + 10 ** ((cur.get(b).rating - cur.get(a).rating) / 400));
          delta.set(a, delta.get(a) + K * (score - expected));
        }
      });
    }
  });
  db.exec("BEGIN");
  try {
    placed.forEach((ids, pi) => {
      for (const id of ids) {
        const r = cur.get(id);
        putRating(id, game, { rating: Math.max(100, r.rating + delta.get(id)), games: r.games + 1, wins: r.wins + (pi === 0 && placed.length > 1 ? 1 : 0) });
      }
    });
    db.exec("COMMIT");
  } catch {
    db.exec("ROLLBACK");
  }
}

/** Session token from the app (socket handshake) → user id, or null. */
function userIdFromToken(token) {
  if (typeof token !== "string" || token.length > 100) return null;
  return db.prepare("SELECT user_id FROM sessions WHERE hash = ?").get(sha(token))?.user_id ?? null;
}

function levelOf(xp) {
  let level = 1;
  let need = 100;
  let into = Math.max(0, Math.floor(xp));
  while (into >= need) {
    into -= need;
    level++;
    need = 100 + (level - 1) * 50;
  }
  return level;
}

/** Top 50 for a board ("xp" or a rated game), plus this user's row. */
function leaderboard(board, me) {
  const top = [];
  let mine = null;
  if (board === "xp") {
    const rows = db.prepare("SELECT id, nick, avatar, frame, xp FROM users WHERE xp > 0 ORDER BY xp DESC, created ASC").all();
    rows.forEach((r, i) => {
      const row = { rank: i + 1, ref: refForUser(r.id), nick: shownNick(refForUser(r.id), r.nick || "?"), avatar: r.avatar, frame: frameOf(r), value: r.xp, level: levelOf(r.xp), me: r.id === me };
      if (i < 50) top.push(row);
      if (r.id === me) mine = row;
    });
    return { top, me: mine, total: rows.length };
  }
  if (!RATED.has(board)) return null;
  const rows = db
    .prepare("SELECT u.id, u.nick, u.avatar, u.frame, u.xp, r.rating, r.games, r.wins FROM ratings r JOIN users u ON u.id = r.user_id WHERE r.game = ? AND r.games > 0 ORDER BY r.rating DESC, r.games DESC")
    .all(board);
  rows.forEach((r, i) => {
    const row = { rank: i + 1, ref: refForUser(r.id), nick: shownNick(refForUser(r.id), r.nick || "?"), avatar: r.avatar, frame: frameOf(r), value: Math.round(r.rating), level: levelOf(r.xp), games: r.games, wins: r.wins, me: r.id === me };
    if (i < 50) top.push(row);
    if (r.id === me) mine = row;
  });
  return { top, me: mine, total: rows.length };
}

// ── Weekly leagues (Duolingo-style): each week signed-in players who earn XP are put
// in a group of up to LEAGUE_SIZE in their league; at the week's end the top
// LEAGUE_UP move up a league and the bottom LEAGUE_DOWN move down. Weeks start on
// Monday 00:00 UTC. Only nick, avatar, frame and the week's XP are shown.
const LEAGUES = ["bronze", "silver", "gold", "sapphire", "ruby", "emerald", "diamond"];
const LEAGUE_SIZE = 30;
const LEAGUE_UP = 7;
const LEAGUE_DOWN = 5;
db.exec(`
  CREATE TABLE IF NOT EXISTS league_members (
    week TEXT NOT NULL,
    user_id TEXT NOT NULL,
    tier INTEGER NOT NULL,
    grp INTEGER NOT NULL,
    xp INTEGER NOT NULL DEFAULT 0,
    joined INTEGER NOT NULL,
    PRIMARY KEY (week, user_id)
  );
  CREATE INDEX IF NOT EXISTS league_group ON league_members (week, tier, grp);
`);
for (const [col, def] of [["league_tier", "INTEGER NOT NULL DEFAULT 0"], ["league_last", "TEXT NOT NULL DEFAULT ''"], ["xp_day", "TEXT NOT NULL DEFAULT ''"], ["xp_today", "INTEGER NOT NULL DEFAULT 0"]]) {
  if (!db.prepare("PRAGMA table_info(users)").all().some((c) => c.name === col)) db.exec(`ALTER TABLE users ADD COLUMN ${col} ${def}`);
}

/** Monday of the week (UTC) as YYYY-MM-DD, and when it ends (ms) */
function weekOf(now = Date.now()) {
  const d = new Date(now);
  const day = (d.getUTCDay() + 6) % 7;
  const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day);
  return { week: new Date(start).toISOString().slice(0, 10), ends: start + 7 * 86400000 };
}

/**
 * Settle any finished week the user took part in: move them up or down a
 * league by their place in their group. Stored as `league_last` ("up:2:4" =
 * moved up to tier 2, finished 4th) for the screen to show once.
 */
function settleLeague(user) {
  const { week } = weekOf();
  const past = db.prepare("SELECT week, tier, grp FROM league_members WHERE user_id = ? AND week < ? ORDER BY week DESC LIMIT 1").get(user.id, week);
  if (!past || (user.league_last && user.league_last.split(":")[3] === past.week)) return;
  const group = db.prepare("SELECT user_id, xp, joined FROM league_members WHERE week = ? AND tier = ? AND grp = ? ORDER BY xp DESC, joined ASC").all(past.week, past.tier, past.grp);
  const place = group.findIndex((m) => m.user_id === user.id) + 1;
  const n = group.length;
  let tier = past.tier;
  let move = "stay";
  // a group too small to race doesn't move anyone down; moving up needs someone to beat
  if (n >= 2 && place <= Math.min(LEAGUE_UP, Math.ceil(n / 3)) && tier < LEAGUES.length - 1) {
    tier++;
    move = "up";
  } else if (n >= LEAGUE_UP + LEAGUE_DOWN && place > n - LEAGUE_DOWN && tier > 0) {
    tier--;
    move = "down";
  }
  user.league_tier = tier;
  user.league_last = `${move}:${tier}:${place}:${past.week}`;
  db.prepare("UPDATE users SET league_tier = ?, league_last = ? WHERE id = ?").run(tier, user.league_last, user.id);
}

/** Add XP to this week's league race, joining a group on the first XP of the week. */
function leagueAdd(user, gained) {
  settleLeague(user);
  const { week } = weekOf();
  const mine = db.prepare("SELECT tier, grp FROM league_members WHERE week = ? AND user_id = ?").get(week, user.id);
  if (mine) return db.prepare("UPDATE league_members SET xp = xp + ? WHERE week = ? AND user_id = ?").run(gained, week, user.id);
  const tier = user.league_tier ?? 0;
  const open = db
    .prepare("SELECT grp, COUNT(*) AS n FROM league_members WHERE week = ? AND tier = ? GROUP BY grp HAVING n < ? ORDER BY grp LIMIT 1")
    .get(week, tier, LEAGUE_SIZE);
  const grp = open ? open.grp : (db.prepare("SELECT MAX(grp) AS g FROM league_members WHERE week = ? AND tier = ?").get(week, tier).g ?? -1) + 1;
  db.prepare("INSERT INTO league_members (week, user_id, tier, grp, xp, joined) VALUES (?, ?, ?, ?, ?, ?)").run(week, user.id, tier, grp, gained, Date.now());
}

/** This week's group for the screen: rows, my place, the zones and when the week ends. */
function leagueView(user) {
  settleLeague(user);
  const { week, ends } = weekOf();
  const base = { league: LEAGUES[user.league_tier ?? 0], tier: user.league_tier ?? 0, leagues: LEAGUES, ends, up: LEAGUE_UP, down: LEAGUE_DOWN, last: user.league_last || null };
  const mine = db.prepare("SELECT tier, grp FROM league_members WHERE week = ? AND user_id = ?").get(week, user.id);
  if (!mine) return { ...base, joined: false, rows: [] };
  const rows = db
    .prepare("SELECT m.user_id, m.xp, u.nick, u.avatar, u.frame, u.xp AS total FROM league_members m JOIN users u ON u.id = m.user_id WHERE m.week = ? AND m.tier = ? AND m.grp = ? ORDER BY m.xp DESC, m.joined ASC")
    .all(week, mine.tier, mine.grp)
    .map((r, i) => ({ rank: i + 1, ref: refForUser(r.user_id), nick: shownNick(refForUser(r.user_id), r.nick || "?"), avatar: r.avatar, frame: frameOf({ frame: r.frame, xp: r.total }), xp: r.xp, me: r.user_id === user.id }));
  return { ...base, tier: mine.tier, league: LEAGUES[mine.tier], joined: true, rows };
}

/** `imported`: guest XP moving into the account (outside the daily cap, kept out of the week's league) */
function addXp(user, key, game, amount, cap = MAX_AWARD, imported = false) {
  if (!GAMES.has(game) || typeof key !== "string" || !key) return false;
  const day = today();
  if (user.xp_day !== day) {
    user.xp_day = day;
    user.xp_today = 0;
  }
  const room = imported ? cap : Math.max(0, DAILY_XP_CAP - (user.xp_today ?? 0));
  const gained = Math.max(0, Math.min(cap, room, Math.round(Number(amount) || 0)));
  if (!gained) return false;
  const k = key.slice(0, 120);
  const fresh = db.prepare("INSERT OR IGNORE INTO awards (user_id, key) VALUES (?, ?)").run(user.id, k).changes > 0;
  if (!fresh) return false;
  const byGame = JSON.parse(user.by_game || "{}");
  byGame[game] = (byGame[game] || 0) + gained;
  user.xp += gained;
  user.by_game = JSON.stringify(byGame);
  if (!imported) user.xp_today += gained;
  db.prepare("UPDATE users SET xp = ?, by_game = ?, xp_day = ?, xp_today = ? WHERE id = ?").run(user.xp, user.by_game, user.xp_day, user.xp_today, user.id);
  if (!imported) leagueAdd(user, gained);
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
        const avatar = AVATARS.has(b.avatar) ? b.avatar : "striker";
        db.prepare("INSERT INTO users (id, provider, sub, nick, avatar, created) VALUES (?, ?, ?, ?, ?, ?)").run(id, provider, sub, nick, avatar, Date.now());
        user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
      }
      // Apple: keep the refresh token so account deletion can revoke it
      if (provider === "apple" && typeof b.authorizationCode === "string" && !user.apple_refresh) {
        const tok = await appleForm("token", { grant_type: "authorization_code", code: b.authorizationCode }).catch(() => null);
        if (tok?.refresh_token) db.prepare("UPDATE users SET apple_refresh = ? WHERE id = ?").run(tok.refresh_token, user.id);
      }
      // the XP a phone earned as a guest moves into the account, once per account
      // (else signing in again with made-up install ids would mint XP)
      const guest = b.guest && typeof b.guest === "object" ? b.guest : null;
      const imported = db.prepare("SELECT 1 FROM awards WHERE user_id = ? AND key LIKE 'import-%' LIMIT 1").get(user.id);
      if (guest && typeof b.installId === "string" && !imported && guest.byGame && typeof guest.byGame === "object") {
        for (const [game, amount] of Object.entries(guest.byGame).slice(0, 12)) addXp(user, `import-${b.installId.slice(0, 40)}-${game}`, game, amount, 50000, true);
      }
      const token = crypto.randomBytes(32).toString("base64url");
      db.prepare("INSERT INTO sessions (hash, user_id, created) VALUES (?, ?, ?)").run(sha(token), user.id, Date.now());
      return send(res, 200, { token, isNew, user: publicUser(db.prepare("SELECT * FROM users WHERE id = ?").get(user.id)) }), true;
    }

    // Leaderboards are public (nicknames, avatars, levels, ratings only)
    if (url === "/api/account/league" && req.method === "GET") {
      const user = userFromRequest(req);
      if (!user) return send(res, 401, { error: "auth" }), true;
      return send(res, 200, leagueView(user)), true;
    }

    if (url === "/api/account/league/seen" && req.method === "POST") {
      const user = userFromRequest(req);
      if (!user) return send(res, 401, { error: "auth" }), true;
      if (user.league_last && !user.league_last.endsWith(":seen")) db.prepare("UPDATE users SET league_last = ? WHERE id = ?").run(user.league_last + ":seen", user.id);
      return send(res, 200, { ok: true }), true;
    }

    if (url === "/api/account/leaderboard" && req.method === "GET") {
      const board = new URL(req.url, "http://x").searchParams.get("board") || "xp";
      const out = leaderboard(board, userFromRequest(req)?.id ?? null);
      return send(res, out ? 200 : 400, out ?? { error: "bad board" }), true;
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
      const frame = b.frame === undefined ? user.frame : b.frame === "" || FRAME_RANK[b.frame] !== undefined ? b.frame : user.frame;
      db.prepare("UPDATE users SET nick = ?, avatar = ?, frame = ? WHERE id = ?").run(nick, avatar, frame, user.id);
      return send(res, 200, { user: publicUser({ ...user, nick, avatar, frame }) }), true;
    }

    if (url === "/api/account/friends" && req.method === "GET") return send(res, 200, friendList(user)), true;

    if (url === "/api/account/friends" && req.method === "POST") {
      // codes can't be guessed by trying many: 20 tries per account per 10 minutes
      const now = Date.now();
      const tries = (addTries.get(user.id) ?? []).filter((t) => now - t < 600_000);
      if (tries.length >= 20) return send(res, 429, { error: "slow" }), true;
      addTries.set(user.id, [...tries, now]);
      const b = await readJson(req);
      const code = String(b.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
      const other = code && db.prepare("SELECT id FROM users WHERE friend_code = ?").get(code);
      if (!other) return send(res, 404, { error: "not_found" }), true;
      if (other.id === user.id) return send(res, 400, { error: "self" }), true;
      const count = db.prepare("SELECT COUNT(*) AS n FROM friends WHERE user_id = ?").get(user.id).n;
      if (count >= MAX_FRIENDS) return send(res, 400, { error: "limit" }), true;
      db.prepare("INSERT OR IGNORE INTO friends (user_id, friend_id, created) VALUES (?, ?, ?)").run(user.id, other.id, now);
      const added = db.prepare("INSERT OR IGNORE INTO friends (user_id, friend_id, created) VALUES (?, ?, ?)").run(other.id, user.id, now).changes > 0;
      if (added) onFriendAdded(other.id, inviteCard(user.id));
      return send(res, 200, friendList(user)), true;
    }

    if (url.startsWith("/api/account/friends/") && req.method === "DELETE") {
      const other = db.prepare("SELECT id FROM users WHERE friend_code = ?").get(url.slice("/api/account/friends/".length).toUpperCase());
      if (other) db.prepare("DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)").run(user.id, other.id, other.id, user.id);
      return send(res, 200, friendList(user)), true;
    }

    if (url === "/api/account/signout" && req.method === "POST") {
      const m = /^Bearer (\S+)$/.exec(req.headers.authorization || "");
      if (m) db.prepare("DELETE FROM sessions WHERE hash = ?").run(sha(m[1]));
      return send(res, 200, { ok: true }), true;
    }

    // Delete the account and everything tied to it (Guideline 5.1.1(v))
    if (url === "/api/account" && req.method === "DELETE") {
      if (user.apple_refresh) await appleForm("revoke", { token: user.apple_refresh, token_type_hint: "refresh_token" }).catch(() => null);
      db.prepare("DELETE FROM awards WHERE user_id = ?").run(user.id);
      db.prepare("DELETE FROM friends WHERE user_id = ? OR friend_id = ?").run(user.id, user.id);
      db.prepare("DELETE FROM league_members WHERE user_id = ?").run(user.id);
      db.prepare("DELETE FROM ratings WHERE user_id = ?").run(user.id);
      db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);
      db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
      return send(res, 200, { ok: true }), true;
    }

    return send(res, 404, { error: "not found" }), true;
  } catch {
    return send(res, 400, { error: "bad request" }), true;
  }
}

module.exports = { handleAccountApi, recordResult, userIdFromToken, setPresence, setFriendAdded, friendIdByCode, inviteCard, cleanLook };
