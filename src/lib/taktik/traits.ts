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

export const COUNTRY_STEPS = [2, 3, 5];

/**
 * What a synergy does, one line per effect, by tier (index 0 = off). The match reads
 * these through `applyEffects` and the screens print them (`effectsOf`), so the
 * numbers a player reads are the numbers the match uses.
 *   atk / def / poss / behind / bigGame: team multipliers (+x %)
 *   late / lastMinute / counter / setPiece / accuracy: added chances (+x)
 *   flex: share of the out-of-position penalty removed; shield: first goal against cancelled
 *   club / star / legendUnit: power of the players concerned (+x %); genius: sure chances per player
 */
export type EffectKey = "atk" | "def" | "poss" | "late" | "behind" | "counter" | "setPiece" | "flex" | "lastMinute" | "accuracy" | "shield" | "bigGame" | "genius" | "club" | "star" | "legendUnit";
type Table = Partial<Record<EffectKey, number[]>>;

/** country styles; any other country is a generic national side */
export const STYLE_TABLE: Record<string, Table> = {
  brazil: { atk: [0, 0.07, 0.13, 0.22], accuracy: [0, 0, 0, 0.1] },
  italy: { def: [0, 0.08, 0.15, 0.25], shield: [0, 0, 0, 1] },
  spain: { poss: [0, 0.1, 0.18, 0.3] },
  germany: { late: [0, 0.14, 0.25, 0.4] },
  argentina: { behind: [0, 0.15, 0.25, 0.4] },
  france: { counter: [0, 0.15, 0.25, 0.4] },
  netherlands: { flex: [0, 0.5, 1, 1], atk: [0, 0.03, 0.05, 0.1], def: [0, 0.03, 0.05, 0.1] },
  england: { setPiece: [0, 0.04, 0.08, 0.13] },
  portugal: { star: [0, 0.2, 0.35, 0.55] },
  turkey: { lastMinute: [0, 0.15, 0.25, 0.4] },
};
/** the styled countries (the rest play as a generic national side) */
export const STYLES: Record<string, true> = Object.fromEntries(Object.keys(STYLE_TABLE).map((k) => [k, true]));
const GENERIC_NATION: Table = { atk: [0, 0.05, 0.09, 0.15], def: [0, 0.05, 0.09, 0.15] };
const CLUB_TABLE: Table = { club: [0, 0.15, 0.35, 0.6] };

export const HONOUR_STEPS: Record<string, number[]> = { wc: [2, 4], ucl: [2, 4], ballon: [1], euro: [2, 3], legend: [4] };
/** Legends (four on the pitch): the whole side lifts and every legend plays far above himself */
export const LEGEND_TEAM = 0.25;
export const LEGEND_UNIT = 0.3;
const HONOUR_TABLE: Record<string, Table> = {
  wc: { late: [0, 0.2, 0.4] },
  ucl: { bigGame: [0, 0.1, 0.25] },
  ballon: { genius: [0, 1] },
  euro: { def: [0, 0.1, 0.2] },
  legend: { atk: [0, LEGEND_TEAM], def: [0, LEGEND_TEAM], legendUnit: [0, LEGEND_UNIT] },
};

const tableOf = (kind: TraitKind, id: string): Table => (kind === "club" ? CLUB_TABLE : kind === "country" ? (STYLE_TABLE[id] ?? GENERIC_NATION) : (HONOUR_TABLE[id] ?? {}));

/** The effects of a synergy at a tier, for the screens (zero values left out). */
export function effectsOf(kind: TraitKind, id: string, tier: number): { key: EffectKey; value: number }[] {
  const out: { key: EffectKey; value: number }[] = [];
  for (const [key, row] of Object.entries(tableOf(kind, id)) as [EffectKey, number[]][]) {
    const value = row[Math.min(tier, row.length - 1)] ?? 0;
    if (value) out.push({ key, value });
  }
  return out;
}

/** Team-wide effects into the match modifiers (unit ones are applied by `evaluate`). */
function applyEffects(t: Table, tier: number, m: Mods) {
  const v = (k: EffectKey) => t[k]?.[Math.min(tier, t[k]!.length - 1)] ?? 0;
  m.atk *= 1 + v("atk");
  m.def *= 1 + v("def");
  m.poss *= 1 + v("poss");
  m.behind *= 1 + v("behind");
  m.bigGame *= 1 + v("bigGame");
  m.late += v("late");
  m.lastMinute += v("lastMinute");
  m.counter += v("counter");
  m.setPiece += v("setPiece");
  m.accuracy += v("accuracy");
  m.flex = Math.max(m.flex, v("flex"));
  if (v("shield")) m.shield = true;
}

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
    if (tier) for (const u of units) if (u.club === club) m.unit[u.uid] = (m.unit[u.uid] ?? 1) * (1 + CLUB_TABLE.club![tier]);
  }

  const countryCounts = count((u) => [u.country]);
  const topCountry = [...countryCounts].sort((a, b) => b[1] - a[1])[0]?.[0];
  for (const [country, n] of countryCounts) {
    const tier = Math.min(COUNTRY_STEPS.length, tierOf(n, COUNTRY_STEPS) + (boost.country && country === topCountry ? 1 : 0));
    traits.push({ kind: "country", id: country, count: n, steps: COUNTRY_STEPS, tier });
    if (!tier) continue;
    const table = tableOf("country", country);
    applyEffects(table, tier, m);
    // Portugal: the strongest Portuguese player plays above himself
    if (table.star) {
      const best = units.filter((u) => u.country === country).sort((a, b) => power(b) - power(a))[0];
      if (best) m.unit[best.uid] = (m.unit[best.uid] ?? 1) * (1 + table.star[tier]);
    }
  }

  for (const [honour, n] of count((u) => u.badges)) {
    const steps = HONOUR_STEPS[honour];
    if (!steps) continue;
    const tier = tierOf(n, steps);
    traits.push({ kind: "honour", id: honour, count: n, steps, tier });
    if (!tier) continue;
    const table = tableOf("honour", honour);
    applyEffects(table, tier, m);
    // every Ballon d'Or winner on the pitch makes one sure chance
    if (table.genius) m.genius += n * table.genius[tier];
    if (table.legendUnit) for (const u of units) if (u.badges.includes(honour)) m.unit[u.uid] = (m.unit[u.uid] ?? 1) * (1 + table.legendUnit[tier]);
  }

  // active first, then closest to the next step
  traits.sort((a, b) => b.tier - a.tier || b.count - a.count);
  return { traits, mods: m };
}
