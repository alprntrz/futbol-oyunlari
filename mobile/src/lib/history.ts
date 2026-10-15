import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect } from "react";

/**
 * Recent two-player matches (Tic-Tac-Toe series, Possession, Card Duel), kept
 * on this phone only, newest first, for the "Recent matches" list on Profile.
 */
const KEY = "history-v1";
const MAX = 30;

export interface MatchRecord {
  /** unique per match, so a re-render never records it twice */
  key: string;
  game: "ht" | "pp" | "dz";
  opponent: string;
  result: "win" | "loss" | "draw";
  /** e.g. "3–1" from my side */
  score: string;
  at: number;
}

export async function loadHistory(): Promise<MatchRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as MatchRecord[]) : [];
  } catch {
    return [];
  }
}

let queue = Promise.resolve();
export function recordMatch(r: Omit<MatchRecord, "at">) {
  queue = queue.then(async () => {
    const list = await loadHistory();
    if (list.some((x) => x.key === r.key)) return;
    await AsyncStorage.setItem(KEY, JSON.stringify([{ ...r, at: Date.now() }, ...list].slice(0, MAX))).catch(() => {});
  });
}

/** Record once when `ready` (the match is decided). */
export function useRecordMatch(ready: boolean, r: Omit<MatchRecord, "at"> | null) {
  const key = ready && r ? r.key : null;
  useEffect(() => {
    if (key && r) recordMatch(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
