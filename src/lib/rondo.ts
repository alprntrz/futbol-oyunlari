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
