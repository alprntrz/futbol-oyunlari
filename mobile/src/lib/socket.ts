import { io, type Socket } from "socket.io-client";

/**
 * Online race server (the web project's server.js). Set EXPO_PUBLIC_SOCKET_URL
 * for a deployed server; the iOS simulator reaches the Mac's localhost directly.
 */
export const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL ?? "http://localhost:3000";

/** What this app version understands, so the server never sends an older phone a grid it can't draw. */
const CAPS = ["mate"];

let socket: Socket | null = null;
let sessionToken: string | null = null;

/** Singleton socket shared by the lobby and room screens. */
export function getSocket(): Socket {
  // signed in: the session token rides along so the server can rate online results
  if (!socket) socket = io(SOCKET_URL, { transports: ["websocket"], auth: (cb) => cb(sessionToken ? { token: sessionToken, caps: CAPS } : { caps: CAPS }) });
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
