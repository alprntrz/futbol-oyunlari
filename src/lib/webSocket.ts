import { io, type Socket } from "socket.io-client";

/** The game server the phones use. `arab`: this site draws Saudi clubs; `rematch`: it answers rematch requests. */
const SERVER_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "https://tiktako.fly.dev";
const CAPS = ["arab", "rematch"];

// shortcut: lives in memory, so a page reload loses the seat; keep it in sessionStorage if reloads prove common
const REJOIN_KEY = crypto.randomUUID().replaceAll("-", "");

let socket: Socket | null = null;
let lastId: string | null = null;

export function gameSocket(): Socket {
  if (socket) return socket;
  const s = io(SERVER_URL, {
    transports: ["websocket"],
    auth: (cb) => cb({ caps: CAPS, rk: REJOIN_KEY, ...(lastId ? { prev: lastId } : null) }),
  });
  s.on("connect", () => {
    lastId = s.id ?? null;
  });
  socket = s;
  return s;
}
