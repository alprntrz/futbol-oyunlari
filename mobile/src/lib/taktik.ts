import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

import { botTurn } from "@/lib/taktik/bot";
import { endRound, newLobby } from "@/lib/taktik/engine";
import type { CoachId, Lobby, Personality } from "@/lib/taktik/types";

import { loadNick, randomNick } from "./nick";

/**
 * The one Taktik Tahtası game on this phone (against 7 house managers, played like an online lobby).
 * The engine mutates the lobby in place; `version` ticks after every change so
 * screens re-render. There's no "continue later": like an online lobby, a manager
 * who leaves has `REJOIN_MS` to come back (the game screen stamps `seen` while it's
 * open); after that the game is gone and the next one starts fresh.
 */
const KEY = "taktik-v1";
const SEEN_KEY = "taktik-seen-v1";
/** how long a manager who left can still get back into the lobby */
export const REJOIN_MS = 60_000;
/** last moment the game screen was open (ms) */
let seen = 0;
const PERSONALITIES: Personality[] = ["loyal", "econ", "roller", "opportunist", "loyal", "econ", "opportunist"];

let lobby: Lobby | null = null;
let version = 0;
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  version++;
  listeners.forEach((fn) => fn());
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (lobby) AsyncStorage.setItem(KEY, JSON.stringify(lobby)).catch(() => {});
    else AsyncStorage.removeItem(KEY).catch(() => {});
  }, 300);
}

export function loadTaktik() {
  return (loaded ??= AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (raw) lobby = JSON.parse(raw) as Lobby;
    })
    .then(() => AsyncStorage.getItem(SEEN_KEY))
    .then((v) => {
      seen = Number(v) || 0;
      expireTaktik();
    })
    .catch(() => {})
    .then(() => {
      version++;
      listeners.forEach((fn) => fn());
    }));
}

/** Current lobby (null: none) and a version number that changes on every edit. */
export function useTaktik(): { lobby: Lobby | null; version: number } {
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
  return { lobby, version: v };
}

/** Start a new game with this manager style; the house managers get human-looking names. */
export async function startTaktik(coach: CoachId) {
  // the saved game must have loaded first, or it would land on top of the new one
  await loadTaktik();
  const name = await loadNick();
  const seed = Math.floor(Math.random() * 2 ** 31);
  const bots = PERSONALITIES.map((personality) => ({ name: randomNick(), personality }));
  lobby = newLobby(seed, [{ name, coach }], bots);
  markTaktikSeen();
  emit();
}

/** Run a change against the lobby (engine call) and re-render. */
export function act<T>(fn: (l: Lobby) => T): T | undefined {
  if (!lobby) return undefined;
  const r = fn(lobby);
  emit();
  return r;
}

/** End the planning phase: bots act and the round's matches are played. */
export function kickOff() {
  if (!lobby || lobby.over) return;
  endRound(lobby, botTurn);
  emit();
}

/** The game screen is open: keep the seat (called every few seconds and when the screen goes away). */
export function markTaktikSeen() {
  seen = Date.now();
  AsyncStorage.setItem(SEEN_KEY, String(seen)).catch(() => {});
}

/** A live game this manager left: how long is left to get back in (0: none, or too late). */
export function rejoinLeft(): number {
  if (!lobby || lobby.over || lobby.managers[0].place !== null) return 0;
  return Math.max(0, REJOIN_MS - (Date.now() - seen));
}

/** Away for longer than REJOIN_MS: the seat is lost, the game goes. Returns true if it went. */
export function expireTaktik(): boolean {
  if (!lobby || lobby.over || lobby.managers[0].place !== null) return false;
  if (Date.now() - seen < REJOIN_MS) return false;
  quitTaktik();
  return true;
}

export function quitTaktik() {
  lobby = null;
  emit();
}

/** Delete my data: forget the saved game. */
export function resetTaktik() {
  lobby = null;
  loaded = null;
  AsyncStorage.removeItem(KEY).catch(() => {});
  AsyncStorage.removeItem(SEEN_KEY).catch(() => {});
}
