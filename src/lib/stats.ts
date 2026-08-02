export interface GameStats {
  played: number;
  won: number;
  streak: number;
  bestStreak: number;
  lastWonDay: number | null;
}

const KEY = "missing11-stats";

export function loadStats(): GameStats {
  if (typeof window === "undefined")
    return { played: 0, won: 0, streak: 0, bestStreak: 0, lastWonDay: null };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as GameStats;
  } catch {}
  return { played: 0, won: 0, streak: 0, bestStreak: 0, lastWonDay: null };
}

export function recordResult(won: boolean, day: number | null): GameStats {
  const s = loadStats();
  s.played++;
  if (won) {
    s.won++;
    if (day !== null) {
      s.streak = s.lastWonDay === day - 1 ? s.streak + 1 : 1;
      s.lastWonDay = day;
      s.bestStreak = Math.max(s.bestStreak, s.streak);
    }
  } else if (day !== null) {
    s.streak = 0;
  }
  localStorage.setItem(KEY, JSON.stringify(s));
  return s;
}

/** Daily progress persistence so refreshing doesn't reset the board. */
export function saveDayState(day: number, state: unknown) {
  localStorage.setItem(`missing11-day-${day}`, JSON.stringify(state));
}

export function loadDayState<T>(day: number): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`missing11-day-${day}`);
    if (raw) return JSON.parse(raw) as T;
  } catch {}
  return null;
}
