/**
 * Push notifications (v1.2) for signed-in players, sent through Expo's push service
 * (https://exp.host/--/api/v2/push/send → APNs / FCM).
 *
 * Privacy (keep site/privacy.html true): per phone we store the Expo push token, the account it
 * belongs to, the platform, the app language and three category switches. Nothing else. A push
 * carries a nickname at most: never the install id, an e-mail or a name. Tokens go when the phone
 * signs out (DELETE /api/account/push), when the account is deleted, and when Expo says the app is
 * gone from the phone (DeviceNotRegistered).
 *
 * Categories: "invites" (a friend calls you into a room), "friends" (someone added you) and "news"
 * (a broadcast from POST /api/admin/push). News is off until the player turns it on (App Store 4.5.4).
 *
 * Env:
 *   PUSH_ENDPOINT          send URL (default Expo's); tests point it at a local stub
 *   PUSH_RECEIPT_ENDPOINT  receipts URL (default: PUSH_ENDPOINT with /send → /getReceipts)
 *   PUSH_RECEIPT_DELAY_MS  when to read the receipts of a batch (default 15 min)
 *   EXPO_ACCESS_TOKEN      only if "enhanced push security" is on in the Expo project
 *   PUSH_ADMIN_TOKEN       bearer token for POST /api/admin/push (unset = the endpoint is off)
 * With NODE_ENV=test and no PUSH_ENDPOINT nothing is sent.
 */
const crypto = require("crypto");

const PUSH_ENDPOINT = process.env.PUSH_ENDPOINT || "https://exp.host/--/api/v2/push/send";
const RECEIPT_ENDPOINT = process.env.PUSH_RECEIPT_ENDPOINT || PUSH_ENDPOINT.replace(/\/send$/, "/getReceipts");
const RECEIPT_DELAY_MS = Number(process.env.PUSH_RECEIPT_DELAY_MS) || 15 * 60_000;
const OFFLINE = process.env.NODE_ENV === "test" && !process.env.PUSH_ENDPOINT;
const ACCESS_TOKEN = process.env.EXPO_ACCESS_TOKEN || "";
const ADMIN_TOKEN = process.env.PUSH_ADMIN_TOKEN || "";

const CATEGORIES = ["invites", "friends", "news"];
const DEFAULT_PREFS = { invites: true, friends: true, news: false };
const PLATFORMS = new Set(["ios", "android"]);
const TOKEN_RE = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{8,200}\]$/;
const TOKEN_MAX = 256;
const MAX_TOKENS_PER_USER = 5;
const BATCH = 100;
const FETCH_TIMEOUT_MS = 10_000;
/** receipt ids waiting for a check; bounded so a flood of sends can't grow memory without end */
const MAX_PENDING_RECEIPTS = 5000;
const NEWS_TITLE_MAX = 80;
const NEWS_BODY_MAX = 300;

const isToken = (t) => typeof t === "string" && t.length <= TOKEN_MAX && TOKEN_RE.test(t);
const cleanLang = (l) => (typeof l === "string" && /^[a-z]{2}$/.test(l) ? l : "en");
const flag = (v, fallback) => (typeof v === "boolean" ? v : fallback);

/** Game names as the phones show them (src/lib/strings.ts), for invite texts. */
const GAME_NAMES = {
  ht: { tr: "Tic-Tac-Toe", en: "Tic-Tac-Toe" },
  tt: { tr: "Taktik Tahtası", en: "Pitch Chess" },
  rd: { tr: "Rondo", en: "Rondo" },
  wm: { tr: "Ben Kimim?", en: "Who Am I?" },
};

/** "<nick> invited you to play <game>" in the phone's language. */
function invitePush(nick, game) {
  return (lang) => {
    const name = (GAME_NAMES[game] ?? GAME_NAMES.ht)[lang === "tr" ? "tr" : "en"];
    return lang === "tr"
      ? { title: "Tiktako", body: `${nick || "Bir arkadaşın"} seni ${name} oynamaya çağırıyor` }
      : { title: "Tiktako", body: `${nick || "A friend"} invited you to play ${name}` };
  };
}

