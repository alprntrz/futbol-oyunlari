import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef } from "react";

import { dayNumber } from "@/lib/daily";
import { levelOf, rankOf, XP, type LevelInfo } from "@/lib/levels";
import { AD_RULES } from "@/lib/plus";

import { plusActive } from "./plus";

/** Which game an award came from (per-game totals on the profile). */
export type XpGame = "xi" | "ht" | "qz" | "mystery" | "bingo" | "pp" | "tt" | "dz" | "rd" | "wm";
/** "bonus" = the daily sign-in bonus (adds to the total, not to a game) */
export type XpSource = XpGame | "bonus";

interface XpState {
  xp: number;
  byGame: Partial<Record<XpSource, number>>;
  /** award keys already paid (a game can't pay twice); newest last, trimmed */
  keys: string[];
  /** unlimited-mode XP earned on `practiceDay` */
  practiceDay: number;
  practiceToday: number;
  /** rewarded ads watched on `practiceDay` to lift the cap (AD_RULES.capLiftXp each) */
  capLifts?: number;
}

/** One line on the end-of-game reward screen ("Found 9/11"). */
export interface XpStat {
  label: string;
  value: string;
  tone?: "green" | "amber" | "blue" | "coral";
}

export interface XpOptions {
  /** unlimited mode: counts towards the daily practice cap */
  practice?: boolean;
  /** with stats the award opens the full reward screen ("Claim XP") instead of the toast */
  stats?: XpStat[];
  /** reward screen headline, e.g. "Full XI!" */
  title?: string;
  /** toast line instead of "+N XP", e.g. a finished quest */
  label?: string;
}

export interface XpAward {
  key: string;
  gained: number;
  game: XpSource;
  stats?: XpStat[];
  title?: string;
  label?: string;
  before: LevelInfo & { xp: number };
  after: LevelInfo & { xp: number };
}

const KEY = "xp-v1";
const MAX_KEYS = 400;
const empty = (): XpState => ({ xp: 0, byGame: {}, keys: [], practiceDay: 0, practiceToday: 0, capLifts: 0 });

/** Today's practice-XP cap: the base, plus what rewarded ads opened; no cap at all with Plus. */
function practiceCap(s: XpState) {
  if (plusActive()) return Infinity;
  return XP.practiceDailyCap + (s.capLifts ?? 0) * AD_RULES.capLiftXp;
}
function rollPracticeDay(s: XpState) {
  const today = dayNumber();
  if (s.practiceDay !== today) {
    s.practiceDay = today;
    s.practiceToday = 0;
    s.capLifts = 0;
  }
}

/** The practice cap was hit (an award was cut or dropped): the sheet offering an ad / Plus listens. */
export interface CapHit {
  /** XP the player would have had */
  lost: number;
  liftsLeft: number;
}
const capListeners = new Set<(c: CapHit) => void>();
export function onCapHit(fn: (c: CapHit) => void) {
  capListeners.add(fn);
  return () => {
    capListeners.delete(fn);
  };
}

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
export function awardXp(key: string, game: XpSource, amount: number, opts: XpOptions = {}): Promise<XpAward | null> {
  // serialise: two games finishing together must not both read the old total
  const run = queue.then(async () => {
    const s = await load();
    if (amount <= 0 || s.keys.includes(key)) return null;
    let gained = Math.round(amount);
    if (opts.practice) {
      rollPracticeDay(s);
      const room = Math.max(0, practiceCap(s) - s.practiceToday);
      if (room < gained) {
        const hit: CapHit = { lost: gained - room, liftsLeft: Math.max(0, AD_RULES.capLiftsPerDay - (s.capLifts ?? 0)) };
        // the key is spent either way: a game never pays twice, even after an ad lifts the cap
        if (room <= 0) {
          s.keys = [...s.keys, key].slice(-MAX_KEYS);
          await AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(() => {});
          capListeners.forEach((fn) => fn(hit));
          return null;
        }
        setTimeout(() => capListeners.forEach((fn) => fn(hit)), 0);
      }
      gained = Math.min(gained, room);
      s.practiceToday += gained;
    }
    const before = { ...levelOf(s.xp), xp: s.xp };
    s.xp += gained;
    s.byGame = { ...s.byGame, [game]: (s.byGame[game] ?? 0) + gained };
    s.keys = [...s.keys, key].slice(-MAX_KEYS);
    await AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(() => {});
    const award: XpAward = { key, gained, game, before, after: { ...levelOf(s.xp), xp: s.xp }, stats: opts.stats, title: opts.title, label: opts.label };
    listeners.forEach((fn) => fn(award));
    sink?.(key, game, gained);
    return award;
  });
  queue = run.catch(() => {});
  return run;
}

