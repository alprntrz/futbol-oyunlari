import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

import { dayNumber } from "@/lib/daily";
import { checkHand, themeForDay } from "@/lib/duel";

/**
 * Card Duel on this phone: today's drafted hand (a hand is for one day and one
 * theme) and whether today's challenge was played. Saved in AsyncStorage.
 */
const KEY = "duel-v1";

interface Saved {
  day: number;
  hand: number[];
  /** the daily challenge result, once played */
  daily: { mine: number; theirs: number } | null;
}

let saved: Saved | null = null;
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => {
  listeners.forEach((fn) => fn());
  AsyncStorage.setItem(KEY, JSON.stringify(saved)).catch(() => {});
};

function load() {
  if (loaded) return;
  loaded = true;
  AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (raw) saved = JSON.parse(raw) as Saved;
      listeners.forEach((fn) => fn());
    })
    .catch(() => {});
}

/** a stable empty state per day (the store snapshot must not change between reads) */
let empty: Saved = { day: -1, hand: [], daily: null };

/** today's state: a hand from another day counts as none */
function today(): Saved {
  const day = dayNumber();
  if (saved?.day === day) return saved;
  if (empty.day !== day) empty = { day, hand: [], daily: null };
  return empty;
}

export function useDuel(): Saved & { theme: ReturnType<typeof themeForDay>; ready: boolean } {
  const s = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      load();
      return () => {
        listeners.delete(fn);
      };
    },
    today
  );
  const theme = themeForDay(s.day);
  return { ...s, theme, ready: checkHand(s.hand, theme) === "ok" };
}

export function saveHand(hand: number[]) {
  saved = { ...today(), hand };
  emit();
}

export function saveDaily(mine: number, theirs: number) {
  saved = { ...today(), daily: { mine, theirs } };
  emit();
}

/** Delete my data */
export function resetDuel() {
  saved = null;
  loaded = false;
}
