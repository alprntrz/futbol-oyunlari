import { AppState } from "react-native";
import { io, type Socket } from "socket.io-client";

/**
 * Online race server (the web project's server.js). Set EXPO_PUBLIC_SOCKET_URL
 * for a deployed server; the iOS simulator reaches the Mac's localhost directly.
 */
export const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL ?? "http://localhost:3000";

/** What this app version understands, so the server never sends an older phone a grid it can't draw ("arab": Saudi / Egyptian clubs, "hon": honour counts and birth decades). */
const CAPS = ["mate", "coach", "arab", "hon"];

let socket: Socket | null = null;
let sessionToken: string | null = null;

/**
 * Coming back to a live match on a new connection (server.js `welcomeBack`): the socket id this
 * phone had before, and a random key made once per app run that proves it was us. The key goes
 * only to the server, never to the other player.
 */
const REJOIN_KEY = Array.from({ length: 24 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"[Math.floor(Math.random() * 56)]).join("");
let lastId: string | null = null;

/** Singleton socket shared by the lobby and room screens. */
export function getSocket(): Socket {
  // signed in: the session token rides along so the server can rate online results
  if (!socket) {
    const s = io(SOCKET_URL, {
      transports: ["websocket"],
      auth: (cb) => cb({ ...(sessionToken ? { token: sessionToken } : null), caps: CAPS, rk: REJOIN_KEY, ...(lastId ? { prev: lastId } : null) }),
    });
    socket = s;
    s.on("connect", () => {
      lastId = s.id ?? null;
    });
    // the server updates the Live Activity over APNs only while the app is away (server.js app:state)
    AppState.addEventListener("change", (state) => s.emit("app:state", { active: state === "active" }));
  }
  return socket;
}

/** Sign in / out (lib/account.ts): reconnect so the server sees the new identity. */
export function setSessionToken(token: string | null) {
  if (token === sessionToken) return;
  sessionToken = token;
  if (socket?.connected) {
    socket.disconnect();
    socket.connect();
  }
}
