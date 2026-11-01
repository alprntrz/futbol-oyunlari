import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

/**
 * Players this phone blocked, by their ref (an opaque handle from the server, server-refs.js). The
 * list stays on the phone; the server gets it (lib/socket.ts: handshake + `blk:set`) only to keep these players
 * out of matchmaking, quiz rooms and invites. Their nicknames are hidden in boards and lists.
 */
export interface Blocked {
  ref: string;
  nick: string;
  at: number;
}

const KEY = "blocked-v1";
let list: Blocked[] = [];
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

export function loadBlocks() {
  return (loaded ??= AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (raw) list = JSON.parse(raw) as Blocked[];
    })
    .catch(() => {})
    .then(emit));
}

/** The refs, for the socket handshake. */
export async function blockedRefs(): Promise<string[]> {
  await loadBlocks();
  return list.map((b) => b.ref);
}

const changed = new Set<(refs: string[]) => void>();
/** The list changed (lib/socket.ts tells the server). */
export function onBlocksChange(fn: (refs: string[]) => void) {
  changed.add(fn);
}

function save(next: Blocked[]) {
  list = next;
  emit();
  AsyncStorage.setItem(KEY, JSON.stringify(list)).catch(() => {});
  changed.forEach((fn) => fn(list.map((b) => b.ref)));
}

export async function blockPlayer(ref: string, nick: string) {
  await loadBlocks();
  if (list.some((b) => b.ref === ref)) return;
  save([{ ref, nick: nick.slice(0, 24), at: Date.now() }, ...list].slice(0, 200));
}

export async function unblockPlayer(ref: string) {
  await loadBlocks();
  save(list.filter((b) => b.ref !== ref));
}

export function useBlocked(): Blocked[] {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      loadBlocks();
      return () => {
        listeners.delete(fn);
      };
    },
    () => list
  );
}

/** Whether a ref is blocked (for hiding a nickname in a list). */
export function useIsBlocked() {
  const l = useBlocked();
  return (ref?: string | null) => !!ref && l.some((b) => b.ref === ref);
}

/** A made-up ref for a house player, so it can be reported or blocked like anyone else. */
export function houseRef(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h.toString(16).padStart(8, "0") + (Math.imul(h, 2654435761) >>> 0).toString(16).padStart(8, "0");
}
