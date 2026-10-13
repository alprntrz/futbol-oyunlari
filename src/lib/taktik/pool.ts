import { MATCHES } from "@/data/matches";
import { PLAYERS } from "@/data/players";
import { TAKTIK_CLUB, TAKTIK_CLUB_CODE, TAKTIK_CLUB_IDS, TAKTIK_POS } from "@/data/taktik";

import { FORMATIONS } from "../formations";
import { COPIES, POOL_SIZE, type Cost, type Pos } from "./rules";
import type { PoolPlayer } from "./types";

/**
 * Every player in the database as a card (cost from fame, main club, position),
 * and the random pool each lobby is dealt from (docs §5.4: any player can show
 * up, but one game uses ~60 of them around ~10 clubs and ~10 countries).
 */

// classic-match starts, and a position for the ones we've seen in a lineup
const APPS = new Map<string, number>();
const LINEUP_POS = new Map<string, Pos>();
for (const m of MATCHES) {
  const slots = FORMATIONS[m.formation];
  m.lineup.forEach((p, i) => {
    APPS.set(p.name, (APPS.get(p.name) ?? 0) + 1);
    const y = slots[i]?.y ?? 50;
    LINEUP_POS.set(p.name, i === 0 ? "GK" : y >= 65 ? "DEF" : y >= 35 ? "MID" : "FWD");
  });
}

const POS_CODE: Record<string, Pos> = { G: "GK", D: "DEF", M: "MID", F: "FWD" };

/** stable 0..1 from a name, for the rare player with no known position */
function hash01(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

function positionOf(i: number, name: string): Pos {
  const scraped = POS_CODE[TAKTIK_POS[i]];
  if (scraped) return scraped;
  const seen = LINEUP_POS.get(name);
  if (seen) return seen;
  const r = hash01(name);
  return r < 0.1 ? "GK" : r < 0.45 ? "DEF" : r < 0.75 ? "MID" : "FWD";
}

/** Fame: honours weigh most, then classic-match starts, then big clubs played for. */
const fame = (i: number) => {
  const p = PLAYERS[i];
  return (p.badges?.length ?? 0) * 4 + Math.min(APPS.get(p.name) ?? 0, 12) + p.clubs.length * 0.8;
};

/** cost tiers by fame rank: top 80 legends, then 320, 1200, 4000, the rest */
const TIER_CUTS = [80, 400, 1600, 5600];

export interface Card {
  name: string;
  cost: Cost;
  pos: Pos;
  club: string | null;
  country: string;
  badges: string[];
}

/** All players as cards, built once. */
export const CATALOG: Card[] = (() => {
  const order = PLAYERS.map((_, i) => i).sort((a, b) => fame(b) - fame(a) || a - b);
  const cost = new Array<Cost>(PLAYERS.length);
  order.forEach((idx, rank) => {
    cost[idx] = (rank < TIER_CUTS[0] ? 5 : rank < TIER_CUTS[1] ? 4 : rank < TIER_CUTS[2] ? 3 : rank < TIER_CUTS[3] ? 2 : 1) as Cost;
  });
  return PLAYERS.map((p, i) => {
    const code = TAKTIK_CLUB[i];
    const club = code && code !== "?" ? TAKTIK_CLUB_IDS[TAKTIK_CLUB_CODE.indexOf(code)] : (p.clubs[0] ?? null);
    return { name: p.name, cost: cost[i], pos: positionOf(i, p.name), club, country: p.country, badges: p.badges ?? [] };
  });
})();

/**
 * This lobby's pool: pick ~10 clubs and ~10 countries at random, then fill each
 * cost tier with players from them (any era). Keeps at least 2 keepers per tier
 * from cost 1–3 so everyone can find a goalkeeper.
 */
export function dealPool(rand: () => number): { players: PoolPlayer[]; copies: number[] } {
  const shuffle = <T,>(a: T[]) => {
    const r = a.slice();
    for (let i = r.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [r[i], r[j]] = [r[j], r[i]];
    }
    return r;
  };
  const clubs = new Set(shuffle(TAKTIK_CLUB_IDS).slice(0, 10));
  const countryCount = new Map<string, number>();
  for (const c of CATALOG) countryCount.set(c.country, (countryCount.get(c.country) ?? 0) + 1);
  // countries with enough players to make a pool interesting
  const countries = new Set(shuffle([...countryCount].filter(([, n]) => n >= 40).map(([c]) => c)).slice(0, 10));

  const players: PoolPlayer[] = [];
  const used = new Set<string>();
  for (const cost of [1, 2, 3, 4, 5] as Cost[]) {
    const fits = shuffle(CATALOG.filter((c) => c.cost === cost && !used.has(c.name) && ((c.club && clubs.has(c.club)) || countries.has(c.country))));
    // both a club and a country in the pool: the best for synergies, take those first
    const both = fits.filter((c) => c.club && clubs.has(c.club) && countries.has(c.country));
    const rest = fits.filter((c) => !both.includes(c));
    const pick: Card[] = [];
    const want = POOL_SIZE[cost];
    if (cost <= 3) pick.push(...fits.filter((c) => c.pos === "GK").slice(0, 2));
    for (const c of [...both, ...rest]) {
      if (pick.length >= want) break;
      if (!pick.includes(c)) pick.push(c);
    }
    for (const c of pick) {
      used.add(c.name);
      players.push({ pid: players.length, ...c });
    }
  }
  return { players, copies: players.map((p) => COPIES[p.cost]) };
}
