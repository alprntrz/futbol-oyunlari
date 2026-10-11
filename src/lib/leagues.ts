import { recentMatches } from "./daily";
import { ALL_CRITERIA, cellSolvable, type Criterion, type Grid } from "./tiki";
import type { Match } from "./types";

type L = { tr: string; en: string };

/**
 * Leagues for Hat-trick: a league grid only uses that league's clubs (plus
 * countries and honours). Only leagues with at least three clubs in the
 * criteria list can fill a grid, so this is the full set the data allows.
 */
export type LeagueId = "all" | "tr" | "en" | "es" | "it" | "de" | "pt";
export interface League {
  id: LeagueId;
  name: L;
  /** Flag id (mobile Flag component); none = the all-clubs option */
  flag?: string;
  clubs: string[];
}

export const LEAGUES: League[] = [
  { id: "all", name: { tr: "Tüm takımlar", en: "All clubs" }, clubs: [] },
  { id: "en", name: { tr: "Premier Lig", en: "Premier League" }, flag: "england", clubs: ["manutd", "mancity", "liverpool", "chelsea", "arsenal", "tottenham"] },
  { id: "es", name: { tr: "La Liga", en: "La Liga" }, flag: "spain", clubs: ["realmadrid", "barcelona", "atletico", "sevilla", "valencia", "villarreal"] },
  { id: "it", name: { tr: "Serie A", en: "Serie A" }, flag: "italy", clubs: ["juventus", "milan", "inter", "napoli", "roma"] },
  { id: "de", name: { tr: "Bundesliga", en: "Bundesliga" }, flag: "germany", clubs: ["bayern", "dortmund", "schalke", "leverkusen"] },
  { id: "pt", name: { tr: "Portekiz Ligi", en: "Portuguese league" }, flag: "portugal", clubs: ["porto", "benfica", "sporting"] },
  { id: "tr", name: { tr: "Süper Lig", en: "Turkish league" }, flag: "turkey", clubs: ["galatasaray", "fenerbahce", "besiktas"] },
];

export const leagueById = (id: string | undefined) => LEAGUES.find((l) => l.id === id) ?? LEAGUES[0];

function shuffle<T>(xs: T[], rand: () => number): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * A grid from one league: three of its clubs down the side, three countries or
 * honours (or more of its clubs) across the top, every square answerable.
 */
export function leagueGrid(id: LeagueId, rand: () => number = Math.random): Grid | null {
  const league = leagueById(id);
  if (!league.clubs.length) return null;
  const clubs = ALL_CRITERIA.filter((c) => c.kind === "club" && league.clubs.includes(c.id));
  const others = ALL_CRITERIA.filter((c) => c.kind !== "club");
  for (let attempt = 0; attempt < 600; attempt++) {
    const rows = shuffle(clubs, rand).slice(0, 3);
    const pool = shuffle([...others, ...clubs.filter((c) => !rows.includes(c))], rand);
    const cols: Criterion[] = [];
    for (const c of pool) {
      if (cols.length === 3) break;
      if (c.kind === "badge" && cols.some((x) => x.kind === "badge")) continue;
      if (rows.every((r) => cellSolvable(r, c))) cols.push(c);
    }
    if (cols.length === 3) return rand() < 0.5 ? { rows, cols } : { rows: cols, cols: rows };
  }
  return null;
}

/** Missing 11 categories: a pool of matches each. */
export type XiCategoryId = "all" | "tr" | "en" | "es" | "it" | "de" | "europe" | "national";
export interface XiCategory {
  id: XiCategoryId;
  name: L;
  flag?: string;
  icon?: "europe" | "national";
  matches: () => Match[];
}

const byTag = (tag: string) => () => recentMatches().filter((m) => m.tags?.includes(tag));
const isNational = (m: Match) => /World Cup|Euro|Copa Am/.test(m.competition.en);

export const XI_CATEGORIES: XiCategory[] = [
  { id: "all", name: { tr: "Tüm maçlar", en: "All matches" }, matches: recentMatches },
  { id: "tr", name: { tr: "Türk futbolu", en: "Turkish football" }, flag: "turkey", matches: byTag("turkiye") },
  { id: "en", name: { tr: "Premier Lig", en: "Premier League" }, flag: "england", matches: byTag("premier-lig") },
  { id: "es", name: { tr: "La Liga", en: "La Liga" }, flag: "spain", matches: byTag("la-liga") },
  { id: "it", name: { tr: "Serie A", en: "Serie A" }, flag: "italy", matches: byTag("serie-a") },
  { id: "de", name: { tr: "Bundesliga", en: "Bundesliga" }, flag: "germany", matches: byTag("bundesliga") },
  {
    id: "europe",
    name: { tr: "Avrupa kupaları", en: "European cups" },
    icon: "europe",
    matches: () => recentMatches().filter((m) => /Champions League|Europa League|UEFA Cup/.test(m.competition.en)),
  },
  { id: "national", name: { tr: "Milli takımlar", en: "National teams" }, icon: "national", matches: () => recentMatches().filter(isNational) },
];

export const xiCategoryById = (id: string | undefined) => XI_CATEGORIES.find((c) => c.id === id) ?? XI_CATEGORIES[0];
