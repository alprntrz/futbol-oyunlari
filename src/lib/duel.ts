import { DUEL_ROWS } from "@/data/duel";
import { PLAYERS } from "@/data/players";
import { TAKTIK_CLUB, TAKTIK_CLUB_CODE, TAKTIK_CLUB_IDS, TAKTIK_POS } from "@/data/taktik";

import { LEAGUES } from "./leagues";
import { seededRandom } from "./tiki";

/**
 * Kart Düellosu / Card Duel (docs/design/kart-duellosu.md): draft 7 cards under
 * a budget and today's theme, then 7 rounds of "who has more …?" — both players
 * pick a card, higher number wins the round, a played card is gone.
 * Pure and shared: the app deals and checks hands, server.js runs the match.
 */

export const HAND_SIZE = 7;
export const BUDGET = 15;
export const ROUNDS = 7;
export const DRAFT_SECONDS = 180;
export const PICK_SECONDS = 20;

export type StatId = "apps" | "goals" | "caps" | "intGoals" | "height" | "age" | "clubs" | "seasons" | "honours";
export const STATS: StatId[] = ["apps", "goals", "caps", "intGoals", "height", "age", "clubs", "seasons", "honours"];
/** stats that can also be asked the other way round ("lower wins") */
const LOWER_OK: StatId[] = ["height", "age", "clubs"];
const MAX_LOWER = 2;

export type Pos = "G" | "D" | "M" | "F";
export type Tier = 1 | 2 | 3;

export interface DuelCard {
  /** PLAYERS index: the card's id everywhere (hands, sockets, saves) */
  id: number;
  name: string;
  country: string;
  clubs: string[];
  /** the club they played most seasons for (its shirt on the card) */
  club: string | null;
  badges: string[];
  pos: Pos | null;
  /** fame: 3 gold, 2 silver, 1 bronze; also its price in the draft */
  tier: Tier;
  /** stats.age holds the birth date (yyyymmdd): born earlier = older */
  stats: Record<StatId, number>;
}

/** gold = the best-known this many cards, then silver */
const GOLD = 150;
const SILVER = 750;

export const CARDS: DuelCard[] = DUEL_ROWS.filter((r) => r[6] > 0)
  .sort((a, b) => a[0] - b[0]) // PLAYERS is sorted by fame
  .map(([i, apps, goals, caps, intGoals, height, born, clubs, seasons, honours], rank) => {
    const p = PLAYERS[i];
    const pos = TAKTIK_POS[i];
    return {
      id: i,
      name: p.name,
      country: p.country,
      clubs: p.clubs,
      club: TAKTIK_CLUB_IDS[TAKTIK_CLUB_CODE.indexOf(TAKTIK_CLUB[i])] ?? p.clubs[0] ?? null,
      badges: p.badges ?? [],
      pos: pos === "G" || pos === "D" || pos === "M" || pos === "F" ? pos : null,
      tier: rank < GOLD ? 3 : rank < SILVER ? 2 : 1,
      stats: { apps, goals, caps, intGoals, height, age: born, clubs, seasons, honours },
    };
  });

const byId = new Map(CARDS.map((c) => [c.id, c]));
export const cardById = (id: number) => byId.get(id);

// ── Themes: who may be drafted today

export type ThemeId = "open" | "noFwd" | "ucl" | "southAmerica" | "africa" | "noGold" | `league_${"tr" | "en" | "es" | "it" | "de"}`;

export interface Theme {
  id: ThemeId;
  /** strings.ts key suffix: dzTheme_<id> */
  test: (c: DuelCard) => boolean;
}

const SOUTH_AMERICA = new Set(["brazil", "argentina", "uruguay", "colombia", "chile"]);
const AFRICA = new Set(["morocco", "senegal", "ivorycoast", "nigeria", "ghana", "cameroon", "algeria"]);
const leagueTheme = (id: "tr" | "en" | "es" | "it" | "de"): Theme => {
  const clubs = new Set(LEAGUES.find((l) => l.id === id)?.clubs ?? []);
  return { id: `league_${id}`, test: (c) => c.clubs.some((k) => clubs.has(k)) };
};

export const THEMES: Theme[] = [
  { id: "open", test: () => true },
  { id: "noFwd", test: (c) => c.pos !== "F" },
  { id: "ucl", test: (c) => c.badges.includes("ucl") },
  { id: "southAmerica", test: (c) => SOUTH_AMERICA.has(c.country) },
  { id: "africa", test: (c) => AFRICA.has(c.country) },
  { id: "noGold", test: (c) => c.tier < 3 },
  leagueTheme("tr"),
  leagueTheme("en"),
  leagueTheme("es"),
  leagueTheme("it"),
  leagueTheme("de"),
];

export const themeById = (id: string | undefined) => THEMES.find((t) => t.id === id) ?? THEMES[0];

function scramble(n: number): number {
  let x = n ^ 0x2c1b3c6d;
  x = Math.imul(x, 0x297a2d39) >>> 0;
  x ^= x >>> 15;
  return x >>> 0;
}

/** Today's theme: the same for everyone; only themes with enough cards to draft from. */
export function themeForDay(day: number): Theme {
  const ok = THEMES.filter((t) => draftable(t));
  return ok[scramble(day) % ok.length];
}

/** a theme is fair if a full hand fits the budget with room to choose */
export function draftable(t: Theme) {
  const pool = CARDS.filter(t.test);
  return pool.length >= 40 && pool.filter((c) => c.tier === 1).length >= 10;
}

// ── Hands

export type HandCheck = "ok" | "size" | "budget" | "theme" | "unknown" | "duplicate";

export const handCost = (ids: number[]) => ids.reduce((n, id) => n + (byId.get(id)?.tier ?? 0), 0);

