import { MATCHES } from "@/data/matches";
import { PLAYERS, type GridPlayer } from "@/data/players";
import { ALL_CRITERIA, type Criterion } from "./tiki";
import type { Match } from "./types";

/**
 * Football quiz questions, generated from the bundled data (players, clubs,
 * historic matches) so there's no question bank to maintain. Each question has
 * exactly one right option among four, both languages included, so a room can
 * be dealt by one phone and played on any.
 */

type L = { tr: string; en: string };
export interface QuizQuestion {
  text: L;
  /** match context line shown above the question, if any */
  context?: L;
  options: L[];
  answer: number;
}
export type QuizCategory = "mixed" | "players" | "matches";
/**
 * easy: superstars only (nationality, a club they played for, Ballon d'Or-type honours;
 *       match questions only from finals);
 * normal: well-known players, club links, starters and scorers of finals, derbies and
 *       national-team matches;
 * hard: exact scores, any match's starters and scorers, deeper player pool.
 */
export type QuizDifficulty = "easy" | "normal" | "hard";

const same = (s: string): L => ({ tr: s, en: s });
const crits = (kind: Criterion["kind"]) => ALL_CRITERIA.filter((c) => c.kind === kind);
const crit = (kind: Criterion["kind"], id: string) => ALL_CRITERIA.find((c) => c.kind === kind && c.id === id);
const label = (c: Criterion): L => ({ tr: c.tr, en: c.en });

/**
 * Well-known players only, so questions stay fair (the list is sorted by fame).
 * Single names ("Pedro", "Miguel") are skipped: too easy to mix up.
 */
const TWO_NAMES = PLAYERS.filter((p) => p.name.includes(" "));
/**
 * Fame: honours (World Cup, Champions League, Ballon d'Or, Euros) plus how often a
 * player starts in our classic matches. Club count alone favours journeymen.
 */
const APPS = new Map<string, number>();
for (const m of MATCHES) for (const p of m.lineup) APPS.set(p.name, (APPS.get(p.name) ?? 0) + 1);
const fame = (p: GridPlayer) => (p.badges?.length ?? 0) * 4 + Math.min(APPS.get(p.name) ?? 0, 12);
const BY_FAME = TWO_NAMES.map((p, i) => ({ p, f: fame(p), i }))
  .sort((a, b) => b.f - a.f || a.i - b.i)
  .map((x) => x.p);
const POOL: Record<QuizDifficulty, GridPlayer[]> = {
  easy: BY_FAME.slice(0, 100),
  normal: BY_FAME.slice(0, 400),
  hard: BY_FAME.slice(0, 1200),
};
/** Finals; then also derbies and national teams; then every match. */
const isFinal = (m: Match) => /final/i.test(m.competition.en) && !/semi|quarter|1\/8|round/i.test(m.competition.en);
const isBig = (m: Match) => isFinal(m) || m.tags?.includes("derbi") || /World Cup|EURO|European Championship|Nations League/.test(m.competition.en);
const MATCH_POOL: Record<QuizDifficulty, Match[]> = {
  easy: MATCHES.filter(isFinal),
  normal: MATCHES.filter(isBig),
  hard: MATCHES,
};

/** Generators read the pools of the current difficulty. */
let FAMOUS = POOL.normal;
let GAMES = MATCH_POOL.normal;

