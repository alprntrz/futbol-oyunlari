import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Difficulty, SlotState } from "@/lib/types";

/** Same shape and rules as the web app's src/lib/stats.ts, on AsyncStorage. */
export interface GameStats {
  played: number;
  won: number;
  streak: number;
  bestStreak: number;
  lastWonDay: number | null;
  /** day number → players found that day (daily puzzle only) */
  history?: Record<number, number>;
}

export interface DayState {
  matchId: string;
  difficulty: Difficulty;
  slots: SlotState[];
  gaveUp: boolean;
  recorded: boolean;
}

const STATS_KEY = "missing11-stats";
const EMPTY: GameStats = { played: 0, won: 0, streak: 0, bestStreak: 0, lastWonDay: null };

async function readJSON<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function loadStats(): Promise<GameStats> {
  return (await readJSON<GameStats>(STATS_KEY)) ?? { ...EMPTY };
}

export async function recordResult(won: boolean, day: number, found: number): Promise<GameStats> {
  const s = await loadStats();
  s.played++;
  s.history = { ...s.history, [day]: found };
  if (won) {
    s.won++;
    s.streak = s.lastWonDay === day - 1 ? s.streak + 1 : 1;
    s.lastWonDay = day;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
  } else {
    s.streak = 0;
  }
  await AsyncStorage.setItem(STATS_KEY, JSON.stringify(s));
  return s;
}

export function loadDayState(day: number) {
  return readJSON<DayState>(`missing11-day-${day}`);
}

export function saveDayState(day: number, state: DayState) {
  return AsyncStorage.setItem(`missing11-day-${day}`, JSON.stringify(state));
}
