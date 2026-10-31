/**
 * Rondo: a club comes up, two players take turns naming someone who played there.
 * A name can't be said twice in a round; a wrong name costs nothing but time; the
 * player whose clock runs out loses the round. First to RONDO_TARGET rounds wins.
 * Pure (no React / DOM): used by the phone (house player, local state) and by
 * server.js (`rd:*`, which judges every answer itself).
 */
import type { GridPlayer } from "@/data/players";

import { ALL_CRITERIA, GRID_PLAYERS, matchPlayers, type Criterion } from "./tiki";

export const RONDO_TURN_MS = 15_000;
/** the first turn of a round gets a little longer (read the club, think) */
export const RONDO_FIRST_TURN_MS = 20_000;
export const RONDO_TARGET = 2;
export const RONDO_MAX_ROUNDS = RONDO_TARGET * 2 - 1;

/** players a "known" answer comes from: the better-known part of the list, so the house player sounds human */
const KNOWN = GRID_PLAYERS.slice(0, 2500);

/**
 * Clubs that make a good round: enough well-known players for a long back and forth
 * (60+ among the best-known 2,500), so neither side runs dry in a few turns.
 */
export const RONDO_CLUBS: Criterion[] = ALL_CRITERIA.filter((c) => c.kind === "club" && KNOWN.filter(c.test).length >= 60);

export const rondoClubById = (id: string) => RONDO_CLUBS.find((c) => c.id === id);

/** The clubs of a match, all different: `rand` is seeded by whoever deals (the server online). */
export function dealRondo(rand: () => number = Math.random, count = RONDO_MAX_ROUNDS): string[] {
  const pool = [...RONDO_CLUBS];
  const out: string[] = [];
  while (out.length < count && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0].id);
  return out;
}

export type RondoVerdict = { ok: true; player: GridPlayer } | { ok: false; reason: "unknown" | "wrong" | "used" };

/** Judge a typed answer for a club: the first matching player who played there and isn't used yet. */
export function judgeRondo(guess: string, clubId: string, used: Iterable<string>): RondoVerdict {
  const club = rondoClubById(clubId);
  const matches = matchPlayers(guess);
  if (!club || !matches.length) return { ok: false, reason: "unknown" };
  const fits = matches.filter(club.test);
  if (!fits.length) return { ok: false, reason: "wrong" };
  const taken = new Set(used);
  const free = fits.find((p) => !taken.has(p.name));
  return free ? { ok: true, player: free } : { ok: false, reason: "used" };
}

/**
 * The house player's next answer: a well-known player of the club not said yet, or null
 * when it "can't think of one" (it runs dry faster as the round goes on, so rounds end).
 */
export function houseRondoAnswer(clubId: string, used: Iterable<string>, turn: number, rand: () => number = Math.random): string | null {
  const club = rondoClubById(clubId);
  if (!club) return null;
  const taken = new Set(used);
  const options = KNOWN.filter((p) => club.test(p) && !taken.has(p.name));
  // after a handful of turns the house player starts to blank now and then
  const blank = Math.min(0.5, Math.max(0, (turn - 4) * 0.07));
  if (!options.length || rand() < blank) return null;
  // mostly someone famous, sometimes a deeper cut
  const reach = Math.min(options.length, rand() < 0.8 ? 15 : 60);
  return options[Math.floor(rand() * reach)].name;
}

/** How long the house player "thinks" before answering, in ms. */
export function houseRondoThinkMs(rand: () => number = Math.random): number {
  return rand() < 0.15 ? 8_000 + rand() * 5_000 : 2_500 + rand() * 5_000;
}

/* ───────── Pair duel: two clubs, one player, first correct answer takes the hand ───────── */

/** "club": the classic turn-based Rondo; "pair": both race to name someone who played for both clubs. */
export type RondoMode = "club" | "pair";
export const cleanRondoMode = (v: unknown): RondoMode => (v === "pair" ? "pair" : "club");

/** one hand: both players may answer until the clock runs out */
export const RONDO_PAIR_HAND_MS = 20_000;
/** hands to win: best of 3 / 5 / 7 */
export const RONDO_PAIR_TARGETS = [2, 3, 4] as const;
export const RONDO_PAIR_TARGET = 3;
export const cleanRondoTarget = (v: unknown): number => (RONDO_PAIR_TARGETS.includes(v as 2 | 3 | 4) ? (v as number) : RONDO_PAIR_TARGET);
/** a wrong answer locks that player's box for a moment, so nobody can spray guesses */
export const RONDO_PAIR_MISS_MS = 1_500;
/** a pair needs this many well-known shared players to be fair */
const PAIR_MIN_KNOWN = 4;

