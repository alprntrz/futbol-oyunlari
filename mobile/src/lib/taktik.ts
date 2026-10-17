import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

import { botTurn } from "@/lib/taktik/bot";
import { endRound, newLobby } from "@/lib/taktik/engine";
import { applyOp, RANDOM_OPS, type Op } from "@/lib/taktik/ops";
import { REROLL_COST } from "@/lib/taktik/rules";
import type { CoachId, Lobby, Personality, PoolPlayer } from "@/lib/taktik/types";

import { loadMyLook } from "./cosmetics";
import { loadNick, loadPlayerId, randomNick } from "./nick";
import { getSocket } from "./socket";
import { loadTier } from "./xp";

/**
 * The Taktik Tahtası game on this phone, in one of two modes:
 *  - solo: the whole game runs here against 7 house managers (saved, `taktik-v1`);
 *  - online: a lobby with friends on server-taktik.js; the server owns the game and
 *    sends it (`tt:state`), moves go up as `tt:act` and show here at once as a guess.
 * The engine mutates the lobby in place; `version` ticks after every change so
 * screens re-render. There's no "continue later": like an online lobby, a manager
 * who leaves has `REJOIN_MS` to come back (the game screen stamps `seen` while it's
 * open); after that the game is gone and the next one starts fresh.
 */
const KEY = "taktik-v1";
const SEEN_KEY = "taktik-seen-v1";
/** the online lobby this phone was last in (for getting back in within a minute) */
const ONLINE_KEY = "taktik-online-v1";
/** how long a manager who left can still get back into the lobby */
export const REJOIN_MS = 60_000;
const PERSONALITIES: Personality[] = ["loyal", "econ", "roller", "opportunist", "loyal", "econ", "opportunist"];

export type TtPhase = "lobby" | "plan" | "match" | "over";
export interface TtSeat {
  id: number;
  nick: string;
  avatar: string | null;
  frame: string | null;
  host: boolean;
  away: boolean;
  gone: boolean;
}
export interface TtOnline {
  code: string;
  phase: TtPhase;
  /** when the set-up clock runs out, on this phone's clock */
  planEnds: number;
  seats: TtSeat[];
  /** my manager id */
  you: number;
}

/** last moment the game screen was open (ms) */
let seen = 0;
let lobby: Lobby | null = null;
let online: TtOnline | null = null;
/** the online card pool (sent once per game) */
let players: PoolPlayer[] = [];
/** an online game left a moment ago: its code, to get back in */
let leftCode: string | null = null;
let version = 0;
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  version++;
  listeners.forEach((fn) => fn());
  // only a solo game is kept on the phone; an online one lives on the server
  if (online) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (lobby) AsyncStorage.setItem(KEY, JSON.stringify(lobby)).catch(() => {});
    else AsyncStorage.removeItem(KEY).catch(() => {});
  }, 300);
}

export function loadTaktik() {
  return (loaded ??= AsyncStorage.multiGet([KEY, SEEN_KEY, ONLINE_KEY])
    .then(([[, raw], [, s], [, code]]) => {
      if (raw && !online) lobby = JSON.parse(raw) as Lobby;
      seen = Number(s) || 0;
      leftCode = code || null;
      expireTaktik();
    })
    .catch(() => {})
    .then(() => {
      version++;
      listeners.forEach((fn) => fn());
    }));
}

/** Current lobby (null: none), the online room (null: solo), my manager id, and a version that changes on every edit. */
export function useTaktik(): { lobby: Lobby | null; online: TtOnline | null; meId: number; version: number } {
  const v = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      loadTaktik();
      return () => {
        listeners.delete(fn);
      };
    },
    () => version
  );
  return { lobby, online, meId: online?.you ?? 0, version: v };
}

/** Start a solo game with this manager style; the house managers get human-looking names. */
export async function startTaktik(coach: CoachId) {
  // the saved game must have loaded first, or it would land on top of the new one
  await loadTaktik();
  dropOnline();
  const name = await loadNick();
  const seed = Math.floor(Math.random() * 2 ** 31);
  const bots = PERSONALITIES.map((personality) => ({ name: randomNick(), personality }));
  lobby = newLobby(seed, [{ name, coach }], bots);
  markTaktikSeen();
  emit();
}

/**
 * A move of mine during set-up (lib/taktik/ops.ts). Solo: done here. Online: sent to the
 * server, and shown here at once unless its outcome is random (a reroll waits for the server).
 */
export function play(o: Op): boolean | string {
  if (!lobby) return false;
  const m = lobby.managers[online?.you ?? 0];
  if (!m) return false;
  if (!online) {
    const r = applyOp(lobby, m, o);
    emit();
    return r;
  }
  if (online.phase !== "plan") return false;
  getSocket().emit("tt:act", o);
  if (RANDOM_OPS.has(o.op)) return o.op === "reroll" ? m.gold >= REROLL_COST : (m.offerRerolls ?? 0) > 0;
  const r = applyOp(lobby, m, o);
  emit();
  return r;
}

/** Solo: end the planning phase, bots act and the round's matches are played. (Online the server does this.) */
export function kickOff() {
  if (!lobby || lobby.over || online) return;
  endRound(lobby, botTurn);
  emit();
}

/** The game screen is open: keep the seat (called every few seconds and when the screen goes away). */
export function markTaktikSeen() {
  seen = Date.now();
  AsyncStorage.setItem(SEEN_KEY, String(seen)).catch(() => {});
}