function pick<T>(xs: T[], rand: () => number): T {
  return xs[Math.floor(rand() * xs.length)];
}
function sample<T>(xs: T[], n: number, rand: () => number): T[] {
  const pool = xs.slice();
  const out: T[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return out;
}
/** Puts the right option among three wrong ones at a random place. */
function build(text: L, right: L, wrong: L[], rand: () => number, context?: L): QuizQuestion | null {
  if (wrong.length < 3) return null;
  const answer = Math.floor(rand() * 4);
  const options = wrong.slice(0, 3);
  options.splice(answer, 0, right);
  return { text, context, options, answer };
}

// ── player questions ─────────────────────────────────────────────────────

function nationality(rand: () => number) {
  const p = pick(FAMOUS.filter((x) => crit("country", x.country)), rand);
  const right = crit("country", p.country)!;
  const wrong = sample(crits("country").filter((c) => c.id !== p.country), 3, rand);
  return build({ tr: `${p.name} hangi ülkenin milli takımında oynadı?`, en: `Which country did ${p.name} play for?` }, label(right), wrong.map(label), rand);
}

function playedFor(rand: () => number) {
  const p = pick(FAMOUS.filter((x) => x.clubs.length >= 2), rand);
  const right = crit("club", pick(p.clubs, rand));
  if (!right) return null;
  const wrong = sample(crits("club").filter((c) => !p.clubs.includes(c.id)), 3, rand);
  return build({ tr: `${p.name} bu kulüplerden hangisinde forma giydi?`, en: `Which of these clubs did ${p.name} play for?` }, label(right), wrong.map(label), rand);
}

function neverPlayed(rand: () => number) {
  const club = pick(crits("club"), rand);
  const inClub = FAMOUS.filter((p) => p.clubs.includes(club.id));
  const out = FAMOUS.filter((p) => !p.clubs.includes(club.id) && p.clubs.length > 0);
  if (inClub.length < 3) return null;
  const right = pick(out, rand);
  const wrong = sample(inClub, 3, rand);
  return build({ tr: `Hangisi hiç ${club.tr} forması giymedi?`, en: `Who never played for ${club.en}?` }, same(right.name), wrong.map((p) => same(p.name)), rand);
}

function honour(rand: () => number) {
  const badge = pick(crits("badge"), rand);
  const winners = FAMOUS.filter((p) => p.badges?.includes(badge.id));
  const others = FAMOUS.slice(0, 400).filter((p) => !p.badges?.includes(badge.id));
  if (!winners.length) return null;
  const right = pick(winners, rand);
  return build({ tr: `Hangisi ${badge.tr}?`, en: `Who is a ${badge.en}?` }, same(right.name), sample(others, 3, rand).map((p) => same(p.name)), rand);
}

function sharedClub(rand: () => number) {
  const p = pick(FAMOUS.filter((x) => x.clubs.length >= 2), rand);
  const mates = FAMOUS.filter((x) => x !== p && x.clubs.some((c) => p.clubs.includes(c)));
  const strangers = FAMOUS.filter((x) => x !== p && !x.clubs.some((c) => p.clubs.includes(c)) && x.clubs.length > 0);
  if (!mates.length) return null;
  return build(
    { tr: `Hangisi ${p.name} ile aynı kulüpte forma giydi?`, en: `Who played for one of the same clubs as ${p.name}?` },
    same(pick(mates, rand).name),
    sample(strangers, 3, rand).map((x) => same(x.name)),
    rand
  );
}

// ── match questions ──────────────────────────────────────────────────────

// derby names come as "Derby · League": keep it to one plain line
const comp = (s: string) => s.replace(/\s+·\s+/g, ", ");
const matchLine = (m: Match): L => ({
  tr: `${m.team} – ${m.opponent}\n${comp(m.competition.tr)}, ${m.season}`,
  en: `${m.team} – ${m.opponent}\n${comp(m.competition.en)}, ${m.season}`,
});

function score(rand: () => number) {
  const m = pick(GAMES, rand);
  const hit = /^(\d+)-(\d+)/.exec(m.score);
  if (!hit) return null;
  const [a, b] = [Number(hit[1]), Number(hit[2])];
  const right = `${a}-${b}`;
  const wrong = new Set<string>();
  const tries = [`${b}-${a}`, `${a + 1}-${b}`, `${a}-${b + 1}`, `${Math.max(0, a - 1)}-${b}`, `${a + 1}-${b + 1}`, `${a}-${Math.max(0, b - 1)}`, `${a + 2}-${b}`];
  for (const s of sample(tries, tries.length, rand)) if (s !== right) wrong.add(s);
  return build({ tr: "Bu maç kaç kaç bitti?", en: "What was the score?" }, same(right), [...wrong].map(same), rand, matchLine(m));
}

function starter(rand: () => number) {
  const m = pick(GAMES, rand);
  const names = new Set(m.lineup.map((p) => p.name));
  const right = pick(m.lineup, rand).name;
  const others = [...new Set(MATCHES.filter((x) => x.team !== m.team).flatMap((x) => x.lineup.map((p) => p.name)))].filter((n) => !names.has(n));
  return build(
    { tr: `Hangisi bu maçta ${m.team} ilk 11'indeydi?`, en: `Who started this match for ${m.team}?` },
    same(right),
    sample(others, 3, rand).map(same),
    rand,
    matchLine(m)
  );
}

function scorer(rand: () => number) {
  const m = pick(GAMES.filter((x) => x.lineup.some((p) => p.goals)), rand);
  if (!m) return null;
  const right = pick(m.lineup.filter((p) => p.goals), rand).name;
  const wrong = m.lineup.filter((p) => !p.goals && p.number !== 1).map((p) => p.name);
  return build({ tr: `Bu maçta ${m.team} için kim gol attı?`, en: `Who scored for ${m.team} in this match?` }, same(right), sample(wrong, 3, rand).map(same), rand, matchLine(m));
}

const PLAYER_Q: Record<QuizDifficulty, ((rand: () => number) => QuizQuestion | null)[]> = {
  easy: [nationality, playedFor, honour],
  normal: [nationality, playedFor, neverPlayed, honour, sharedClub],
  hard: [neverPlayed, sharedClub, playedFor],
};
const MATCH_Q: Record<QuizDifficulty, ((rand: () => number) => QuizQuestion | null)[]> = {
  easy: [scorer],
  normal: [starter, scorer],
  hard: [score, score, starter, scorer],
};

/** `count` different questions; the same rand gives the same set. */
export function quizQuestions(count: number, category: QuizCategory, difficulty: QuizDifficulty = "normal", rand: () => number = Math.random): QuizQuestion[] {
  FAMOUS = POOL[difficulty];
  GAMES = MATCH_POOL[difficulty];
  // easy leans on players (everyone knows them); hard leans on matches (scores, line-ups)
  const players = PLAYER_Q[difficulty];
  const matches = MATCH_Q[difficulty];
  const mixed = difficulty === "easy" ? [...players, ...players, ...matches] : difficulty === "hard" ? [...players, ...matches, ...matches] : [...players, ...matches];
  const makers = category === "players" ? players : category === "matches" ? matches : mixed;
  const out: QuizQuestion[] = [];
  const seen = new Set<string>();
  for (let guard = 0; out.length < count && guard < count * 40; guard++) {
    const q = pick(makers, rand)(rand);
    if (!q) continue;
    const k = q.text.en + (q.context?.en ?? "");
    if (seen.has(k) || new Set(q.options.map((o) => o.en)).size < 4) continue;
    seen.add(k);
    out.push(q);
  }
  return out;
}

/** Points for a right answer: 10 when instant, sliding to 5 at the buzzer; a wrong one scores 0. */
export function quizPoints(msTaken: number, msLimit: number): number {
  const left = Math.max(0, Math.min(1, 1 - msTaken / msLimit));
  return Math.round(5 + 5 * left);
}

export type { GridPlayer };
