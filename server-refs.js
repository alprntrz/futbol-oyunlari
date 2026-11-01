/**
 * Player refs, reports and blocking (Apple guideline 1.2: anyone whose nickname others can see
 * can be reported and blocked).
 *
 * A ref is an opaque, stable handle for a player: HMAC(secret, "u:" + account id) when signed in,
 * else HMAC(secret, "p:" + the app's random install id). It can't be turned back into either, so
 * showing it to other phones gives away nothing (the install id itself must stay private: it opens
 * the quiz record). Phones block by ref (the list stays on the phone and is sent to the server for
 * matchmaking) and report by ref.
 *
 * Reports go to REPORTS_FILE (one JSON line each: time, reporter ref, reported ref, nickname shown,
 * reason, game, whether the reporter was signed in; no IP, no account id). A ref reported by
 * REPORT_HIDE different signed-in players within HIDE_MS gets its nickname replaced by "Player"
 * everywhere the server shows it (guest refs cost nothing to mint, so guest reports are kept but
 * don't count). The file stops growing past REPORTS_FILE_MAX. Read it with
 * `flyctl ssh console -a tiktako -C "cat /data/reports.jsonl"`.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const DIR = path.dirname(process.env.ACCOUNTS_DB || path.join(__dirname, "data", "accounts.db"));
const SECRET_FILE = path.join(DIR, "ref-secret");
const REPORTS_FILE = path.join(DIR, "reports.jsonl");
const REPORT_HIDE = 3;
/** a hide lasts this long after the report that made it */
const HIDE_MS = 30 * 86_400_000;
const REPORTS_FILE_MAX = 5 * 1024 * 1024;
/** reported refs kept in memory (each with its reporters) */
const MAX_REPORTED = 20_000;
/** one report per reporter ref this often (a socket has its own limit in server.js; one ref may hold several sockets) */
const REPORT_GAP_MS = 5000;
const REASONS = new Set(["nick", "cheat", "other"]);

fs.mkdirSync(DIR, { recursive: true });
let secret = process.env.REF_SECRET;
if (!secret) {
  try {
    secret = fs.readFileSync(SECRET_FILE, "utf8").trim();
  } catch {
    secret = crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(SECRET_FILE, secret, { mode: 0o600 });
  }
}

const isRef = (v) => typeof v === "string" && /^[a-f0-9]{16}$/.test(v);
const refOf = (key) => crypto.createHmac("sha256", secret).update(key).digest("hex").slice(0, 16);
const isPid = (v) => typeof v === "string" && v.length >= 8 && v.length <= 64;

/** The ref of a connecting phone: its account, else its install id, else nothing (can't be blocked across visits). */
function refForSocket(uid, pid) {
  if (uid) return refOf("u:" + uid);
  if (isPid(pid)) return refOf("p:" + pid);
  return null;
}
/** The ref of a signed-in user (leaderboards, league, friends). */
const refForUser = (uid) => refOf("u:" + uid);

// reported ref → (signed-in reporter ref → time); REPORT_HIDE recent ones hide the nickname until hiddenUntil
const reporters = new Map();
const hiddenUntil = new Map();
function count(by, ref, at) {
  if (!(Date.now() - at < HIDE_MS)) return;
  if (!reporters.has(ref) && reporters.size >= MAX_REPORTED) return;
  const seen = reporters.get(ref) ?? new Map();
  seen.set(by, at);
  reporters.set(ref, seen);
  const recent = [...seen.values()].filter((t) => Date.now() - t < HIDE_MS).sort((a, b) => b - a);
  if (recent.length >= REPORT_HIDE) hiddenUntil.set(ref, recent[REPORT_HIDE - 1] + HIDE_MS);
}
try {
  for (const line of fs.readFileSync(REPORTS_FILE, "utf8").split("\n")) {
    if (!line) continue;
    const r = JSON.parse(line);
    if (r.signed && isRef(r.by) && isRef(r.ref)) count(r.by, r.ref, Date.parse(r.at));
  }
} catch {
  // no reports yet
}
// reporter ref → last report (ms)
const lastBy = new Map();

/** A report from `by` (`signed`: a signed-in player) about `ref`. Returns false when it's malformed, about oneself or too soon. */
function addReport(by, { ref, nick, reason, game }, signed = false) {
  if (!isRef(by) || !isRef(ref) || by === ref) return false;
  const now = Date.now();
  if (now - (lastBy.get(by) ?? 0) < REPORT_GAP_MS) return false;
  if (lastBy.size > 10_000) for (const [k, t] of lastBy) if (now - t >= REPORT_GAP_MS) lastBy.delete(k);
  lastBy.set(by, now);
  const entry = {
    at: new Date().toISOString(),
    by,
    ref,
    nick: typeof nick === "string" ? nick.slice(0, 24) : "",
    reason: REASONS.has(reason) ? reason : "other",
    game: typeof game === "string" ? game.slice(0, 12) : "",
    signed: !!signed,
  };
  fs.stat(REPORTS_FILE, (err, st) => {
    if (!err && st.size > REPORTS_FILE_MAX) return;
    fs.appendFile(REPORTS_FILE, JSON.stringify(entry) + "\n", () => {});
  });
  console.log(`report: ${entry.reason} ${entry.game} "${entry.nick}"`);
  if (signed) count(by, ref, now);
  return true;
}

/** The nickname to show for a ref: "Player" while enough signed-in people's reports stand. */
const shownNick = (ref, nick) => (ref && (hiddenUntil.get(ref) ?? 0) > Date.now() ? "Player" : nick);

/** A phone's block list as sent: up to 200 refs. */
const cleanBlocks = (list) => new Set((Array.isArray(list) ? list : []).filter(isRef).slice(0, 200));

module.exports = { refForSocket, refForUser, addReport, shownNick, cleanBlocks, isRef };
