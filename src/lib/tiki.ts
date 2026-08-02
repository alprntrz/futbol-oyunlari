import { PLAYERS, type GridPlayer } from "@/data/players";
import { normalizeAnswer } from "./wordle";

/** A row/column criterion. `test` decides whether a player satisfies it. */
export interface Criterion {
  kind: "club" | "country" | "badge";
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
const FORMS = new Map<GridPlayer, Set<string>>(PLAYERS.map((p) => [p, acceptedForms(p)]));

/** Players whose accepted answer forms include the (normalized) guess. */
export function matchPlayers(guess: string): GridPlayer[] {
  const g = normalizeAnswer(guess);
  if (!g) return [];
  return PLAYERS.filter((p) => FORMS.get(p)!.has(g));
}

/** Normalized haystack (name + aliases, letters only) for substring search. */
const HAYSTACK = new Map<GridPlayer, string>(
  PLAYERS.map((p) => [p, [p.name, ...(p.aliases ?? [])].map(normalizeAnswer).join("|")])
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
  for (const p of PLAYERS) {
    const h = HAYSTACK.get(p)!;
    if (h.split("|").some((s) => s.startsWith(q))) starts.push(p);
    else if (h.includes(q)) contains.push(p);
  }
  return [...starts, ...contains].slice(0, limit);
}

/** Does any DB player satisfy both criteria? (for solvability checks) */
export function cellSolvable(a: Criterion, b: Criterion): boolean {
  return PLAYERS.some((p) => a.test(p) && b.test(p));
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

function shuffle<T>(a: T[]): T[] { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; }

/**
 * Generate a solvable grid: 3 rows, then 3 cols each guaranteed solvable against
 * every row (so every one of the 9 cells has ≥1 player). At most 2 badge
 * criteria total, and no country×country cells (a player has one nationality).
 */
export function generateGrid(): Grid {
  for (let attempt = 0; attempt < 400; attempt++) {
    const shuffled = shuffle(ALL_CRITERIA);
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
    return { rows, cols };
  }
  const by = (id: string) => ALL_CRITERIA.find((c) => c.id === id)!;
  return { rows: [by("realmadrid"), by("barcelona"), by("brazil")], cols: [by("milan"), by("inter"), by("chelsea")] };
}