/** Where today's practice XP stands (the cap sheet and the paywall show it). */
export async function loadPracticeToday() {
  await queue;
  const s = await load();
  rollPracticeDay(s);
  return { used: s.practiceToday, cap: practiceCap(s), lifts: s.capLifts ?? 0, liftsLeft: Math.max(0, AD_RULES.capLiftsPerDay - (s.capLifts ?? 0)) };
}

/** A rewarded ad was watched through: open AD_RULES.capLiftXp more practice XP for today. */
export function liftPracticeCap() {
  const run = queue.then(async () => {
    const s = await load();
    rollPracticeDay(s);
    if ((s.capLifts ?? 0) >= AD_RULES.capLiftsPerDay) return false;
    s.capLifts = (s.capLifts ?? 0) + 1;
    await AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(() => {});
    return true;
  });
  queue = run.catch(() => {});
  return run;
}

/** Signed in: every award is also sent to the account (lib/account.ts registers this). */
let sink: ((key: string, game: XpSource, amount: number) => void) | null = null;
export function setAwardSink(fn: typeof sink) {
  sink = fn;
}

/**
 * Take the account's totals from the server (signed in, or after a sync). `announce`
 * shows the toast for XP that came from the server (the daily bonus).
 */
export function applyServerTotals(xp: number, byGame: Partial<Record<XpSource, number>>, announce?: { gained: number; source: XpSource }) {
  queue = queue.then(async () => {
    const s = await load();
    const before = { ...levelOf(s.xp), xp: s.xp };
    s.xp = xp;
    s.byGame = { ...byGame };
    await AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(() => {});
    if (announce && announce.gained > 0) {
      const award: XpAward = { key: "server", gained: announce.gained, game: announce.source, before, after: { ...levelOf(s.xp), xp: s.xp } };
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

/** The reward screen is up: the toast waits for it too. */
let rewardOpen = false;
const rewardListeners = new Set<(open: boolean) => void>();
export function setRewardOpen(open: boolean) {
  rewardOpen = open;
  rewardListeners.forEach((fn) => fn(open));
}
export function onRewardOpen(fn: (open: boolean) => void) {
  rewardListeners.add(fn);
  fn(rewardOpen);
  return () => {
    rewardListeners.delete(fn);
  };
}

/** A finished game, not a reward, quest or server sync (Dribbling Rush pays as "bonus" with "run-" keys). */
export function isGameAward(a: XpAward) {
  return a.key !== "server" && (a.game !== "bonus" || a.key.startsWith("run-"));
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
export function useXpAward(ready: boolean, key: string | null, game: XpSource, amount: number, opts?: XpOptions) {
  const sent = useRef<string | null>(null);
  // latest options without re-running the effect when a stats array is rebuilt
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });
  useEffect(() => {
    if (!ready || !key || sent.current === key) return;
    sent.current = key;
    awardXp(key, game, amount, optsRef.current);
  }, [ready, key, game, amount]);
}

/** Matchmaking tier = rank index of this phone's level (sent with every queue request). */
export async function loadTier() {
  const { level } = await loadXp();
  return rankOf(level).index;
}
