import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

/**
 * Dribbling Rush settings kept on the phone: the favourite club (the runner wears its kit)
 * and the best score.
 */
const CLUB_KEY = "rush-club";
const BEST_KEY = "rush-best";
let club = "galatasaray";
let best = 0;
const listeners = new Set<() => void>();
const ping = () => listeners.forEach((f) => f());
AsyncStorage.multiGet([CLUB_KEY, BEST_KEY])
  .then(([[, c], [, b]]) => {
    if (c) club = c;
    best = Number(b) || 0;
    ping();
  })
  .catch(() => {});

function useStore<T>(read: () => T): T {
  const [v, setV] = useState(read);
  useEffect(() => {
    const f = () => setV(read());
    listeners.add(f);
    return () => {
      listeners.delete(f);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return v;
}

export function useFavClub(): [string, (id: string) => void] {
  const v = useStore(() => club);
  return [
    v,
    (id: string) => {
      club = id;
      AsyncStorage.setItem(CLUB_KEY, id).catch(() => {});
      ping();
    },
  ];
}

export const useRushBest = () => useStore(() => best);

/** a finished run: keeps the best score; true when it's a new best */
export function recordRun(score: number): boolean {
  if (score <= best) return false;
  best = score;
  AsyncStorage.setItem(BEST_KEY, String(score)).catch(() => {});
  ping();
  return true;
}