const liveSolo = () => !!lobby && !online && !lobby.over && lobby.managers[0].place === null;

/** A live game this manager left: how long is left to get back in (0: none, or too late). */
export function rejoinLeft(): number {
  if (!liveSolo() && !leftCode) return 0;
  return Math.max(0, REJOIN_MS - (Date.now() - seen));
}

/** Away for longer than REJOIN_MS: the seat is lost, the game goes. Returns true if it went. */
export function expireTaktik(): boolean {
  if (Date.now() - seen < REJOIN_MS) return false;
  let went = false;
  if (leftCode) {
    forgetLeft();
    went = true;
  }
  if (liveSolo()) {
    quitTaktik();
    went = true;
  }
  return went;
}

/** Leave the game for good (game over, or a new one). */
export function quitTaktik() {
  if (online) getSocket().emit("tt:leave");
  dropOnline();
  forgetLeft();
  lobby = null;
  emit();
}

/** Delete my data: forget the saved game. */
export function resetTaktik() {
  lobby = null;
  loaded = null;
  forgetLeft();
  AsyncStorage.multiRemove([KEY, SEEN_KEY, ONLINE_KEY]).catch(() => {});
}

// ── online lobbies (server-taktik.js)

interface ServerState {
  code: string;
  phase: TtPhase;
  leftMs: number;
  seats: TtSeat[];
  you: number;
  lobby?: Omit<Lobby, "players">;
}

let wired = false;
/** wire the socket once: state and pool in, and a dropped connection rejoins by itself */
function wire() {
  if (wired) return;
  wired = true;
  const socket = getSocket();
  socket.on("tt:players", (p: PoolPlayer[]) => {
    players = Array.isArray(p) ? p : [];
    if (lobby && online) lobby = { ...lobby, players };
  });
  socket.on("tt:state", (s: ServerState) => {
    if (!online || s.code !== online.code) return;
    online = { code: s.code, phase: s.phase, planEnds: Date.now() + (s.leftMs || 0), seats: s.seats, you: s.you };
    lobby = s.lobby ? ({ ...s.lobby, players } as Lobby) : null;
    emit();
  });
  socket.on("connect", async () => {
    if (!online) return;
    socket.emit("tt:join", { code: online.code, pid: await loadPlayerId() });
  });
}

async function me() {
  const [pid, nick, look, tier] = await Promise.all([loadPlayerId(), loadNick(), loadMyLook().catch(() => null), loadTier().catch(() => 0)]);
  return { pid, nick, avatar: look?.avatar, frame: look?.frame, tier };
}

const ask = <T,>(event: string, payload: object) =>
  new Promise<T | null>((resolve) =>
    getSocket()
      .timeout(6000)
      .emit(event, payload, (err: Error | null, res: T) => resolve(err ? null : res))
  );

/** Now in this room: remembered so a closed app can get back in within a minute. */
function entered(code: string) {
  leftCode = null;
  AsyncStorage.setItem(ONLINE_KEY, code).catch(() => {});
}

/** Open a lobby (I'm the host). Returns its code, or null when the server can't be reached. */
export async function createRoom(coach: CoachId): Promise<string | null> {
  wire();
  const res = await ask<{ ok: boolean; code?: string }>("tt:create", { ...(await me()), coach });
  if (!res?.ok || !res.code) return null;
  // the room's first state comes right after this answer
  online = { code: res.code, phase: "lobby", planEnds: 0, seats: [], you: 0 };
  lobby = null;
  entered(res.code);
  emit();
  return res.code;
}

/** Join a friend's lobby, or get back into a game I left (within a minute). */
export async function joinRoom(code: string, coach: CoachId = "pass"): Promise<"ok" | "not_found" | "started" | "full" | "gone" | "error"> {
  wire();
  // the state that answers the join is for this room
  dropOnline();
  lobby = null;
  online = { code: code.toUpperCase(), phase: "lobby", planEnds: 0, seats: [], you: 0 };
  const res = await ask<{ ok: boolean; code?: string; error?: string }>("tt:join", { ...(await me()), code, coach });
  if (!res?.ok || !res.code) {
    online = null;
    emit();
    return (res?.error as "not_found" | "started" | "full" | "gone") ?? "error";
  }
  // its state (the lobby, or the game I'm back in) came with or right after this answer
  entered(res.code);
  emit();
  return "ok";
}

/** Host: start the game (the empty seats get house managers). */
export const startRoom = () => ask<{ ok: boolean }>("tt:start", {});

/** Back to the lobby I just left (online). */
export const rejoinCode = () => leftCode;

/**
 * Leave the lobby or the game screen. In a game this keeps the seat for a minute
 * (the server hands it to a house manager after that); in the lobby it's goodbye.
 */
export function leaveRoom() {
  if (!online) return;
  const inGame = online.phase !== "lobby" && online.phase !== "over";
  const code = online.code;
  getSocket().emit("tt:leave");
  dropOnline();
  lobby = null;
  if (inGame) {
    leftCode = code;
    markTaktikSeen();
  } else forgetLeft();
  emit();
}

function dropOnline() {
  online = null;
  players = [];
}

function forgetLeft() {
  leftCode = null;
  AsyncStorage.removeItem(ONLINE_KEY).catch(() => {});
}
