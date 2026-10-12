import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useSyncExternalStore } from "react";

import { dayNumber } from "@/lib/daily";
import { seededRandom } from "@/lib/tiki";

import { awardXp, onXpAward } from "./xp";

/**
 * Daily quests: three a day, the same for everyone (seeded by the day), each pays
 * XP once when done; all three done pays a bonus. Progress lives on the phone.
 */
export type QuestEvent = "xi_finish" | "xi_players" | "ht_series" | "ht_win" | "qz_correct" | "mystery_solve" | "bingo_play" | "combo" | "xp";

export interface QuestDef {
  id: string;
  event: QuestEvent;
  target: number;
  /** "max": best single value counts (a combo); otherwise values add up */
  mode?: "max";
  /** strings key; {n} is the target */
  text: string;
  reward: number;
}

const POOL: QuestDef[] = [
  { id: "xi1", event: "xi_finish", target: 1, text: "qXiFinish", reward: 30 },
  { id: "xi15", event: "xi_players", target: 15, text: "qXiPlayers", reward: 40 },
  { id: "ht1", event: "ht_series", target: 1, text: "qHtSeries", reward: 30 },
  { id: "ht3", event: "ht_win", target: 3, text: "qHtWin", reward: 40 },
  { id: "qz5", event: "qz_correct", target: 5, text: "qQzCorrect", reward: 40 },
  { id: "my1", event: "mystery_solve", target: 1, text: "qMystery", reward: 30 },
  { id: "bg1", event: "bingo_play", target: 1, text: "qBingo", reward: 30 },
  { id: "cb4", event: "combo", target: 4, mode: "max", text: "qCombo", reward: 40 },
  { id: "xp100", event: "xp", target: 100, text: "qXp", reward: 30 },
];
export const ALL_DONE_BONUS = 50;

/** Today's three, from three different games. */
export function questsFor(day: number): QuestDef[] {
  const rand = seededRandom(day * 104729 + 7);
  const pool = POOL.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  // three different games (the XP and combo quests count as their own)
  const game = (q: QuestDef) => (q.event.startsWith("xi") ? "xi" : q.event.startsWith("ht") ? "ht" : q.event);
  const picked: QuestDef[] = [];
  for (const q of pool) if (picked.length < 3 && !picked.some((p) => game(p) === game(q))) picked.push(q);
  return picked;
}

interface QuestState {
  day: number;
  progress: Record<string, number>;
  /** one-off event keys already counted today (a reopened game doesn't count twice) */
  seen?: string[];
}

const KEY = "quests-v1";
let state: QuestState = { day: 0, progress: {} };
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

function load() {
  return (loaded ??= AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (raw) state = JSON.parse(raw) as QuestState;
    })
    .catch(() => {})
    .then(() => {
      rollDay();
      emit();
    }));
}

function rollDay() {
  const today = dayNumber();
  if (state.day !== today) state = { day: today, progress: {} };
}

/** Something happened in a game: move the matching quests forward, pay finished ones. */
export async function questEvent(event: QuestEvent, amount = 1, once?: string) {
  if (amount <= 0) return;
  await load();
  rollDay();
  if (once) {
    if (state.seen?.includes(once)) return;
    state = { ...state, seen: [...(state.seen ?? []), once] };
    AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  }
  const quests = questsFor(state.day);
  const finished: QuestDef[] = [];
  const progress = { ...state.progress };
  for (const q of quests) {
    if (q.event !== event) continue;
    const before = progress[q.id] ?? 0;
    if (before >= q.target) continue;
    const after = Math.min(q.target, q.mode === "max" ? Math.max(before, amount) : before + amount);
    progress[q.id] = after;
    if (after >= q.target) finished.push(q);
  }
  if (quests.every((q) => (progress[q.id] ?? 0) === (state.progress[q.id] ?? 0))) return;
  state = { ...state, progress };
  emit();
  await AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  for (const q of finished) await awardXp(`quest-${state.day}-${q.id}`, "bonus", q.reward, { label: "questDone" });
  if (finished.length && quests.every((q) => (state.progress[q.id] ?? 0) >= q.target)) {
    await awardXp(`quest-${state.day}-all`, "bonus", ALL_DONE_BONUS, { label: "questAllDone" });
  }
}

// "earn XP" quest: every game award counts (quest and calendar payouts don't)
onXpAward((a) => {
  if (a.game !== "bonus" && a.key !== "server") questEvent("xp", a.gained);
});

/** Today's quests with progress, for the Home card. */
export function useQuests() {
  const snap = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      load();
      return () => {
        listeners.delete(fn);
      };
    },
    () => state
  );
  const day = snap.day || dayNumber();
  return questsFor(day).map((q) => ({ ...q, progress: snap.day === day ? (snap.progress[q.id] ?? 0) : 0 }));
}

/** Forget everything (Settings → Delete my data clears storage; this drops the memory copy). */
export function resetQuests() {
  state = { day: 0, progress: {} };
  loaded = null;
  emit();
}

/** Count a finished game once (by `key`) when `ready` turns true. */
export function useQuestOnce(ready: boolean, key: string | null, events: [QuestEvent, number][]) {
  const sent = useRef<string | null>(null);
  const evRef = useRef(events);
  useEffect(() => {
    evRef.current = events;
  });
  useEffect(() => {
    if (!ready || !key || sent.current === key) return;
    sent.current = key;
    evRef.current.forEach(([e, n], i) => questEvent(e, n, `${key}#${i}`));
  }, [ready, key]);
}
