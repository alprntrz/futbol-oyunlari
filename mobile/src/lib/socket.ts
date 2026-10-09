import { io, type Socket } from "socket.io-client";

/**
 * Online race server (the web project's server.js). Set EXPO_PUBLIC_SOCKET_URL
 * for a deployed server; the iOS simulator reaches the Mac's localhost directly.
 */
export const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL ?? "http://localhost:3000";

let socket: Socket | null = null;

/** Singleton socket shared by the lobby and room screens. */
export function getSocket(): Socket {
  if (!socket) socket = io(SOCKET_URL, { transports: ["websocket"] });
  return socket;
}
