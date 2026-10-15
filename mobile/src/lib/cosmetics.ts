import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState, useSyncExternalStore } from "react";

import { rankOf } from "@/lib/levels";

import { loadTotals } from "./history";
import { loadTrophies } from "./trophies";
import { loadXp, onXpAward, type XpGame } from "./xp";

/**
 * Looks you earn by playing, never buy: avatar frames open with your rank,
 * badges with what you've done. Kept on this phone.
 */

// ── Frames: one per rank (RANKS in src/lib/levels.ts), the colours of the ring

export const FRAMES = [
  { id: "none", rank: 0, colors: [] as string[] },
  { id: "bronze", rank: 1, colors: ["#F0B37E", "#9A5A2C", "#E2985E"] },
  { id: "silver", rank: 2, colors: ["#F4F7FA", "#8E9AA6", "#D5DCE3"] },
  { id: "gold", rank: 3, colors: ["#FFE58A", "#C99400", "#FFD54A"] },
  { id: "emerald", rank: 4, colors: ["#7DF0B6", "#0C8A55", "#3DDC97"] },
  { id: "galaxy", rank: 5, colors: ["#C4A1FF", "#4B2AA8", "#3BB3FF"] },
  { id: "legend", rank: 6, colors: ["#FF5F6D", "#FFC371", "#47E891", "#3BB3FF", "#C26BFF", "#FF5F6D"] },
] as const;

export type FrameId = (typeof FRAMES)[number]["id"];
export const frameById = (id: string | null | undefined) => FRAMES.find((f) => f.id === id);
export const frameUnlocked = (id: FrameId, level: number) => (frameById(id)?.rank ?? 99) <= rankOf(level).index;

const FRAME_KEY = "frame-v1";
/** null = automatic: the best frame your rank has opened */
let chosen: FrameId | null = null;
let frameLoaded = false;
const listeners = new Set<() => void>();

export function useChosenFrame(): FrameId | null {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      if (!frameLoaded) {
        frameLoaded = true;
        AsyncStorage.getItem(FRAME_KEY)
          .then((v) => {
            if (v && frameById(v)) chosen = v as FrameId;
            listeners.forEach((l) => l());
          })
          .catch(() => {});
      }
      return () => {
        listeners.delete(fn);
      };
    },
    () => chosen
  );
}

export function saveFrame(id: FrameId | null) {
  chosen = id;
  listeners.forEach((l) => l());
  if (id) AsyncStorage.setItem(FRAME_KEY, id).catch(() => {});
  else AsyncStorage.removeItem(FRAME_KEY).catch(() => {});
}

/** The frame to draw: the chosen one if it's still open, else the best your rank has. */
export function frameFor(level: number, choice: FrameId | null): FrameId {
  if (choice && frameUnlocked(choice, level)) return choice;
  return FRAMES[Math.min(rankOf(level).index, FRAMES.length - 1)].id;
}

/** This phone's frame right now (follows level ups and the choice in Edit profile). */
export function useMyFrame(): FrameId {
  const choice = useChosenFrame();
  const [level, setLevel] = useState(1);
  useEffect(() => {
    loadXp().then((x) => setLevel(x.level));
    return onXpAward((a) => setLevel(a.after.level));
  }, []);
  return frameFor(level, choice);
}

// ── Badges

export type BadgeId =
  | "firstGame"
  | "allGames"
  | "streak7"
  | "streak30"
  | "level10"
  | "level20"
  | "level40"
  | "wins10"
  | "wins50"
  | "trophies5"
  | "perfectDuel"
  | "dailyDuel7";

export interface Badge {
  id: BadgeId;
  /** SF Symbol until the 3D art arrives, and its colour */
  icon: string;
  color: string;
  progress: number;
  target: number;
  done: boolean;
}

const GAMES: XpGame[] = ["xi", "ht", "qz", "mystery", "bingo", "pp", "tt", "dz"];

/** Every badge with its progress, worked out from what this phone already keeps. */
export async function loadBadges(bestStreak: number): Promise<Badge[]> {
  const [xp, totals, trophies] = await Promise.all([loadXp(), loadTotals(), loadTrophies()]);
  const played = GAMES.filter((g) => (xp.byGame[g] ?? 0) > 0).length;
  const list: Omit<Badge, "done">[] = [
    { id: "firstGame", icon: "flag.fill", color: "#22A55A", progress: xp.xp > 0 ? 1 : 0, target: 1 },
    { id: "allGames", icon: "square.grid.2x2.fill", color: "#2F6FE4", progress: played, target: GAMES.length },
    { id: "streak7", icon: "flame.fill", color: "#F97316", progress: bestStreak, target: 7 },
    { id: "streak30", icon: "flame.circle.fill", color: "#DC2626", progress: bestStreak, target: 30 },
    { id: "level10", icon: "10.circle.fill", color: "#0EA5E9", progress: xp.level, target: 10 },
    { id: "level20", icon: "20.circle.fill", color: "#8B5CF6", progress: xp.level, target: 20 },
    { id: "level40", icon: "crown.fill", color: "#E3A008", progress: xp.level, target: 40 },
    { id: "wins10", icon: "hand.thumbsup.fill", color: "#16A34A", progress: totals.wins, target: 10 },
    { id: "wins50", icon: "star.fill", color: "#CA8A04", progress: totals.wins, target: 50 },
    { id: "trophies5", icon: "trophy.fill", color: "#D97706", progress: trophies, target: 5 },
    { id: "perfectDuel", icon: "sparkles", color: "#DB2777", progress: totals.perfectDuels, target: 1 },
    { id: "dailyDuel7", icon: "calendar", color: "#0D9488", progress: totals.dailyDuels, target: 7 },
  ];
  return list.map((b) => ({ ...b, progress: Math.min(b.progress, b.target), done: b.progress >= b.target }));
}

/** Delete my data */
export function resetCosmetics() {
  chosen = null;
  frameLoaded = false;
}