export interface RondoPair {
  id: string;
  clubs: [string, string];
}

export const rondoPairId = (a: string, b: string) => [a, b].sort().join("+");

/** Every pair of Rondo clubs with enough well-known players who wore both shirts. */
export const RONDO_PAIRS: RondoPair[] = (() => {
  const known = RONDO_CLUBS.map((c) => ({ c, names: new Set(KNOWN.filter(c.test).map((p) => p.name)) }));
  const out: RondoPair[] = [];
  for (let i = 0; i < known.length; i++) {
    for (let j = i + 1; j < known.length; j++) {
      let shared = 0;
      for (const n of known[i].names) if (known[j].names.has(n)) shared++;
      if (shared >= PAIR_MIN_KNOWN) out.push({ id: rondoPairId(known[i].c.id, known[j].c.id), clubs: [known[i].c.id, known[j].c.id] });
    }
  }
  return out;
})();

const PAIR_BY_ID = new Map(RONDO_PAIRS.map((p) => [p.id, p]));
export const rondoPairById = (id: string) => PAIR_BY_ID.get(id);

/** Both clubs of a pair, as criteria (for the badges on the phones). */
export function rondoPairClubs(id: string): [Criterion, Criterion] | null {
  const pair = rondoPairById(id);
  const a = pair && rondoClubById(pair.clubs[0]);
  const b = pair && rondoClubById(pair.clubs[1]);
  return a && b ? [a, b] : null;
}

/**
 * The pairs of a match, all different, and no club in two hands in a row where that
 * can be helped. `rand` is seeded by whoever deals (the server online).
 */
export function dealRondoPairs(rand: () => number = Math.random, count: number): string[] {
  const pool = [...RONDO_PAIRS];
  const out: string[] = [];
  let last: RondoPair | null = null;
  while (out.length < count && pool.length) {
    const prev = last;
    const fresh: RondoPair[] = prev ? pool.filter((p) => !p.clubs.some((c) => prev.clubs.includes(c))) : pool;
    const from: RondoPair[] = fresh.length ? fresh : pool;
    const pick: RondoPair = from[Math.floor(rand() * from.length)];
    pool.splice(pool.indexOf(pick), 1);
    out.push(pick.id);
    last = pick;
  }
  return out;
}

const fitsPair = (pair: RondoPair) => {
  const a = rondoClubById(pair.clubs[0]);
  const b = rondoClubById(pair.clubs[1]);
  return (p: GridPlayer) => !!a && !!b && a.test(p) && b.test(p);
};

/** Judge a typed answer for a pair: the first matching player who wore both shirts and isn't used yet. */
export function judgeRondoPair(guess: string, pairId: string, used: Iterable<string>): RondoVerdict {
  const pair = rondoPairById(pairId);
  const matches = matchPlayers(guess);
  if (!pair || !matches.length) return { ok: false, reason: "unknown" };
  const fits = matches.filter(fitsPair(pair));
  if (!fits.length) return { ok: false, reason: "wrong" };
  const taken = new Set(used);
  const free = fits.find((p) => !taken.has(p.name));
  return free ? { ok: true, player: free } : { ok: false, reason: "used" };
}

/** The best-known players who fit the pair, best known first (shown after every hand). */
export function rondoPairAnswers(pairId: string, limit = 5): string[] {
  const pair = rondoPairById(pairId);
  return pair ? KNOWN.filter(fitsPair(pair)).slice(0, limit).map((p) => p.name) : [];
}

/**
 * The house player's answer for a hand, or null when it blanks: mostly one of the famous
 * fits, sometimes a deeper cut, so it reads like a person who knows football.
 */
export function houseRondoPairAnswer(pairId: string, rand: () => number = Math.random): string | null {
  const pair = rondoPairById(pairId);
  if (!pair) return null;
  const options = KNOWN.filter(fitsPair(pair));
  if (!options.length || rand() < 0.3) return null;
  const reach = Math.min(options.length, rand() < 0.8 ? 5 : 20);
  return options[Math.floor(rand() * reach)].name;
}

/** How long the house player "thinks" before racing an answer in, in ms: a person who knows the answer beats it. */
export function houseRondoPairThinkMs(rand: () => number = Math.random): number {
  return rand() < 0.25 ? 14_000 + rand() * 5_000 : 7_000 + rand() * 8_000;
}