/** "<nick> added you as a friend" in the phone's language. */
function friendPush(nick) {
  return (lang) =>
    lang === "tr"
      ? { title: "Tiktako", body: `${nick || "Biri"} seni arkadaş olarak ekledi` }
      : { title: "Tiktako", body: `${nick || "Someone"} added you as a friend` };
}

function safeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

async function postJson(url, body) {
  const headers = { "content-type": "application/json", accept: "application/json" };
  if (ACCESS_TOKEN) headers.authorization = `Bearer ${ACCESS_TOKEN}`;
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`push http ${res.status}`);
  return res.json();
}

/**
 * The push store and sender on the accounts database (server-accounts.js owns `db`).
 * Returns { register, unregister, deleteUser, sendPush, handleAdmin, prefsOf }.
 */
function createPush(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS push_tokens (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      lang TEXT NOT NULL DEFAULT 'en',
      invites INTEGER NOT NULL DEFAULT 1,
      friends INTEGER NOT NULL DEFAULT 1,
      news INTEGER NOT NULL DEFAULT 0,
      created INTEGER NOT NULL,
      updated INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS push_tokens_user ON push_tokens (user_id);
  `);
  const dropToken = db.prepare("DELETE FROM push_tokens WHERE token = ?");
  /** receipt id → token, read RECEIPT_DELAY_MS after the send */
  const pendingReceipts = new Map();
  let receiptTimer = null;

  /** Save (or move to this account) a phone's token with its language and switches. */
  function register(userId, body) {
    const { token, platform, lang, prefs } = body ?? {};
    if (!isToken(token)) return { error: "bad token" };
    if (!PLATFORMS.has(platform)) return { error: "bad platform" };
    const p = prefs && typeof prefs === "object" ? prefs : {};
    const old = db.prepare("SELECT invites, friends, news FROM push_tokens WHERE token = ? AND user_id = ?").get(token, userId);
    const base = old ? { invites: !!old.invites, friends: !!old.friends, news: !!old.news } : DEFAULT_PREFS;
    const next = { invites: flag(p.invites, base.invites), friends: flag(p.friends, base.friends), news: flag(p.news, base.news) };
    const now = Date.now();
    db.prepare(
      `INSERT INTO push_tokens (token, user_id, platform, lang, invites, friends, news, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(token) DO UPDATE SET user_id = excluded.user_id, platform = excluded.platform, lang = excluded.lang,
         invites = excluded.invites, friends = excluded.friends, news = excluded.news, updated = excluded.updated`
    ).run(token, userId, platform, cleanLang(lang), +next.invites, +next.friends, +next.news, now, now);
    // a handful of phones per account: the oldest go
    const extra = db.prepare("SELECT token FROM push_tokens WHERE user_id = ? ORDER BY updated DESC, created DESC LIMIT -1 OFFSET ?").all(userId, MAX_TOKENS_PER_USER);
    for (const r of extra) dropToken.run(r.token);
    return { ok: true, prefs: next };
  }

  function unregister(userId, token) {
    if (typeof token !== "string") return { error: "bad token" };
    db.prepare("DELETE FROM push_tokens WHERE token = ? AND user_id = ?").run(token, userId);
    return { ok: true };
  }

  function deleteUser(userId) {
    db.prepare("DELETE FROM push_tokens WHERE user_id = ?").run(userId);
  }

  function scheduleReceipts() {
    if (receiptTimer || !pendingReceipts.size) return;
    receiptTimer = setTimeout(checkReceipts, RECEIPT_DELAY_MS);
    receiptTimer.unref?.();
  }

  /** Expo's receipts say which tokens are dead (the app was removed): those rows go. */
  async function checkReceipts() {
    receiptTimer = null;
    const batch = [...pendingReceipts.entries()].slice(0, 1000);
    for (const [id] of batch) pendingReceipts.delete(id);
    try {
      const res = await postJson(RECEIPT_ENDPOINT, { ids: batch.map(([id]) => id) });
      const tokenById = new Map(batch);
      for (const [id, r] of Object.entries(res?.data ?? {})) {
        if (r?.status === "error" && r.details?.error === "DeviceNotRegistered" && tokenById.has(id)) dropToken.run(tokenById.get(id));
      }
    } catch (e) {
      console.error(`push receipts: ${e.message}`);
    }
    scheduleReceipts();
  }

  /** One request of up to BATCH messages; dead tokens in the tickets are dropped at once. */
  async function sendBatch(messages) {
    const res = await postJson(PUSH_ENDPOINT, messages);
    const tickets = Array.isArray(res?.data) ? res.data : [];
    tickets.forEach((t, i) => {
      const token = messages[i]?.to;
      if (!token) return;
      if (t?.status === "error" && t.details?.error === "DeviceNotRegistered") dropToken.run(token);
      else if (t?.status === "ok" && typeof t.id === "string" && pendingReceipts.size < MAX_PENDING_RECEIPTS) pendingReceipts.set(t.id, token);
    });
    scheduleReceipts();
    return tickets.filter((t) => t?.status === "ok").length;
  }

  /**
   * Send to the phones of `userIds` (null = every phone) that have `category` on.
   * `build(lang)` → { title, body }. Never throws; resolves to how many pushes Expo took.
   */
  async function sendPush(userIds, { category, build, data = {} }) {
    try {
      if (!CATEGORIES.includes(category) || typeof build !== "function") return 0;
      if (Array.isArray(userIds) && !userIds.length) return 0;
      const rows = Array.isArray(userIds)
        ? db.prepare(`SELECT token, lang FROM push_tokens WHERE ${category} = 1 AND user_id IN (${userIds.map(() => "?").join(",")})`).all(...userIds)
        : db.prepare(`SELECT token, lang FROM push_tokens WHERE ${category} = 1`).all();
      if (!rows.length || OFFLINE) return 0;
      const messages = rows.map((r) => ({
        to: r.token,
        ...build(r.lang),
        data: { ...data, category },
        sound: "default",
        channelId: category,
        priority: category === "invites" ? "high" : "default",
        ...(category === "invites" ? { ttl: 300 } : {}),
      }));
      let sent = 0;
      for (let i = 0; i < messages.length; i += BATCH) sent += await sendBatch(messages.slice(i, i + BATCH));
      return sent;
    } catch (e) {
      console.error(`push ${category}: ${e.message}`);
      return 0;
    }
  }

  /** The categories a user has on any phone (for the server to skip work, and tests). */
  function hasCategory(userId, category) {
    if (!CATEGORIES.includes(category)) return false;
    return !!db.prepare(`SELECT 1 FROM push_tokens WHERE user_id = ? AND ${category} = 1 LIMIT 1`).get(userId);
  }

  /**
   * POST /api/admin/push {title_tr, body_tr, title_en, body_en}: news to every phone that opted in.
   * Off (404) without PUSH_ADMIN_TOKEN; the bearer token is compared in constant time.
   */
  async function handleAdmin(req, res, { readJson, send }) {
    if (!ADMIN_TOKEN) return send(res, 404, { error: "not found" });
    const m = /^Bearer (\S+)$/.exec(req.headers.authorization || "");
    if (!m || !safeEqual(m[1], ADMIN_TOKEN)) return send(res, 401, { error: "unauthorized" });
    let b;
    try {
      b = await readJson(req);
    } catch {
      return send(res, 400, { error: "bad request" });
    }
    const text = (v, max) => (typeof v === "string" && v.trim() && v.length <= max ? v.trim() : null);
    const t = { tr: [text(b.title_tr, NEWS_TITLE_MAX), text(b.body_tr, NEWS_BODY_MAX)], en: [text(b.title_en, NEWS_TITLE_MAX), text(b.body_en, NEWS_BODY_MAX)] };
    if (![...t.tr, ...t.en].every(Boolean)) return send(res, 400, { error: "title_tr, body_tr, title_en, body_en required" });
    const sent = await sendPush(null, {
      category: "news",
      build: (lang) => {
        const [title, body] = lang === "tr" ? t.tr : t.en;
        return { title, body };
      },
      data: { type: "news" },
    });
    return send(res, 200, { ok: true, sent });
  }

  return { register, unregister, deleteUser, sendPush, hasCategory, handleAdmin };
}

module.exports = { createPush, invitePush, friendPush, isToken };
