import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect } from "react";

import { questEvent, type QuestEvent } from "./quests";

/**
 * Recent two-player matches (Tic-Tac-Toe series, Possession, Card Duel), kept
 * on this phone only, newest first, for the "Recent matches" list on Profile.
 */
const KEY = "history-v1";
const MAX = 30;

export interface MatchRecord {
  /** unique per match, so a re-render never records it twice */
  key: string;
  game: "ht" | "pp" | "dz" | "rd" | "wm";
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

/** all-time counts (the list keeps only the last MAX), for badges */
const TOTALS = "history-totals-v1";
export interface MatchTotals {
  games: number;
  wins: number;
  /** Card Duel won 7–0 */
  perfectDuels: number;
  /** today's duel played, any result */
  dailyDuels: number;
}

export async function loadTotals(): Promise<MatchTotals> {
  try {
    const raw = await AsyncStorage.getItem(TOTALS);
    return { games: 0, wins: 0, perfectDuels: 0, dailyDuels: 0, ...(raw ? (JSON.parse(raw) as Partial<MatchTotals>) : {}) };
  } catch {
    return { games: 0, wins: 0, perfectDuels: 0, dailyDuels: 0 };
  }
}

/** daily quests a recorded match counts for (Tic-Tac-Toe counts its series in SeriesEnd) */
function questFor(r: Omit<MatchRecord, "at">): QuestEvent | null {
  if (r.game === "dz") return "dz_play";
  if (r.game === "pp") return "pp_play";
  if (r.result !== "win") return null;
  return r.game === "rd" ? "rd_win" : r.game === "wm" ? "wm_win" : null;
}

let queue = Promise.resolve();
export function recordMatch(r: Omit<MatchRecord, "at">) {
  queue = queue.then(async () => {
    const list = await loadHistory();
    if (list.some((x) => x.key === r.key)) return;
    const quest = questFor(r);
    if (quest) questEvent(quest, 1, `match-${r.key}`);
    await AsyncStorage.setItem(KEY, JSON.stringify([{ ...r, at: Date.now() }, ...list].slice(0, MAX))).catch(() => {});
    const t = await loadTotals();
    t.games++;
    if (r.result === "win") t.wins++;
    if (r.game === "dz" && r.result === "win" && r.score === "7–0") t.perfectDuels++;
    if (r.key.startsWith("dz-daily-")) t.dailyDuels++;
    await AsyncStorage.setItem(TOTALS, JSON.stringify(t)).catch(() => {});
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
