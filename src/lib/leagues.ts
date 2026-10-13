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
 * A grid from one league, every square answerable. Usually club × club: some of
 * the league's clubs down the side and some across the top (2 + 1 when the league
 * only has three), the rest countries or honours; otherwise three clubs against
 * three countries / honours.
 */
export function leagueGrid(id: LeagueId, rand: () => number = Math.random): Grid | null {
  const league = leagueById(id);
  if (!league.clubs.length) return null;
  const clubs = ALL_CRITERIA.filter((c) => c.kind === "club" && league.clubs.includes(c.id));
  const others = ALL_CRITERIA.filter((c) => c.kind !== "club");
  const pairs = rand() < 0.7;
  for (let attempt = 0; attempt < 800; attempt++) {
    const order = shuffle(clubs, rand);
    // club × club: split the league's clubs between rows and columns
    const rowClubs = pairs && attempt < 600 ? (clubs.length >= 5 ? 3 : 2) : 3;
    const colClubs = pairs && attempt < 600 ? Math.min(clubs.length - rowClubs, clubs.length >= 5 ? 2 : 1) : 0;
    const rows: Criterion[] = order.slice(0, rowClubs);
    const colClubList = order.slice(rowClubs, rowClubs + colClubs);
    const fill = shuffle(others, rand);
    // fill the rows up to three with countries / honours
    for (const c of fill) {
      if (rows.length === 3) break;
      if (rows.some((r) => r.kind === "badge") && c.kind === "badge") continue;
      if (colClubList.every((k) => cellSolvable(c, k))) rows.push(c);
    }
    if (rows.length < 3) continue;
    const cols: Criterion[] = [];
    for (const c of [...colClubList, ...fill, ...order.slice(rowClubs + colClubs)]) {
      if (cols.length === 3) break;
      if (cols.includes(c) || rows.includes(c)) continue;
      if (c.kind === "badge" && [...rows, ...cols].filter((x) => x.kind === "badge").length >= 2) continue;
      if (c.kind === "country" && rows.some((r) => r.kind === "country")) continue;
      if (rows.every((r) => !(r.kind === "country" && c.kind === "country") && cellSolvable(r, c))) cols.push(c);
    }
    if (cols.length < 3) continue;
    // a country row against a country column can't be answered: checked above for new cols
    if (rows.some((r) => r.kind === "country") && cols.some((c) => c.kind === "country")) continue;
    const r = shuffle(rows, rand);
    const c = shuffle(cols, rand);
    return rand() < 0.5 ? { rows: r, cols: c } : { rows: c, cols: r };
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
