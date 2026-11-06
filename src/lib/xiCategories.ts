import { recentMatches } from "./daily";
import type { Match } from "./types";

type L = { tr: string; en: string };

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
