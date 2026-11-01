import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

import { cleanRondoMode, type RondoMode } from "@/lib/rondo";

const KEY = "rd-mode";
let current: RondoMode = "club";
const listeners = new Set<(m: RondoMode) => void>();

/** The Rondo mode picked on the hub (classic club or the two-club duel), remembered on the phone. */
export function useRondoMode(): [RondoMode, (m: RondoMode) => void] {
  const [mode, setMode] = useState<RondoMode>(current);
  useEffect(() => {
    listeners.add(setMode);
    AsyncStorage.getItem(KEY)
      .then((v) => {
        const m = cleanRondoMode(v);
        if (v && m !== current) {
          current = m;
          listeners.forEach((f) => f(current));
        }
      })
      .catch(() => {});
    return () => {
      listeners.delete(setMode);
    };
  }, []);
  const set = (m: RondoMode) => {
    current = m;
    listeners.forEach((f) => f(m));
    AsyncStorage.setItem(KEY, m).catch(() => {});
  };
  return [mode, set];
}
