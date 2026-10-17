import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

import { dayNumber } from "@/lib/daily";

import { isGameAward, onXpAward } from "./xp";

/**
 * Play streak: days in a row with at least one finished game (any game pays XP
 * when it ends, so every game award counts; rewards and quests don't).
 */
interface StreakState {
  last: number;
  count: number;
  best: number;
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

/** Current streak (still alive if the last game was today or yesterday) and whether today counts yet. */
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
  return { count: alive ? s.count : 0, playedToday: s.last === today, best: s.best };
}

export function resetPlayStreak() {
  state = { last: 0, count: 0, best: 0 };
  loaded = null;
  emit();
}
