/**
 * Taktik Tahtası / Pitch Chess — every number of the game in one place
 * (docs/design/taktik-tahtasi.md). Tuned with mobile/scripts/taktik-sim.mts.
 * Platform-free: no React, no DOM.
 */

export type Pos = "GK" | "DEF" | "MID" | "FWD";
export type Cost = 1 | 2 | 3 | 4 | 5;
export type Star = 1 | 2 | 3;

export const MANAGERS = 8;
export const START_HP = 100;
export const MAX_LEVEL = 9;
export const BENCH = 8;
export const SHOP_SIZE = 5;
export const MAX_ITEMS_PER_UNIT = 2;

/** pitch: 1 GK, 4 DEF, 4 MID, 3 FWD; slot index → zone */
export const SLOTS: Pos[] = ["GK", "DEF", "DEF", "DEF", "DEF", "MID", "MID", "MID", "MID", "FWD", "FWD", "FWD"];
/** players allowed on the pitch per club level (index = level - 1) */
export const LEVEL_SLOTS = [3, 4, 5, 6, 7, 8, 9, 10, 11];
/** XP needed to go from level i+1 to i+2 */
export const LEVEL_XP = [2, 2, 6, 10, 20, 36, 48, 72];

// ── Economy
export const INCOME = 5;
/** savings bonus: holding this much gold when the round kicks off pays extra at the end of it */
export const SAVINGS: { from: number; gold: number }[] = [
  { from: 20, gold: 4 },
  { from: 10, gold: 2 },
];
export const savingsBonus = (gold: number) => SAVINGS.find((s) => gold >= s.from)?.gold ?? 0;
export const WIN_GOLD = 1;
export const REROLL_COST = 2;
export const XP_COST = 4;
export const XP_BUY = 4;
export const XP_PER_ROUND = 2;
/** streak length → bonus gold (win or loss streak) */
export const streakGold = (n: number) => (n >= 5 ? 3 : n >= 4 ? 2 : n >= 2 ? 1 : 0);

// ── Cards
/** copies of each player in the lobby pool, by cost */
export const COPIES: Record<Cost, number> = { 1: 22, 2: 18, 3: 15, 4: 10, 5: 8 };
/** how many players of each cost a lobby pool holds */
export const POOL_SIZE: Record<Cost, number> = { 1: 13, 2: 13, 3: 13, 4: 12, 5: 9 };
export const BASE_POWER: Record<Cost, number> = { 1: 40, 2: 55, 3: 70, 4: 85, 5: 100 };
export const STAR_MULT: Record<Star, number> = { 1: 1, 2: 1.8, 3: 3.2 };
/** share of a player's power that goes to attack in each zone (the rest defends; the keeper keeps) */
export const ZONE_ATK: Record<Pos, number> = { GK: 0, DEF: 0.15, MID: 0.5, FWD: 0.85 };

/** chance (by stage) that a shop's guaranteed star card is a legend (5) rather than a 4 */
export const PREMIUM_FIVE = [0, 0, 0.12, 0.2, 0.28, 0.35, 0.4];
/** shop odds (%) for cost 1..5, per club level */
export const SHOP_ODDS: number[][] = [
  [100, 0, 0, 0, 0],
  [100, 0, 0, 0, 0],
  [75, 25, 0, 0, 0],
  [55, 30, 15, 0, 0],
  [45, 33, 20, 2, 0],
  [30, 40, 25, 5, 0],
  [19, 30, 35, 15, 1],
  [16, 20, 35, 25, 4],
  [9, 15, 30, 30, 16],
];

/** playing out of position: own zone 1, neighbour 0.7, far 0.4; a keeper anywhere else or an outfielder in goal 0.2 */
export function zoneFit(native: Pos, zone: Pos): number {
  if (native === zone) return 1;
  if (native === "GK" || zone === "GK") return 0.2;
  const order: Pos[] = ["DEF", "MID", "FWD"];
  return Math.abs(order.indexOf(native) - order.indexOf(zone)) === 1 ? 0.7 : 0.4;
}

// ── Rounds
export type RoundKind = "pvp" | "pve";
/** stage 1: friendlies only; then each stage is 5 rounds */
export const STAGE1: RoundKind[] = ["pve", "pve"];
export const STAGE: RoundKind[] = ["pvp", "pvp", "pvp", "pve", "pvp"];
/** a tactics card is offered at the start of these stages */
export const AUGMENT_STAGES = [2, 3, 4];
/** seconds to set up before every match kicks off (everyone at once when played online); 25 s every stage, the first ones too */
export const planSeconds = () => 25;
/** free swaps per tactics card offer (shared by the three cards) */
export const AUGMENT_REROLLS = 2;

/** losing costs: 6 + 3 × (stage − 1) + goal difference (max 5); a shoot-out loss counts as 1 goal */
export const damage = (stage: number, goalDiff: number) => 6 + 3 * (stage - 1) + Math.min(5, Math.max(1, goalDiff));

// ── Match
export const SLICES = 12;
/** the last 4 slices are the "late" part of the match */
export const LATE_FROM = 8;

// ── Scout report
/** chance that a shop roll hides one card behind clues; at most this many per stage */
export const SCOUT_CHANCE = 0.3;
export const SCOUT_PER_STAGE = 3;
export const SCOUT_DISCOUNT = 2;
