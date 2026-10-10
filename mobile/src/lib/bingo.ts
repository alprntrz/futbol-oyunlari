import { PLAYERS, type GridPlayer } from "@/data/players";
import { ALL_CRITERIA, seededRandom, type Criterion } from "@/lib/tiki";

/**
 * Football Bingo (daily): a 4×4 card of criteria and a stream of footballers.
 * Each footballer goes on one square that they fit; skip if none fits. A wrong
 * square costs a turn (the next footballer is skipped). One wildcard places a
 * footballer on every square they fit. Fewest footballers to fill the card wins.
 */
export const CARD_SIZE = 16;
const STREAM_LENGTH = 45;
/** Only well-known players appear in the stream (the list is sorted by notability). */
const POOL = PLAYERS.slice(0, 2500);

export interface BingoDay {
  card: Criterion[];
  stream: GridPlayer[];
}

function shuffle<T>(a: T[], rand: () => number): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/** Same card and the same footballers, in the same order, for everyone on a given day. */
export function bingoForDay(day: number): BingoDay {
  const rand = seededRandom(day * 104729 + 7);
  const clubs = ALL_CRITERIA.filter((c) => c.kind === "club");
  const countries = ALL_CRITERIA.filter((c) => c.kind === "country");
  const badges = ALL_CRITERIA.filter((c) => c.kind === "badge");

  for (let attempt = 0; attempt < 50; attempt++) {
    const card = shuffle([...shuffle(clubs, rand).slice(0, 9), ...shuffle(countries, rand).slice(0, 5), ...shuffle(badges, rand).slice(0, 2)], rand);
    // Guarantee two chances per square, then pad with random fitting players
    const picked = new Set<GridPlayer>();
    let ok = true;
    for (const c of card) {
      const fits = shuffle(POOL.filter((p) => c.test(p) && !picked.has(p)), rand).slice(0, 2);
      if (fits.length < 2) {
        ok = false;
        break;
      }
      fits.forEach((p) => picked.add(p));
    }
    if (!ok) continue;
    const extra = shuffle(POOL.filter((p) => !picked.has(p) && card.some((c) => c.test(p))), rand).slice(0, STREAM_LENGTH - picked.size);
    return { card, stream: shuffle([...picked, ...extra], rand) };
  }
  const card = ALL_CRITERIA.slice(0, CARD_SIZE);
  return { card, stream: shuffle(POOL.filter((p) => card.some((c) => c.test(p))), rand).slice(0, STREAM_LENGTH) };
}
