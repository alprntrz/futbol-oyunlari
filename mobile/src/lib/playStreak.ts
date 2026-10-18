import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

import { dayNumber } from "@/lib/daily";
import { AD_RULES } from "@/lib/plus";

import { isGameAward, onXpAward } from "./xp";

/**
 * Play streak: days in a row with at least one finished game (any game pays XP
 * when it ends, so every game award counts; rewards and quests don't).
 */
interface StreakState {
  last: number;
  count: number;
  best: number;
  /** day number of the last repair (one in AD_RULES.streakRepairDays; progress.ts keeps it with the rest) */
  repaired?: number;
}

const KEY = "play-streak-v1";
let state: StreakState = { last: 0, count: 0, best: 0 };
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

function load() {
  return (loaded ??= AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (raw) state = JSON.parse(raw) as StreakState;
    })
    .catch(() => {})
    .then(emit));
}

onXpAward((a) => {
  if (!isGameAward(a)) return;
  load().then(() => {
    const today = dayNumber();
    if (state.last === today) return;
    const count = state.last === today - 1 ? state.count + 1 : 1;
    state = { last: today, count, best: Math.max(state.best, count) };
    emit();
    AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  });
});

/** A streak that just broke: the player missed exactly yesterday, and a repair is allowed this month. */
function repairable(s: StreakState, today: number) {
  return s.last === today - 2 && s.count > 0 && (s.repaired === undefined || today - s.repaired >= AD_RULES.streakRepairDays) ? s.count : 0;
}

/**
 * Current streak (still alive if the last game was today or yesterday), whether today counts yet, and
 * `lost`: a streak that broke yesterday and can still be repaired (rewarded ad, or free with Plus).
 */
export function usePlayStreak() {
  const s = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      load();
      return () => {
        listeners.delete(fn);
      };
    },
    () => state
  );
  const today = dayNumber();
  const alive = s.last >= today - 1;
  return { count: alive ? s.count : 0, playedToday: s.last === today, best: s.best, lost: repairable(s, today) };
}

/** Put yesterday back: the streak carries on as if the missed day was played. True when it did. */
export async function repairStreak() {
  await load();
  const today = dayNumber();
  if (!repairable(state, today)) return false;
  state = { ...state, last: today - 1, repaired: today };
  emit();
  await AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  return true;
}

export function resetPlayStreak() {
  state = { last: 0, count: 0, best: 0 };
  loaded = null;
  emit();
}
