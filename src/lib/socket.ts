"use client";

import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

/** Singleton client socket, shared across lobby and room pages. */
export function getSocket(): Socket {
  if (!socket) {
    socket = io({ transports: ["websocket", "polling"] });
  }
  return socket;
}
