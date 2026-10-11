import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef } from "react";

import { dayNumber } from "@/lib/daily";
import { levelOf, XP, type LevelInfo } from "@/lib/levels";

/** Which game an award came from (per-game totals on the profile). */
export type XpGame = "xi" | "ht" | "qz" | "mystery" | "bingo" | "pp";
/** "bonus" = the daily sign-in bonus (adds to the total, not to a game) */
export type XpSource = XpGame | "bonus";

interface XpState {
  xp: number;
  byGame: Partial<Record<XpGame, number>>;
  /** award keys already paid (a game can't pay twice); newest last, trimmed */
  keys: string[];
  /** unlimited-mode XP earned on `practiceDay` */
  practiceDay: number;
  practiceToday: number;
}

export interface XpAward {
  gained: number;
  game: XpSource;
  before: LevelInfo & { xp: number };
  after: LevelInfo & { xp: number };
}

const KEY = "xp-v1";
const MAX_KEYS = 400;
const empty = (): XpState => ({ xp: 0, byGame: {}, keys: [], practiceDay: 0, practiceToday: 0 });

let cache: XpState | null = null;
let queue: Promise<unknown> = Promise.resolve();
const listeners = new Set<(a: XpAward) => void>();

async function load(): Promise<XpState> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? { ...empty(), ...(JSON.parse(raw) as XpState) } : empty();
  } catch {
    cache = empty();
  }
  return cache;
}

/** Total XP, level and per-game XP for the profile. */
export async function loadXp() {
  await queue; // after any pending award or server sync
  const s = await load();
  // copies: screens memoise on identity, so never hand out the live object
  return { xp: s.xp, byGame: { ...s.byGame }, ...levelOf(s.xp) };
}

/**
 * Pay XP once per `key` (e.g. "xi-daily-812"). `practice` awards count towards a
 * daily cap so unlimited modes can't be farmed. Resolves to the award, or null if
 * the key was already paid or the cap is used up.
 */
export function awardXp(key: string, game: XpGame, amount: number, opts: { practice?: boolean } = {}): Promise<XpAward | null> {
  // serialise: two games finishing together must not both read the old total
  const run = queue.then(async () => {
    const s = await load();
    if (amount <= 0 || s.keys.includes(key)) return null;
    let gained = Math.round(amount);
    if (opts.practice) {
      const today = dayNumber();
      if (s.practiceDay !== today) {
        s.practiceDay = today;
        s.practiceToday = 0;
      }
      gained = Math.min(gained, XP.practiceDailyCap - s.practiceToday);
      if (gained <= 0) return null;
      s.practiceToday += gained;
    }
    const before = { ...levelOf(s.xp), xp: s.xp };
    s.xp += gained;
    s.byGame = { ...s.byGame, [game]: (s.byGame[game] ?? 0) + gained };
    s.keys = [...s.keys, key].slice(-MAX_KEYS);
    await AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(() => {});
    const award: XpAward = { gained, game, before, after: { ...levelOf(s.xp), xp: s.xp } };
    listeners.forEach((fn) => fn(award));
    sink?.(key, game, gained);
    return award;
  });
  queue = run.catch(() => {});
  return run;
}

/** Signed in: every award is also sent to the account (lib/account.ts registers this). */
let sink: ((key: string, game: XpGame, amount: number) => void) | null = null;
export function setAwardSink(fn: typeof sink) {
  sink = fn;
}

/**
 * Take the account's totals from the server (signed in, or after a sync). `announce`
 * shows the toast for XP that came from the server (the daily bonus).
 */
export function applyServerTotals(xp: number, byGame: Partial<Record<XpGame, number>>, announce?: { gained: number; source: XpSource }) {
  queue = queue.then(async () => {
    const s = await load();
    const before = { ...levelOf(s.xp), xp: s.xp };
    s.xp = xp;
    s.byGame = { ...byGame };
    await AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(() => {});
    if (announce && announce.gained > 0) {
      const award: XpAward = { gained: announce.gained, game: announce.source, before, after: { ...levelOf(s.xp), xp: s.xp } };
      listeners.forEach((fn) => fn(award));
    }
  });
}

/** Signed out: this phone starts again as a fresh guest (the XP stays in the account). */
export async function resetLocalXp() {
  cache = empty();
  await AsyncStorage.removeItem(KEY).catch(() => {});
}

/** A full-screen ceremony (Victory modal) is up: the toast waits until it closes. */
let overlayOpen = false;
const overlayListeners = new Set<(open: boolean) => void>();
export function setOverlayOpen(open: boolean) {
  overlayOpen = open;
  overlayListeners.forEach((fn) => fn(open));
}
export function onOverlay(fn: (open: boolean) => void) {
  overlayListeners.add(fn);
  fn(overlayOpen);
  return () => {
    overlayListeners.delete(fn);
  };
}

/** Hear about every award (the "+XP" toast). Returns the unsubscribe. */
export function onXpAward(fn: (a: XpAward) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Wipe local XP (Settings → Delete my data clears AsyncStorage; this drops the cache too). */
export function resetXpCache() {
  cache = null;
}

/**
 * Award once when `ready` turns true. `key` null = nothing to award (e.g. a game
 * reopened after it finished is still paid only once, by its key).
 */
export function useXpAward(ready: boolean, key: string | null, game: XpGame, amount: number, opts?: { practice?: boolean }) {
  const sent = useRef<string | null>(null);
  const practice = !!opts?.practice;
  useEffect(() => {
    if (!ready || !key || sent.current === key) return;
    sent.current = key;
    awardXp(key, game, amount, { practice });
  }, [ready, key, game, amount, practice]);
}
