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

// ── Match → activity (used by the online games in server.js and server-games/) ──
// A phone in a match sends `la:token` { game, token, s } (s = its strings, in its language) and
// `app:state` { active }. While its app is in the background, every change to the match updates
// its Live Activity from here; when the turn comes to it, the update carries an alert.
const LIVE_STALE_MS = 10_000;
/** the Socket.IO server, set by server.js once it runs */
let io = null;
const setLiveIo = (server) => (io = server);

/** Push `build(seat, opponent, strings)` to every seat of `room` whose phone is away and holds a token for it. */
function liveSend(game, room, build) {
  for (const p of room.players) {
    const sock = io?.sockets.sockets.get(p.id);
    const la = sock?.data.la;
    if (!la || la.game !== game || la.code !== room.code || sock.data.active !== false) continue;
    const opp = room.players.find((x) => x !== p);
    const out = build(p, opp, la.s);
    if (!out) continue;
    const key = JSON.stringify(out.props);
    // alert only when the turn comes over while away (null = just went to the background, state unknown)
    const alert = out.yourTurn && la.wasMyTurn === false ? { title: la.s.game, body: la.s.yourTurn } : null;
    la.wasMyTurn = out.yourTurn;
    if (key === la.last) continue;
    la.last = key;
    pushLive(la.token, out.props, { alert, staleAt: out.props.endsAt ? out.props.endsAt - LIVE_STALE_MS : 0 });
  }
}
const str = (v, max = 60) => (typeof v === "string" ? v.slice(0, max) : "");
/** the strings a phone sends with its token, cleaned */
function liveStrings(s) {
  const keys = ["game", "icon", "you", "yourTurn", "theirTurn", "won", "lost", "draw", "pick", "waiting", "winRound", "loseRound", "drawRound", "round"];
  const out = {};
  for (const k of keys) out[k] = str(s?.[k]);
  return out;
}
const sec = (ms) => Math.round(ms / 1000) * 1000;

/** Tic-Tac-Toe and Possession: whose turn, the mover's clock, the score */
function liveTurnProps(p, opp, s, { turn, winner, matchOver, score, endsAt, since }) {
  const nick = opp?.nick || "…";
  const props = {
    game: s.game,
    icon: s.icon,
    headline: winner ? (winner === "draw" ? s.draw : winner === p.mark ? s.won : s.lost) : turn === p.mark ? s.yourTurn : s.theirTurn.replace("{nick}", nick),
    tone: winner ? (winner === "draw" ? "draw" : winner === p.mark ? "win" : "lose") : turn,
    line: `${s.you} – ${nick}`,
    score,
    mark: p.mark,
    endsAt: winner ? 0 : sec(endsAt),
    since: winner ? 0 : sec(since),
    phase: !winner ? "turn" : matchOver ? "over" : "pause",
  };
  return { props, yourTurn: !winner && turn === p.mark };
}

module.exports = { pushLive, liveEnabled: enabled, setLiveIo, liveSend, liveStrings, liveTurnProps, sec };