export function checkHand(ids: number[], theme: Theme): HandCheck {
  if (ids.length !== HAND_SIZE) return "size";
  if (new Set(ids).size !== ids.length) return "duplicate";
  const cards = ids.map((id) => byId.get(id));
  if (cards.some((c) => !c)) return "unknown";
  if (cards.some((c) => !theme.test(c!))) return "theme";
  if (handCost(ids) > BUDGET) return "budget";
  return "ok";
}

const shuffle = <T>(a: T[], rand: () => number) => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
};

/** A house hand for a theme: two gold, four silver, one bronze when the theme allows, under budget. */
export function houseHand(theme: Theme, rand: () => number = Math.random): number[] {
  const pool = CARDS.filter(theme.test);
  const of = (t: Tier) => shuffle(pool.filter((c) => c.tier === t), rand);
  for (const plan of [[3, 3, 2, 2, 2, 2, 1], [3, 2, 2, 2, 2, 2, 2], [2, 2, 2, 2, 2, 2, 2], [2, 2, 2, 2, 1, 1, 1], [1, 1, 1, 1, 1, 1, 1]] as Tier[][]) {
    const lists = { 1: of(1), 2: of(2), 3: of(3) } as Record<Tier, DuelCard[]>;
    const hand: number[] = [];
    for (const t of plan) {
      const c = lists[t].pop();
      if (c) hand.push(c.id);
    }
    if (hand.length === HAND_SIZE) return hand;
  }
  // a theme short of some tier: the dearest cards that still leave room to fill the hand cheaply,
  // never over budget (the house must play by the same rules)
  const cheapest = Math.min(...pool.map((c) => c.tier));
  const hand: number[] = [];
  let cost = 0;
  for (const c of shuffle(pool, rand).sort((x, y) => y.tier - x.tier)) {
    if (hand.length === HAND_SIZE) break;
    if (cost + c.tier + (HAND_SIZE - hand.length - 1) * cheapest <= BUDGET) {
      hand.push(c.id);
      cost += c.tier;
    }
  }
  return hand;
}

// ── Questions and rounds

export interface Question {
  stat: StatId;
  /** lower number wins (shorter, younger, fewer clubs) */
  lower: boolean;
}

/** strings.ts key for a question */
export const questionKey = (q: Question) => (q.lower ? (`dzQ_${q.stat as "height" | "age" | "clubs"}_low` as const) : (`dzQ_${q.stat}` as const));

/** Seven different stats, at most two of them "lower wins". */
export function dealQuestions(rand: () => number): Question[] {
  let lowers = 0;
  return shuffle(STATS, rand)
    .slice(0, ROUNDS)
    .map((stat) => {
      const lower = LOWER_OK.includes(stat) && lowers < MAX_LOWER && rand() < 0.35;
      if (lower) lowers++;
      return { stat, lower };
    });
}

/** "age" is stored as the birth date: born earlier = older */
const higherIsBetter = (q: Question) => (q.stat === "age" ? q.lower : !q.lower);

/** Round result for card a vs card b: 0 = a, 1 = b, "draw". */
export function roundWinner(q: Question, a: number, b: number): 0 | 1 | "draw" {
  const va = byId.get(a)?.stats[q.stat] ?? 0;
  const vb = byId.get(b)?.stats[q.stat] ?? 0;
  if (q.stat === "age" ? Math.floor(va / 10000) === Math.floor(vb / 10000) : va === vb) return "draw";
  return va > vb === higherIsBetter(q) ? 0 : 1;
}

/** The number shown on a revealed card: birth year for age, "185 cm" for height. */
export function statText(stat: StatId, value: number): string {
  if (stat === "age") return String(Math.floor(value / 10000));
  if (stat === "height") return `${value} cm`;
  return String(value);
}

// how good a card is for a question, 0..1 against the whole pool
const sortedValues = Object.fromEntries(STATS.map((s) => [s, CARDS.map((c) => c.stats[s]).sort((a, b) => a - b)])) as Record<StatId, number[]>;
function strength(q: Question, id: number) {
  const v = byId.get(id)?.stats[q.stat] ?? 0;
  const list = sortedValues[q.stat];
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid] < v) lo = mid + 1;
    else hi = mid;
  }
  const pct = lo / Math.max(1, list.length - 1);
  return higherIsBetter(q) ? pct : 1 - pct;
}

/**
 * The house player's pick: usually its best card for this question, but it
 * keeps a card that is much better for a question still to come, and now and
 * then it just plays on a hunch.
 */
export function housePick(q: Question, unused: number[], later: Question[], rand: () => number = Math.random): number {
  if (unused.length === 1 || rand() < 0.15) return unused[Math.floor(rand() * unused.length)];
  const score = (id: number) => {
    const now = strength(q, id);
    const best = Math.max(0, ...later.map((l) => strength(l, id)));
    return now - 0.5 * Math.max(0, best - now) + rand() * 0.1;
  };
  return unused.slice().sort((a, b) => score(b) - score(a))[0];
}

/** Seeded random for a day's challenge (house hand and questions). */
export const dailyRand = (day: number) => seededRandom(day * 7919 + 13);

/** Name search for the draft: surname or full name, best-known first. */
export function searchCards(query: string, theme: Theme, limit = 20): DuelCard[] {
  const fold = (s: string) => s.toLocaleLowerCase("en").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");
  const q = fold(query.trim());
  if (q.length < 2) return [];
  const out: DuelCard[] = [];
  for (const c of CARDS) {
    if (!theme.test(c)) continue;
    const n = fold(c.name);
    if (n.startsWith(q) || n.includes(` ${q}`) || (q.length >= 4 && n.includes(q))) out.push(c);
    if (out.length >= limit) break;
  }
  return out;
}
