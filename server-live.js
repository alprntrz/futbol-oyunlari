/**
 * Live Activity updates over APNs, for a phone whose app is in the background
 * (the app updates its own activity while it runs). The phone sends the
 * activity's push token for the match it's in; it lives in memory with the
 * match and is never stored. Off unless APNS_KEY / APNS_KEY_ID / APPLE_TEAM_ID
 * are set (the key is an Apple "APNs" .p8 key).
 *
 * Payload: expo-widgets keeps the activity's props as a JSON string in
 * ContentState { name, props } (node_modules/expo-widgets/ios/Widgets/WidgetLiveActivity.swift).
 */
const http2 = require("http2");
const crypto = require("crypto");

const KEY = process.env.APNS_KEY ? process.env.APNS_KEY.replace(/\\n/g, "\n") : null;
const KEY_ID = process.env.APNS_KEY_ID || null;
const TEAM_ID = process.env.APPLE_TEAM_ID || null;
const BUNDLE_ID = process.env.APNS_BUNDLE_ID || "com.alprntrz.tiktako";
const HOST = process.env.APNS_HOST || "https://api.push.apple.com";
const enabled = !!(KEY && KEY_ID && TEAM_ID);

let jwt = null;
let jwtAt = 0;
/** provider token, ES256, refreshed every 50 minutes (Apple accepts 20–60) */
function token() {
  if (jwt && Date.now() - jwtAt < 50 * 60 * 1000) return jwt;
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = b64({ alg: "ES256", kid: KEY_ID });
  const body = b64({ iss: TEAM_ID, iat: Math.floor(Date.now() / 1000) });
  const sig = crypto.sign("sha256", Buffer.from(`${head}.${body}`), { key: KEY, dsaEncoding: "ieee-p1363" }).toString("base64url");
  jwt = `${head}.${body}.${sig}`;
  jwtAt = Date.now();
  return jwt;
}

let session = null;
function client() {
  if (session && !session.closed && !session.destroyed) return session;
  session = http2.connect(HOST);
  session.on("error", () => (session = null));
  session.on("goaway", () => (session = null));
  session.unref?.();
  return session;
}

/**
 * Update one activity. `alert` (title + body) lights the screen and plays the
 * sound — only for "your turn". `staleAt` (ms) lets iOS redraw the clock red.
 */
function pushLive(pushToken, props, { alert, staleAt, end } = {}) {
  if (!enabled || typeof pushToken !== "string" || !/^[0-9a-f]{20,200}$/i.test(pushToken)) return;
  const now = Math.floor(Date.now() / 1000);
  const aps = {
    timestamp: now,
    event: end ? "end" : "update",
    "content-state": { name: "MatchActivity", props: JSON.stringify(props) },
  };
  if (staleAt) aps["stale-date"] = Math.floor(staleAt / 1000);
  if (end) aps["dismissal-date"] = now + 120;
  if (alert) aps.alert = { title: alert.title, body: alert.body, sound: "default" };
  try {
    const req = client().request({
      ":method": "POST",
      ":path": `/3/device/${pushToken}`,
      authorization: `bearer ${token()}`,
      "apns-push-type": "liveactivity",
      "apns-topic": `${BUNDLE_ID}.push-type.liveactivity`,
      "apns-priority": alert ? "10" : "5",
    });
    req.on("response", () => {});
    req.on("error", () => {});
    req.setEncoding("utf8");
    req.on("data", () => {});
    req.end(JSON.stringify({ aps }));
  } catch {
    session = null;
  }
}

module.exports = { pushLive, liveEnabled: enabled };
