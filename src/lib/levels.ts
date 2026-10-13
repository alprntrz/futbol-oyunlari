/**
 * Player level from total XP. Level 1 needs 100 XP, each next level 50 more
 * (100, 150, 200, …). Same curve as the quiz level in server.js (qzLevel).
 */
export interface LevelInfo {
  level: number;
  /** XP into the current level */
  into: number;
  /** XP the current level needs */
  need: number;
}

export function levelOf(xp: number): LevelInfo {
  let level = 1;
  let need = 100;
  let into = Math.max(0, Math.floor(xp));
  while (into >= need) {
    into -= need;
    level++;
    need = 100 + (level - 1) * 50;
  }
  return { level, into, need };
}

/** XP per game result. One table so the balance can be tuned in one place. */
export const XP = {
  /** Missing 11: per player found, plus a bonus for the full XI */
  xiPerPlayer: 3,
  xiFullTeam: 15,
  xiDailyBonus: 10,
  /** best run of consecutive right answers in a game, per step (Missing 11, Quiz) */
  comboStep: 2,
  /** Hat-trick series (online, random, vs computer) */
  htGameWin: 10,
  htSeriesWin: 30,
  htSeriesPlayed: 10,
  /** same-phone games: both players are on this phone, so just a thank-you */
  sameScreen: 5,
  /** Hat-trick single player: per player placed, capped */
  htSoloPerPlayer: 2,
  htSoloCap: 40,
  /** Mystery Player: win, plus a bonus for each unused guess */
  mysteryWin: 20,
  mysteryPerSpareGuess: 3,
  mysteryLoss: 5,
  /** Football Bingo */
  bingoComplete: 25,
  bingoPlayed: 10,
  /** Possession Play (online) */
  ppWin: 25,
  ppDraw: 15,
  ppLoss: 8,
  /** Unlimited modes (practice, extra grids) stop paying after this much a day */
  practiceDailyCap: 300,
} as const;

/**
 * Ranks: a football career over the levels. Every rank but the last has bronze,
 * silver and gold steps. The rank index is also the matchmaking tier (server.js
 * `tierGap`): random opponents are looked for in the same rank first.
 */
export const RANKS = [
  { id: "amateur", from: 1 },
  { id: "academy", from: 5 },
  { id: "bench", from: 10 },
  { id: "starter", from: 15 },
  { id: "captain", from: 20 },
  { id: "star", from: 30 },
  { id: "legend", from: 40 },
] as const;

export type RankId = (typeof RANKS)[number]["id"];
export type Medal = "bronze" | "silver" | "gold";

export interface RankInfo {
  index: number;
  id: RankId;
  /** null for the top rank */
  medal: Medal | null;
  /** level where the next rank starts, null at the top */
  nextAt: number | null;
}

export function rankOf(level: number): RankInfo {
  let index = 0;
  while (index + 1 < RANKS.length && level >= RANKS[index + 1].from) index++;
  const { id, from } = RANKS[index];
  const nextAt = index + 1 < RANKS.length ? RANKS[index + 1].from : null;
  if (nextAt === null) return { index, id, medal: null, nextAt };
  const step = Math.min(2, Math.floor(((level - from) * 3) / (nextAt - from)));
  return { index, id, medal: (["bronze", "silver", "gold"] as const)[step], nextAt };
}
