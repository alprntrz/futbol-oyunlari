import { BORN, DIED } from "@/data/born";
import { PLAYERS, type GridPlayer } from "@/data/players";
import { TAKTIK_POS } from "@/data/taktik";

/**
 * What the player search shows under a name: position group and age (or the
 * years of life for a player who has died). Data: src/data/born.ts (Wikidata)
 * and src/data/taktik.ts (positions). Platform-free.
 */
export type PosGroup = "G" | "D" | "M" | "F";

const indexOf = new Map<GridPlayer, number>(PLAYERS.map((p, i) => [p, i]));
const DAY0 = Date.UTC(1900, 0, 1);
const dateOf = (days: number) => new Date(DAY0 + days * 86400000);

export interface PlayerInfo {
  pos: PosGroup | null;
  /** age today, for a living player */
  age: number | null;
  /** birth and death years, for a player who has died */
  life: [number, number] | null;
}

function yearsBetween(a: Date, b: Date) {
  let y = b.getUTCFullYear() - a.getUTCFullYear();
  if (b.getUTCMonth() < a.getUTCMonth() || (b.getUTCMonth() === a.getUTCMonth() && b.getUTCDate() < a.getUTCDate())) y--;
  return y;
}

export function playerInfo(p: GridPlayer, today = new Date()): PlayerInfo {
  const i = indexOf.get(p);
  if (i === undefined) return { pos: null, age: null, life: null };
  const c = TAKTIK_POS[i];
  const pos = c === "G" || c === "D" || c === "M" || c === "F" ? c : null;
  const code = BORN.slice(i * 3, i * 3 + 3);
  const days = code && code !== "000" ? parseInt(code, 36) : 0;
  if (!days) return { pos, age: null, life: null };
  const born = dateOf(days);
  const died = DIED[i];
  if (died) return { pos, age: null, life: [born.getUTCFullYear(), dateOf(died).getUTCFullYear()] };
  const age = yearsBetween(born, today);
  return { pos, age: age > 14 && age < 100 ? age : null, life: null };
}
