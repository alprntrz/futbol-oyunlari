import { PLAYERS, type GridPlayer } from "@/data/players";
import { BORN } from "@/data/born";
import { HONOURS, type HonourId } from "@/data/honours";
import { ARAB_LINKS, ARAB_PLAYERS } from "@/data/players-arab";
import { COACHES } from "@/data/coaches";
import { TEAMMATES } from "@/data/teammates";
import { normalizeAnswer } from "./wordle";

/** A row/column criterion. `test` decides whether a player satisfies it. */
export interface Criterion {
  kind: "club" | "country" | "badge" | "mate" | "coach";
  id: string;
  tr: string;
  en: string;
  /** short glyph shown before the label (flag / emoji), optional */
  icon?: string;
  /** club crest placeholder: short code + two brand colors */
  short?: string;
  c1?: string;
  c2?: string;
  /** optional real crest image url (user-supplied); falls back to the placeholder */
  crest?: string;
  test: (p: GridPlayer) => boolean;
}

/**
 * Clubs usable as criteria (each has enough players in the DB to be solvable).
 * `short`/`c1`/`c2` drive an original colored-badge placeholder (no third-party
 * logo); set `crest` to a local image path to show a real crest instead.
 */
const CLUBS: { id: string; tr: string; en: string; short: string; c1: string; c2: string; crest?: string }[] = [
  { id: "realmadrid", tr: "Real Madrid", en: "Real Madrid", short: "RMA", c1: "#ffffff", c2: "#1a2a6c" },
  { id: "barcelona", tr: "Barcelona", en: "Barcelona", short: "BAR", c1: "#004d98", c2: "#a50044" },
  { id: "atletico", tr: "Atlético Madrid", en: "Atlético Madrid", short: "ATM", c1: "#cb3524", c2: "#ffffff" },
  { id: "sevilla", tr: "Sevilla", en: "Sevilla", short: "SEV", c1: "#d81920", c2: "#ffffff" },
  { id: "valencia", tr: "Valencia", en: "Valencia", short: "VAL", c1: "#f18e00", c2: "#000000" },
  { id: "villarreal", tr: "Villarreal", en: "Villarreal", short: "VIL", c1: "#ffd400", c2: "#003a70" },
  { id: "bayern", tr: "Bayern Münih", en: "Bayern Munich", short: "BAY", c1: "#dc052d", c2: "#ffffff" },
  { id: "dortmund", tr: "Borussia Dortmund", en: "Borussia Dortmund", short: "BVB", c1: "#fde100", c2: "#000000" },
  { id: "schalke", tr: "Schalke 04", en: "Schalke 04", short: "S04", c1: "#004b9e", c2: "#ffffff" },
  { id: "leverkusen", tr: "Bayer Leverkusen", en: "Bayer Leverkusen", short: "B04", c1: "#e32219", c2: "#000000" },
  { id: "manutd", tr: "Manchester United", en: "Manchester United", short: "MUN", c1: "#da291c", c2: "#ffe500" },
  { id: "mancity", tr: "Manchester City", en: "Manchester City", short: "MCI", c1: "#6cabdd", c2: "#ffffff" },
  { id: "liverpool", tr: "Liverpool", en: "Liverpool", short: "LIV", c1: "#c8102e", c2: "#ffffff" },
  { id: "chelsea", tr: "Chelsea", en: "Chelsea", short: "CHE", c1: "#034694", c2: "#ffffff" },
  { id: "arsenal", tr: "Arsenal", en: "Arsenal", short: "ARS", c1: "#ef0107", c2: "#ffffff" },
  { id: "tottenham", tr: "Tottenham", en: "Tottenham", short: "TOT", c1: "#ffffff", c2: "#132257" },
  { id: "juventus", tr: "Juventus", en: "Juventus", short: "JUV", c1: "#000000", c2: "#ffffff" },
  { id: "milan", tr: "AC Milan", en: "AC Milan", short: "MIL", c1: "#fb090b", c2: "#000000" },
  { id: "inter", tr: "Inter", en: "Inter", short: "INT", c1: "#0b1560", c2: "#ffffff" },
  { id: "napoli", tr: "Napoli", en: "Napoli", short: "NAP", c1: "#12a0d7", c2: "#ffffff" },
  { id: "roma", tr: "Roma", en: "Roma", short: "ROM", c1: "#8e1f2f", c2: "#f0bc42" },
  { id: "psg", tr: "Paris Saint-Germain", en: "Paris Saint-Germain", short: "PSG", c1: "#004170", c2: "#e30613" },
  { id: "monaco", tr: "Monaco", en: "Monaco", short: "MON", c1: "#e51b22", c2: "#ffffff" },
  { id: "ajax", tr: "Ajax", en: "Ajax", short: "AJA", c1: "#d2122e", c2: "#ffffff" },
  { id: "psv", tr: "PSV", en: "PSV", short: "PSV", c1: "#ed1c24", c2: "#ffffff" },
  { id: "porto", tr: "Porto", en: "Porto", short: "POR", c1: "#004b9e", c2: "#ffffff" },
  { id: "benfica", tr: "Benfica", en: "Benfica", short: "SLB", c1: "#e40521", c2: "#ffffff" },
  { id: "sporting", tr: "Sporting", en: "Sporting", short: "SCP", c1: "#008057", c2: "#ffffff" },
  { id: "galatasaray", tr: "Galatasaray", en: "Galatasaray", short: "GS", c1: "#a32638", c2: "#fdb912" },
  { id: "fenerbahce", tr: "Fenerbahçe", en: "Fenerbahçe", short: "FB", c1: "#163962", c2: "#ffed00" },
  { id: "besiktas", tr: "Beşiktaş", en: "Beşiktaş", short: "BJK", c1: "#000000", c2: "#ffffff" },
];

