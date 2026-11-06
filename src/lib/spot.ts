/**
 * The Spot (Beyaz Nokta): a one-on-one penalty shootout of nerve. Every kick both players pick a
 * side in secret: the kicker where to shoot, the keeper where to go. Same side is a save, any other
 * is a goal. Five kicks each, then sudden death; both see every earlier pick, so habits give you away.
 * Pure rules, shared by the phone (house player) and server-games/sp.js.
 */
export type SpotDir = "l" | "c" | "r";
export type SpotMark = "X" | "O";

export const SPOT_DIRS: SpotDir[] = ["l", "c", "r"];
/** kicks each before sudden death */
export const SPOT_KICKS = 5;
/** kicks each before a level shootout ends as a draw */
export const SPOT_MAX_KICKS = 10;
/** time to pick, per kick */
export const SPOT_PICK_MS = 8_000;
/** how long a kick plays out on screen before the next one */
export const SPOT_REVEAL_MS = 2_600;

export interface SpotKick {
  kicker: SpotMark;
  /** null: out of time */
  shot: SpotDir | null;
  dive: SpotDir | null;
  goal: boolean;
}

export const spotCleanDir = (v: unknown): SpotDir | null => (SPOT_DIRS.includes(v as SpotDir) ? (v as SpotDir) : null);

/** A kicker out of time misses; a keeper out of time stays put and is beaten. */
export const spotIsGoal = (shot: SpotDir | null, dive: SpotDir | null) => shot !== null && shot !== dive;

export const spotOther = (m: SpotMark): SpotMark => (m === "X" ? "O" : "X");

/** X kicks first, then they swap. */
export const spotKicker = (kicks: SpotKick[]): SpotMark => (kicks.length % 2 === 0 ? "X" : "O");

export function spotTally(kicks: SpotKick[]): Record<SpotMark, number> {
  return { X: kicks.filter((k) => k.kicker === "X" && k.goal).length, O: kicks.filter((k) => k.kicker === "O" && k.goal).length };
}

/** The winner once it can't change, "draw" at the kick limit, null while it's open. */
export function spotResult(kicks: SpotKick[]): SpotMark | "draw" | null {
  const { X, O } = spotTally(kicks);
  const n = kicks.length;
  if (n < SPOT_KICKS * 2) {
    const leftX = SPOT_KICKS - Math.ceil(n / 2);
    const leftO = SPOT_KICKS - Math.floor(n / 2);
    return X > O + leftO ? "X" : O > X + leftX ? "O" : null;
  }
  // sudden death: settled only when both have kicked
  if (n % 2 !== 0) return null;
  if (X !== O) return X > O ? "X" : "O";
  return n >= SPOT_MAX_KICKS * 2 ? "draw" : null;
}

function habit(picks: (SpotDir | null)[]): SpotDir | null {
  const seen = picks.filter((d): d is SpotDir => d !== null);
  if (!seen.length) return null;
  return SPOT_DIRS.map((d) => ({ d, n: seen.filter((x) => x === d).length })).sort((a, b) => b.n - a.n)[0].d;
}

/** The house player: reads the rival's habit part of the time, otherwise picks at random. */
export function spotHousePick(kicks: SpotKick[], me: SpotMark, rand: () => number = Math.random): SpotDir {
  const random = SPOT_DIRS[Math.floor(rand() * SPOT_DIRS.length)];
  if (rand() >= 0.5) return random;
  const rival = spotOther(me);
  if (spotKicker(kicks) === rival) return habit(kicks.filter((k) => k.kicker === rival).map((k) => k.shot)) ?? random;
  // kicking: away from where the rival keeper usually goes
  const dives = habit(kicks.filter((k) => k.kicker === me).map((k) => k.dive));
  return SPOT_DIRS.filter((d) => d !== dives)[Math.floor(rand() * 2)] ?? random;
}

/** How long the house player "thinks", in ms. */
export const spotHouseThinkMs = () => 1_000 + Math.random() * 4_000;
