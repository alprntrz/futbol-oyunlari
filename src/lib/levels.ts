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