const COUNTRIES: { id: string; tr: string; en: string; flag: string }[] = [
  { id: "brazil", tr: "Brezilya", en: "Brazil", flag: "🇧🇷" },
  { id: "argentina", tr: "Arjantin", en: "Argentina", flag: "🇦🇷" },
  { id: "france", tr: "Fransa", en: "France", flag: "🇫🇷" },
  { id: "spain", tr: "İspanya", en: "Spain", flag: "🇪🇸" },
  { id: "germany", tr: "Almanya", en: "Germany", flag: "🇩🇪" },
  { id: "italy", tr: "İtalya", en: "Italy", flag: "🇮🇹" },
  { id: "netherlands", tr: "Hollanda", en: "Netherlands", flag: "🇳🇱" },
  { id: "england", tr: "İngiltere", en: "England", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { id: "portugal", tr: "Portekiz", en: "Portugal", flag: "🇵🇹" },
  { id: "belgium", tr: "Belçika", en: "Belgium", flag: "🇧🇪" },
  { id: "croatia", tr: "Hırvatistan", en: "Croatia", flag: "🇭🇷" },
  { id: "uruguay", tr: "Uruguay", en: "Uruguay", flag: "🇺🇾" },
  { id: "turkey", tr: "Türkiye", en: "Turkey", flag: "🇹🇷" },
  { id: "morocco", tr: "Fas", en: "Morocco", flag: "🇲🇦" },
  { id: "serbia", tr: "Sırbistan", en: "Serbia", flag: "🇷🇸" },
  { id: "senegal", tr: "Senegal", en: "Senegal", flag: "🇸🇳" },
  { id: "colombia", tr: "Kolombiya", en: "Colombia", flag: "🇨🇴" },
  { id: "denmark", tr: "Danimarka", en: "Denmark", flag: "🇩🇰" },
  { id: "ivorycoast", tr: "Fildişi Sahili", en: "Ivory Coast", flag: "🇨🇮" },
  { id: "nigeria", tr: "Nijerya", en: "Nigeria", flag: "🇳🇬" },
  { id: "usa", tr: "ABD", en: "USA", flag: "🇺🇸" },
  { id: "switzerland", tr: "İsviçre", en: "Switzerland", flag: "🇨🇭" },
  { id: "sweden", tr: "İsveç", en: "Sweden", flag: "🇸🇪" },
  { id: "ghana", tr: "Gana", en: "Ghana", flag: "🇬🇭" },
  { id: "austria", tr: "Avusturya", en: "Austria", flag: "🇦🇹" },
  { id: "poland", tr: "Polonya", en: "Poland", flag: "🇵🇱" },
  { id: "cameroon", tr: "Kamerun", en: "Cameroon", flag: "🇨🇲" },
  { id: "greece", tr: "Yunanistan", en: "Greece", flag: "🇬🇷" },
  { id: "norway", tr: "Norveç", en: "Norway", flag: "🇳🇴" },
  { id: "mexico", tr: "Meksika", en: "Mexico", flag: "🇲🇽" },
  { id: "chile", tr: "Şili", en: "Chile", flag: "🇨🇱" },
  { id: "algeria", tr: "Cezayir", en: "Algeria", flag: "🇩🇿" },
  { id: "wales", tr: "Galler", en: "Wales", flag: "🏴󠁧󠁢󠁷󠁬󠁳󠁿" },
  { id: "scotland", tr: "İskoçya", en: "Scotland", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
];

const BADGES: { id: string; tr: string; en: string; icon: string }[] = [
  { id: "wc", tr: "Dünya Kupası şampiyonu", en: "World Cup winner", icon: "🏆" },
  { id: "ucl", tr: "Şampiyonlar Ligi şampiyonu", en: "Champions League winner", icon: "⭐" },
  { id: "ballon", tr: "Ballon d'Or kazananı", en: "Ballon d'Or winner", icon: "🥇" },
  { id: "euro", tr: "Avrupa Şampiyonu", en: "Euros winner", icon: "🌍" },
];

export const ALL_CRITERIA: Criterion[] = [
  ...CLUBS.map((c) => ({ kind: "club" as const, id: c.id, tr: c.tr, en: c.en, short: c.short, c1: c.c1, c2: c.c2, crest: c.crest, test: (p: GridPlayer) => p.clubs.includes(c.id) })),
  ...COUNTRIES.map((c) => ({ kind: "country" as const, id: c.id, tr: c.tr, en: c.en, icon: c.flag, test: (p: GridPlayer) => p.country === c.id })),
  ...BADGES.map((b) => ({ kind: "badge" as const, id: b.id, tr: b.tr, en: b.en, icon: b.icon, test: (p: GridPlayer) => !!p.badges?.includes(b.id) })),
];

/**
 * Saudi and Egyptian clubs, and those two countries: only in their own league grids
 * (leagues.ts "sa" / "eg"), never in ALL_CRITERIA, so seeded daily grids and the
 * other games stay as they were. Ids start "arab-": the server deals such grids only
 * to apps that know them (caps "arab"). Players: src/data/players-arab.ts.
 */
const ARAB_CLUBS: { id: string; tr: string; en: string; short: string; c1: string; c2: string }[] = [
  { id: "arab-hilal", tr: "Al-Hilal", en: "Al-Hilal", short: "HIL", c1: "#0055a5", c2: "#ffffff" },
  { id: "arab-nassr", tr: "Al-Nassr", en: "Al-Nassr", short: "NAS", c1: "#ffd200", c2: "#1c2c5b" },
  { id: "arab-ittihad", tr: "Al-Ittihad", en: "Al-Ittihad", short: "ITT", c1: "#ffd100", c2: "#000000" },
  { id: "arab-ahlisa", tr: "Al-Ahli", en: "Al-Ahli", short: "AHL", c1: "#00843d", c2: "#ffffff" },
  { id: "arab-ahly", tr: "Al Ahly", en: "Al Ahly", short: "AHY", c1: "#c8102e", c2: "#ffffff" },
  { id: "arab-zamalek", tr: "Zamalek", en: "Zamalek", short: "ZAM", c1: "#ffffff", c2: "#c8102e" },
  { id: "arab-pyramids", tr: "Pyramids", en: "Pyramids", short: "PYR", c1: "#0a2240", c2: "#5dade2" },
];
export const ARAB_CRITERIA: Criterion[] = [
  ...ARAB_CLUBS.map((c) => ({ kind: "club" as const, ...c, test: (p: GridPlayer) => p.clubs.includes(c.id) })),
  { kind: "country", id: "arab-saudiarabia", tr: "Suudi Arabistan", en: "Saudi Arabia", icon: "🇸🇦", test: (p: GridPlayer) => p.country === "saudiarabia" },
  { kind: "country", id: "arab-egypt", tr: "Mısır", en: "Egypt", icon: "🇪🇬", test: (p: GridPlayer) => p.country === "egypt" },
];

/**
 * Tic-Tac-Toe answers: PLAYERS with their Saudi / Egyptian clubs added, plus the players who
 * only played there. For the classic criteria nothing changes (the extra players have none
 * of those clubs or honours), so every seeded grid stays solvable exactly as before.
 */
export const GRID_PLAYERS: GridPlayer[] = [...PLAYERS.map((p) => (ARAB_LINKS[p.name] ? { ...p, clubs: [...p.clubs, ...ARAB_LINKS[p.name]] } : p)), ...ARAB_PLAYERS];

/**
 * Honours with counts and birth decades ("2+ Champions League titles", "Played in a Champions
 * League final", "World Cup top scorer", "Born in the 1990s"…): src/data/honours.ts
 * (scripts/tiki-scrape-honours.mjs + tiki-scrape-finals.mjs → tiki-build-honours.mjs) and
 * src/data/born.ts. Not in ALL_CRITERIA (seeded daily grids stay as they were); `withHonour`
 * swaps one into a dealt grid. Ids "hon-…": the server deals them only to apps with caps "hon".
 */
const HONOUR_LOOK: Record<HonourId, { tr: string; en: string; icon: string; league?: string }> = {
  ucl2: { tr: "2+ Şampiyonlar Ligi", en: "2+ Champions League titles", icon: "⭐" },
  uclFinal: { tr: "ŞL finalinde oynadı", en: "Played in a UCL final", icon: "🏟️" },
  uclTop: { tr: "ŞL gol kralı", en: "Champions League top scorer", icon: "👟" },
  wcTop: { tr: "Dünya Kupası gol kralı", en: "World Cup top scorer", icon: "👟" },
  euroTop: { tr: "Avrupa Şampiyonası gol kralı", en: "Euros top scorer", icon: "👟" },
  en3: { tr: "3+ Premier Lig şampiyonluğu", en: "3+ Premier League titles", icon: "🏅", league: "en" },
  es3: { tr: "3+ La Liga şampiyonluğu", en: "3+ La Liga titles", icon: "🏅", league: "es" },
  it3: { tr: "3+ Serie A şampiyonluğu", en: "3+ Serie A titles", icon: "🏅", league: "it" },
  de3: { tr: "3+ Bundesliga şampiyonluğu", en: "3+ Bundesliga titles", icon: "🏅", league: "de" },
  fr3: { tr: "3+ Ligue 1 şampiyonluğu", en: "3+ Ligue 1 titles", icon: "🏅" },
  pt3: { tr: "3+ Portekiz ligi şampiyonluğu", en: "3+ Portuguese league titles", icon: "🏅", league: "pt" },
  tr3: { tr: "3+ Süper Lig şampiyonluğu", en: "3+ Süper Lig titles", icon: "🏅", league: "tr" },
};
const DAY0 = Date.UTC(1900, 0, 1);
/** birth year by player name (PLAYERS order in born.ts) */
const BORN_YEAR = new Map<string, number>();
PLAYERS.forEach((p, i) => {
  const code = BORN.slice(i * 3, i * 3 + 3);
  if (code && code !== "000") BORN_YEAR.set(p.name, new Date(DAY0 + parseInt(code, 36) * 86400000).getUTCFullYear());
});
const DECADES = [1970, 1980, 1990, 2000];
export const HONOUR_CRITERIA: Criterion[] = [
  ...(Object.keys(HONOUR_LOOK) as HonourId[])
    .filter((k) => (HONOURS[k]?.length ?? 0) >= 6)
    .map((k) => {
      const names = new Set(HONOURS[k]);
      const look = HONOUR_LOOK[k];
      return { kind: "badge" as const, id: `hon-${k}`, tr: look.tr, en: look.en, icon: look.icon, test: (p: GridPlayer) => names.has(p.name) };
    }),
  ...DECADES.map((d) => ({
    kind: "badge" as const,
    id: `hon-born${d}`,
    tr: d === 2000 ? "2000'lerde doğdu" : `${String(d).slice(2)}'lerde doğdu`,
    en: `Born in the ${d === 2000 ? "2000" : String(d).slice(2)}s`,
    icon: "🎂",
    test: (p: GridPlayer) => {
      const y = BORN_YEAR.get(p.name);
      return y !== undefined && y >= d && y < d + 10;
    },
  })),
];
/** the league a title criterion belongs to (its league grids prefer it) */
const HONOUR_LEAGUE = new Map(Object.entries(HONOUR_LOOK).map(([k, v]) => [`hon-${k}`, v.league]));

/**
 * Swap one country / honour line of a dealt grid for an honour or birth-decade criterion
 * (`chance` of the time), keeping every square answerable. Club lines stay. A league grid
 * (`league`) prefers that league's title criterion.
 */
export function withHonour(grid: Grid, rand: () => number = Math.random, chance = 0.5, league?: string): Grid {
  if (!HONOUR_CRITERIA.length || rand() >= chance) return grid;
  if ([...grid.rows, ...grid.cols].some((c) => c.id.startsWith("hon-"))) return grid;
  // league titles only in their own league's grid (or the all-clubs grid); the rest anywhere
  const pool = HONOUR_CRITERIA.filter((c) => {
    const lg = HONOUR_LEAGUE.get(c.id);
    return !lg || !league || league === "all" || lg === league;
  });
  const own = pool.filter((c) => !!league && HONOUR_LEAGUE.get(c.id) === league);
  // the league's own titles first, then the other honours, birth decades last (a third of the time first)
  const born = (c: Criterion) => c.id.startsWith("hon-born");
  const rest = shuffle(pool.filter((c) => !own.includes(c)), rand);
  const order = [...shuffle(own, rand), ...(rand() < 0.33 ? [...rest.filter(born), ...rest.filter((c) => !born(c))] : [...rest.filter((c) => !born(c)), ...rest.filter(born)])];
  const lines = shuffle(["r0", "r1", "r2", "c0", "c1", "c2"], rand);
  for (const hon of order.slice(0, 16)) {
    for (const line of lines) {
      const i = Number(line[1]);
      const kept = line[0] === "r" ? grid.rows : grid.cols;
      const cross = line[0] === "r" ? grid.cols : grid.rows;
      if (kept[i].kind === "club") continue;
      if (!cross.every((c) => cellSolvable(hon, c))) continue;
      const next = kept.map((c, k) => (k === i ? hon : c));
      return line[0] === "r" ? { rows: next, cols: grid.cols } : { rows: grid.rows, cols: next };
    }
  }
  return grid;
}

/**
 * "Played with X": club teammates of a star (src/data/teammates.ts). Not in
 * ALL_CRITERIA, so seeded grids (daily) and other games stay as they were;
 * `withLink` swaps one into a dealt grid. Ids are "mate-…".
 */
export const MATE_CRITERIA: Criterion[] = TEAMMATES.map((m) => {
  const mates = new Set(m.mates);
  return { kind: "mate" as const, id: `mate-${m.id}`, tr: `${m.name} ile oynadı`, en: `Played with ${m.name}`, short: m.name, test: (p: GridPlayer) => mates.has(p.name) };
});

/** "Managed by X": players a famous coach had at a criteria club (src/data/coaches.ts). Ids are "coach-…". */
export const COACH_CRITERIA: Criterion[] = COACHES.map((m) => {
  const players = new Set(m.players);
  return { kind: "coach" as const, id: `coach-${m.id}`, tr: `Hocası ${m.name}`, en: `Managed by ${m.name}`, short: m.name, test: (p: GridPlayer) => players.has(p.name) };
});

/** The "people" criteria (played with / managed by) that `withLink` can deal in, with where they belong. */
const LINKS: { c: Criterion; global: boolean; clubs: string[] }[] = [
  ...TEAMMATES.map((m, i) => ({ c: MATE_CRITERIA[i], global: m.global, clubs: m.clubs })),
  ...COACHES.map((m, i) => ({ c: COACH_CRITERIA[i], global: m.global, clubs: m.clubs })),
];
const LINK_CRITERIA = LINKS.map((l) => l.c);
const isLink = (c: Criterion) => c.kind === "mate" || c.kind === "coach";

const BY_ID = new Map([...ALL_CRITERIA, ...ARAB_CRITERIA, ...HONOUR_CRITERIA, ...LINK_CRITERIA].map((c) => [c.id, c]));
/** Any criterion by id, "played with" ones included (online grids travel as ids). */
export const criterionById = (id: string): Criterion | undefined => BY_ID.get(id);

/**
 * Maybe (`chance`) swap one row or column of a grid for a "played with" star or a
 * "managed by" coach, keeping every square solvable. At most one such line per
 * grid. `leagueClubs`: a league grid gets the names who were at that league's
 * clubs (local ones too); without it only world-class names are dealt.
 */
export function withLink(grid: Grid, rand: () => number = Math.random, chance = 0.5, leagueClubs?: string[]): Grid {
  if (!LINKS.length || rand() >= chance) return grid;
  if ([...grid.rows, ...grid.cols].some(isLink)) return grid;
  const pool = LINKS.filter((l) => (leagueClubs?.length ? l.clubs.some((c) => leagueClubs.includes(c)) : l.global)).map((l) => l.c);
  const lines = shuffle(["r0", "r1", "r2", "c0", "c1", "c2"], rand);
  for (const link of shuffle(pool, rand).slice(0, 12)) {
    for (const line of lines) {
      const i = Number(line[1]);
      const cross = line[0] === "r" ? grid.cols : grid.rows;
      const kept = line[0] === "r" ? grid.rows : grid.cols;
      if (!cross.every((c) => cellSolvable(link, c))) continue;
      const next = kept.map((c, k) => (k === i ? link : c));
      return line[0] === "r" ? { rows: next, cols: grid.cols } : { rows: grid.rows, cols: next };
    }
  }
  return grid;
}

/** All normalized answer forms accepted for a player (full name + surname + aliases). */
function acceptedForms(p: GridPlayer): Set<string> {
  const forms = new Set<string>();
  const add = (s: string) => { const n = normalizeAnswer(s); if (n) forms.add(n); };
  const names = [p.name, ...(p.aliases ?? [])];
  for (const nm of names) {
    add(nm); // full name
    const tokens = nm.trim().split(/\s+/);
    add(tokens[tokens.length - 1]); // surname / last token
    // also last 2–3 tokens joined, to accept particle surnames like
    // "van Dijk", "De Bruyne", "van der Vaart", "dos Santos"
    if (tokens.length >= 2) add(tokens.slice(-2).join(" "));
    if (tokens.length >= 3) add(tokens.slice(-3).join(" "));
  }
  return forms;
}
const FORMS = new Map<GridPlayer, Set<string>>(GRID_PLAYERS.map((p) => [p, acceptedForms(p)]));

/** Players whose accepted answer forms include the (normalized) guess. */
export function matchPlayers(guess: string): GridPlayer[] {
  const g = normalizeAnswer(guess);
  if (!g) return [];
  return GRID_PLAYERS.filter((p) => FORMS.get(p)!.has(g));
}

/** Normalized haystack (name + aliases, letters only) for substring search. */
const HAYSTACK = new Map<GridPlayer, string>(
  GRID_PLAYERS.map((p) => [p, [p.name, ...(p.aliases ?? [])].map(normalizeAnswer).join("|")])
);

/**
 * Autocomplete: players whose name/alias contains the typed text (substring).
 * "Alex" → Alex de Souza, Alexis Sánchez, Álvaro… Returns up to `limit`.
 */
export function searchPlayers(query: string, limit = 8): GridPlayer[] {
  const q = normalizeAnswer(query);
  if (q.length < 2) return [];
  const starts: GridPlayer[] = [];
  const contains: GridPlayer[] = [];
  for (const p of GRID_PLAYERS) {
    const h = HAYSTACK.get(p)!;
    if (h.split("|").some((s) => s.startsWith(q))) starts.push(p);
    else if (h.includes(q)) contains.push(p);
  }
  return [...starts, ...contains].slice(0, limit);
}

/** Does any DB player satisfy both criteria? (for solvability checks) */
export function cellSolvable(a: Criterion, b: Criterion): boolean {
  return GRID_PLAYERS.some((p) => a.test(p) && b.test(p));
}

/**
 * Validate a guess for a cell: returns the matched player who satisfies BOTH
 * criteria (and isn't in `used`), or null.
 */
export function validateCell(guess: string, row: Criterion, col: Criterion, used: Set<string>): GridPlayer | null {
  const cands = matchPlayers(guess).filter((p) => row.test(p) && col.test(p));
  const fresh = cands.find((p) => !used.has(p.name));
  return fresh ?? null;
}

export interface Grid { rows: Criterion[]; cols: Criterion[]; }

function shuffle<T>(a: T[], rand: () => number = Math.random): T[] { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; }

/**
 * Generate a solvable grid: 3 rows, then 3 cols each guaranteed solvable against
 * every row (so every one of the 9 cells has ≥1 player). At most 2 badge
 * criteria total, and no country×country cells (a player has one nationality).
 */
/** `rand` lets callers seed the grid (e.g. one shared daily grid). */
export function generateGrid(rand: () => number = Math.random, opts: { clubPairs?: boolean } = {}): Grid {
  // dealt grids: most of the time at least one club × club square (seeded daily grids keep the old rule)
  const wantPair = !!opts.clubPairs && rand() < 0.7;
  for (let attempt = 0; attempt < 400; attempt++) {
    const shuffled = shuffle(ALL_CRITERIA, rand);
    const rows = shuffled.slice(0, 3);
    const cands = shuffled
      .slice(3)
      .filter((c) => rows.every((r) => !(r.kind === "country" && c.kind === "country") && cellSolvable(r, c)));
    if (cands.length < 3) continue;
    const cols = cands.slice(0, 3);
    if ([...rows, ...cols].filter((x) => x.kind === "badge").length > 2) continue;
    // avoid the whole board being one kind (nicer variety)
    const kinds = new Set([...rows, ...cols].map((x) => x.kind));
    if (kinds.size < 2) continue;
    if (wantPair && attempt < 300 && !(rows.some((c) => c.kind === "club") && cols.some((c) => c.kind === "club"))) continue;
    return { rows, cols };
  }
  const by = (id: string) => ALL_CRITERIA.find((c) => c.id === id)!;
  return { rows: [by("realmadrid"), by("barcelona"), by("brazil")], cols: [by("milan"), by("inter"), by("chelsea")] };
}

/** Small deterministic PRNG (mulberry32) for seeded grids. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
