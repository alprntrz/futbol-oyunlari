import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

import { botTurn } from "@/lib/taktik/bot";
import { endRound, newLobby } from "@/lib/taktik/engine";
import type { CoachId, Lobby, Personality } from "@/lib/taktik/types";

import { loadNick, randomNick } from "./nick";

/**
 * The one Taktik Tahtası game on this phone (offline, against 7 house managers).
 * The engine mutates the lobby in place; `version` ticks after every change so
 * screens re-render, and the lobby is saved so a game survives closing the app.
 */
const KEY = "taktik-v1";
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
  const name = await loadNick();
  const seed = Math.floor(Math.random() * 2 ** 31);
  const bots = PERSONALITIES.map((personality) => ({ name: randomNick(), personality }));
  lobby = newLobby(seed, [{ name, coach }], bots);
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

export function quitTaktik() {
  lobby = null;
  emit();
}

/** Delete my data: forget the saved game. */
export function resetTaktik() {
  lobby = null;
  loaded = null;
  AsyncStorage.removeItem(KEY).catch(() => {});
}
