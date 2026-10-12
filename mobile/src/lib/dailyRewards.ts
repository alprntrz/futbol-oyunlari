import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

import { dayNumber } from "@/lib/daily";

import { awardXp } from "./xp";

/**
 * Seven-day reward calendar: come back each day to claim the next, bigger reward.
 * Missing a day starts the week over. Fixed amounts (no random chests).
 */
export const CALENDAR = [10, 15, 20, 30, 40, 60, 100];

interface CalState {
  /** day number of the last claim */
  last: number;
  /** index of the last claimed slot (0-6) */
  step: number;
}

const KEY = "daily-rewards-v1";
let state: CalState = { last: 0, step: -1 };
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

function load() {
  return (loaded ??= AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (raw) state = JSON.parse(raw) as CalState;
    })
    .catch(() => {})
    .then(emit));
}

/** Where today stands: which slot is today's and whether it's taken. */
function view(s: CalState) {
  const today = dayNumber();
  if (s.last === today) return { todayIndex: s.step, claimed: true };
  // claimed yesterday: the next slot; a gap (or a full week) starts over
  const next = s.last === today - 1 && s.step < CALENDAR.length - 1 ? s.step + 1 : 0;
  return { todayIndex: next, claimed: false };
}

export function useDailyRewards() {
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
  return view(s);
}

/** Take today's reward (once a day). */
export async function claimDaily() {
  await load();
  const v = view(state);
  if (v.claimed) return null;
  const today = dayNumber();
  state = { last: today, step: v.todayIndex };
  emit();
  await AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  return awardXp(`calendar-${today}`, "bonus", CALENDAR[v.todayIndex], { label: "dailyClaimed" });
}

export function resetDailyRewards() {
  state = { last: 0, step: -1 };
  loaded = null;
  emit();
}
