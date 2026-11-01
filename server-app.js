/**
 * App housekeeping over HTTP (/api/app/*):
 *
 *   GET  /api/app/version  the oldest app version the server still serves (MIN_APP_VERSION) and where to
 *                          update; an older app shows a "please update" screen instead of breaking.
 *   POST /api/app/crash    an anonymous crash report from the app's error screen: the error message, a
 *                          short stack, the screen, app version and platform. No ids, no nickname, no IP
 *                          (keep site/privacy.html true). Appended to CRASH_FILE (capped), and printed
 *                          to the log so `flyctl logs` shows it. Read the file with
 *                          `flyctl ssh console -a tiktako -C "tail -n 50 /data/crashes.jsonl"`.
 */
const fs = require("fs");
const path = require("path");

const DIR = path.dirname(process.env.ACCOUNTS_DB || path.join(__dirname, "data", "accounts.db"));
const CRASH_FILE = path.join(DIR, "crashes.jsonl");
const CRASH_FILE_MAX = 5 * 1024 * 1024;
const MIN_APP_VERSION = process.env.MIN_APP_VERSION || "1.0.0";
const STORE = { ios: "https://apps.apple.com/app/id6821740252", android: "https://play.google.com/store/apps/details?id=com.alprntrz.tiktako" };

// at most CRASH_PER_HOUR reports an hour in all (a crash loop on many phones can't fill the disk)
const CRASH_PER_HOUR = 300;
let crashHour = 0;
let crashCount = 0;

const clip = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function readBody(req, max) {
  return new Promise((resolve) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > max) {
        resolve(null);
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        resolve(null);
      }
    });
    req.on("error", () => resolve(null));
  });
}

async function handleAppApi(req, res) {
  const url = req.url.split("?")[0];
  if (url === "/api/app/version" && req.method === "GET") {
    send(res, 200, { min: MIN_APP_VERSION, store: STORE });
    return true;
  }
  if (url === "/api/app/crash" && req.method === "POST") {
    const b = await readBody(req, 16 * 1024);
    if (!b) return send(res, 400, { ok: false }), true;
    const hour = Math.floor(Date.now() / 3_600_000);
    if (hour !== crashHour) {
      crashHour = hour;
      crashCount = 0;
    }
    if (++crashCount > CRASH_PER_HOUR) return send(res, 429, { ok: false }), true;
    const entry = {
      at: new Date().toISOString(),
      message: clip(b.message, 500),
      stack: clip(b.stack, 3000),
      screen: clip(b.screen, 120),
      version: clip(b.version, 20),
      platform: clip(b.platform, 10),
    };
    console.error(`app crash ${entry.platform} ${entry.version} ${entry.screen}: ${entry.message}`);
    fs.stat(CRASH_FILE, (err, st) => {
      if (!err && st.size > CRASH_FILE_MAX) return;
      fs.appendFile(CRASH_FILE, JSON.stringify(entry) + "\n", () => {});
    });
    send(res, 200, { ok: true });
    return true;
  }
  return false;
}

module.exports = { handleAppApi };
