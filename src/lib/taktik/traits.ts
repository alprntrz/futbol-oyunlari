import type { Unit } from "./types";

/**
 * Synergies (docs/design/taktik-tahtasi.md §5): club "chemistry", country styles
 * and honours. Counted over the distinct players on the pitch. The result is a
 * set of modifiers the match simulation reads.
 */

export interface Mods {
  /** power multiplier per unit uid (club chemistry, Portugal's star) */
  unit: Record<string, number>;
  /** team multipliers, 1 = none */
  atk: number;
  def: number;
  poss: number;
  /** extra multiplier for both sides of the game in the late slices */
  late: number;
  /** extra goal chance in the last two slices */
  lastMinute: number;
  /** attack multiplier while trailing */
  behind: number;
  /** chance to break straight back after losing the ball */
  counter: number;
  /** extra goal chance on every attack (set pieces) */
  setPiece: number;
  /** share of the out-of-position penalty removed (0..1) */
  flex: number;
  /** the first goal against is cancelled */
  shield: boolean;
  /** multiplier against a stronger team */
  bigGame: number;
  /** guaranteed chances (Ballon d'Or players) */
  genius: number;
  /** extra share of shots on target */
  accuracy: number;
}

export const emptyMods = (): Mods => ({
  unit: {},
  atk: 1,
  def: 1,
  poss: 1,
  late: 0,
  lastMinute: 0,
  behind: 1,
  counter: 0,
  setPiece: 0,
  flex: 0,
  shield: false,
  bigGame: 1,
  genius: 0,
  accuracy: 0,
});

export type TraitKind = "club" | "country" | "honour";

export interface TraitState {
  kind: TraitKind;
  id: string;
  count: number;
  /** thresholds, and how many are reached (0 = inactive) */
  steps: number[];
  tier: number;
}

export const CLUB_STEPS = [2, 4, 6];
const CLUB_BONUS = [0, 0.15, 0.35, 0.6];

export const COUNTRY_STEPS = [2, 3, 5];
/** country styles; any other country is a generic national side */
export const STYLES: Record<string, (tier: number, m: Mods) => void> = {
  brazil: (t, m) => {
    m.atk *= 1 + [0, 0.07, 0.13, 0.22][t];
    if (t >= 3) m.accuracy += 0.1;
  },
  italy: (t, m) => {
    m.def *= 1 + [0, 0.08, 0.15, 0.25][t];
    if (t >= 3) m.shield = true;
  },
  spain: (t, m) => {
    m.poss *= 1 + [0, 0.1, 0.18, 0.3][t];
  },
  germany: (t, m) => {
    m.late += [0, 0.14, 0.25, 0.4][t];
  },
  argentina: (t, m) => {
    m.behind *= 1 + [0, 0.15, 0.25, 0.4][t];
  },
  france: (t, m) => {
    m.counter += [0, 0.15, 0.25, 0.4][t];
  },
  netherlands: (t, m) => {
    m.flex = Math.max(m.flex, [0, 0.5, 1, 1][t]);
    m.atk *= 1 + [0, 0.03, 0.05, 0][t];
    m.def *= 1 + [0, 0.03, 0.05, 0][t];
    if (t >= 3) {
      m.atk *= 1.1;
      m.def *= 1.1;
    }
  },
  england: (t, m) => {
    m.setPiece += [0, 0.04, 0.08, 0.13][t];
  },
  portugal: () => {
    // handled per unit (the strongest player), see below
  },
  turkey: (t, m) => {
    m.lastMinute += [0, 0.15, 0.25, 0.4][t];
  },
};
const PORTUGAL_STAR = [0, 0.2, 0.35, 0.55];
const GENERIC_NATION = [0, 0.05, 0.09, 0.15];

export const HONOUR_STEPS: Record<string, number[]> = { wc: [2, 4], ucl: [2, 4], ballon: [1], euro: [2, 3], legend: [4] };
/** Legends (four on the pitch): the whole side lifts and every legend plays far above himself */
export const LEGEND_TEAM = 0.25;
export const LEGEND_UNIT = 0.3;

const tierOf = (count: number, steps: number[]) => steps.filter((s) => count >= s).length;

/** Traits on the pitch and the modifiers they give. `power` ranks units (for Portugal's star). */
export function evaluate(units: Unit[], power: (u: Unit) => number, boost: { club?: boolean; country?: boolean } = {}): { traits: TraitState[]; mods: Mods } {
  const m = emptyMods();
  const distinct = new Map<string, Unit>();
  for (const u of units) if (!distinct.has(u.name)) distinct.set(u.name, u);
  const people = [...distinct.values()];

  const count = (key: (u: Unit) => string[]) => {
    const c = new Map<string, number>();
    for (const u of people) for (const k of key(u)) c.set(k, (c.get(k) ?? 0) + 1);
    return c;
  };

  const traits: TraitState[] = [];

  const clubCounts = count((u) => (u.club ? [u.club] : []));
  const topClub = [...clubCounts].sort((a, b) => b[1] - a[1])[0]?.[0];
  for (const [club, n] of clubCounts) {
    const tier = Math.min(CLUB_STEPS.length, tierOf(n, CLUB_STEPS) + (boost.club && club === topClub ? 1 : 0));
    traits.push({ kind: "club", id: club, count: n, steps: CLUB_STEPS, tier });
    if (tier) for (const u of units) if (u.club === club) m.unit[u.uid] = (m.unit[u.uid] ?? 1) * (1 + CLUB_BONUS[tier]);
  }

  const countryCounts = count((u) => [u.country]);
  const topCountry = [...countryCounts].sort((a, b) => b[1] - a[1])[0]?.[0];
  for (const [country, n] of countryCounts) {
    const tier = Math.min(COUNTRY_STEPS.length, tierOf(n, COUNTRY_STEPS) + (boost.country && country === topCountry ? 1 : 0));
    traits.push({ kind: "country", id: country, count: n, steps: COUNTRY_STEPS, tier });
    if (!tier) continue;
    if (country === "portugal") {
      const best = units.filter((u) => u.country === "portugal").sort((a, b) => power(b) - power(a))[0];
      if (best) m.unit[best.uid] = (m.unit[best.uid] ?? 1) * (1 + PORTUGAL_STAR[tier]);
    } else if (STYLES[country]) STYLES[country](tier, m);
    else {
      m.atk *= 1 + GENERIC_NATION[tier];
      m.def *= 1 + GENERIC_NATION[tier];
    }
  }

  for (const [honour, n] of count((u) => u.badges)) {
    const steps = HONOUR_STEPS[honour];
    if (!steps) continue;
    const tier = tierOf(n, steps);
    traits.push({ kind: "honour", id: honour, count: n, steps, tier });
    if (!tier) continue;
    if (honour === "wc") m.late += [0, 0.2, 0.4][tier];
    if (honour === "ucl") m.bigGame *= 1 + [0, 0.1, 0.25][tier];
    if (honour === "ballon") m.genius += n;
    if (honour === "euro") m.def *= 1 + [0, 0.1, 0.2][tier];
    if (honour === "legend") {
      m.atk *= 1 + LEGEND_TEAM;
      m.def *= 1 + LEGEND_TEAM;
      for (const u of units) if (u.badges.includes("legend")) m.unit[u.uid] = (m.unit[u.uid] ?? 1) * (1 + LEGEND_UNIT);
    }
  }

  // active first, then closest to the next step
  traits.sort((a, b) => b.tier - a.tier || b.count - a.count);
  return { traits, mods: m };
}
