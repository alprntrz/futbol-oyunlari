import { PLAYERS, type GridPlayer } from "@/data/players";
import { ALL_CRITERIA, seededRandom, type Criterion } from "@/lib/tiki";

/**
 * Mystery Player: find a footballer from clues that open one by one —
 * the clubs they played for, then country, honours and finally the letters.
 * Every wrong guess (or asking for a hint) opens the next clue.
 */

export const MAX_GUESSES = 6;
/** clues showing before the first guess */
export const START_CLUES = 2;

export type Clue = { kind: "criterion"; c: Criterion } | { kind: "badges"; cs: Criterion[] } | { kind: "letters"; pattern: string };

const crit = (kind: Criterion["kind"], id: string) => ALL_CRITERIA.find((c) => c.kind === kind && c.id === id);

/** Well-known players with enough clubs and a country we can show: a fair puzzle every time. */
const POOL = PLAYERS.slice(0, 1000).filter((p) => p.clubs.length >= 3 && crit("country", p.country));

/** "Juan Mata" → "J _ _ _   M _ _ _": first letter of each word, the rest as blanks. */
export function letterPattern(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => [...w].map((ch, i) => (i === 0 ? ch.toUpperCase() : "_")).join(" "))
    .join("   ");
}

export function cluesFor(p: GridPlayer, rand: () => number): Clue[] {
  const clubs = p.clubs
    .map((id) => crit("club", id))
    .filter((c): c is Criterion => !!c)
    .map((c) => ({ c, k: rand() }))
    .sort((a, b) => a.k - b.k)
    .map(({ c }) => ({ kind: "criterion" as const, c }));
  const country = crit("country", p.country);
  const badges = (p.badges ?? []).map((id) => crit("badge", id)).filter((c): c is Criterion => !!c);
  return [
    ...clubs,
    ...(country ? [{ kind: "criterion" as const, c: country }] : []),
    ...(badges.length ? [{ kind: "badges" as const, cs: badges }] : []),
    { kind: "letters", pattern: letterPattern(p.name) },
  ];
}

export interface Puzzle {
  player: GridPlayer;
  clues: Clue[];
}

const make = (rand: () => number): Puzzle => {
  const player = POOL[Math.floor(rand() * POOL.length)];
  return { player, clues: cluesFor(player, rand) };
};

export const mysteryForDay = (day: number) => make(seededRandom(day * 104729 + 11));
export const randomMystery = () => make(Math.random);

/** What a wrong guess has in common with the answer. */
export function compare(guess: GridPlayer, answer: GridPlayer) {
  return {
    sameCountry: guess.country === answer.country,
    country: crit("country", guess.country),
    shared: guess.clubs.filter((c) => answer.clubs.includes(c)).map((id) => crit("club", id)).filter((c): c is Criterion => !!c),
  };
}

export const findPlayer = (name: string) => PLAYERS.find((p) => p.name === name);
