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
 * reason, game; no IP, no account id). A ref reported by REPORT_HIDE different players gets its
 * nickname replaced by "Player" everywhere the server shows it. Read the file with
 * `flyctl ssh console -a tiktako -C "cat /data/reports.jsonl"`.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const DIR = path.dirname(process.env.ACCOUNTS_DB || path.join(__dirname, "data", "accounts.db"));
const SECRET_FILE = path.join(DIR, "ref-secret");
const REPORTS_FILE = path.join(DIR, "reports.jsonl");
const REPORT_HIDE = 3;
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

// reported ref → reporter refs; refs with REPORT_HIDE of them have their nickname hidden
const reporters = new Map();
const hidden = new Set();
function count(by, ref) {
  const set = reporters.get(ref) ?? new Set();
  set.add(by);
  reporters.set(ref, set);
  if (set.size >= REPORT_HIDE) hidden.add(ref);
}
try {
  for (const line of fs.readFileSync(REPORTS_FILE, "utf8").split("\n")) {
    if (!line) continue;
    const r = JSON.parse(line);
    if (isRef(r.by) && isRef(r.ref)) count(r.by, r.ref);
  }
} catch {
  // no reports yet
}

/** A report from `by` about `ref`. Returns false when it's malformed or about oneself. */
function addReport(by, { ref, nick, reason, game }) {
  if (!isRef(by) || !isRef(ref) || by === ref) return false;
  const entry = {
    at: new Date().toISOString(),
    by,
    ref,
    nick: typeof nick === "string" ? nick.slice(0, 24) : "",
    reason: REASONS.has(reason) ? reason : "other",
    game: typeof game === "string" ? game.slice(0, 12) : "",
  };
  fs.appendFile(REPORTS_FILE, JSON.stringify(entry) + "\n", () => {});
  console.log(`report: ${entry.reason} ${entry.game} "${entry.nick}"`);
  count(by, ref);
  return true;
}

/** The nickname to show for a ref: "Player" once enough people reported it. */
const shownNick = (ref, nick) => (ref && hidden.has(ref) ? "Player" : nick);

/** A phone's block list as sent: up to 200 refs. */
const cleanBlocks = (list) => new Set((Array.isArray(list) ? list : []).filter(isRef).slice(0, 200));

module.exports = { refForSocket, refForUser, addReport, shownNick, cleanBlocks, isRef };
