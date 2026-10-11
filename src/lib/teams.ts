import { MATCHES } from "@/data/matches";
import type { Match } from "./types";

/**
 * The match files spell some teams differently ("FC Barcelona" / "Barcelona",
 * "France" / "Fransa"). Map every spelling to one canonical (Turkish) name.
 */
const ALIASES: Record<string, string> = {
  "FC Barcelona": "Barcelona",
  "Bayern Munich": "Bayern Münih",
  "Liverpool FC": "Liverpool",
  "Chelsea FC": "Chelsea",
  "Arsenal FC": "Arsenal",
  "Tottenham Hotspur": "Tottenham",
  "Atlético de Madrid": "Atlético Madrid",
  "Sevilla FC": "Sevilla",
  "Inter Milan": "Inter",
  "Juventus FC": "Juventus",
  "AS Roma": "Roma",
  "SSC Napoli": "Napoli",
  "Villarreal CF": "Villarreal",
  "Valencia CF": "Valencia",
  "RCD Espanyol Barcelona": "Espanyol",
  "SL Benfica": "Benfica",
  "FC Porto": "Porto",
  "AS Monaco": "Monaco",
  PSG: "Paris Saint-Germain",
  "Ajax Amsterdam": "Ajax",
  "SV Werder Bremen": "Werder Bremen",
  "FC Schalke 04": "Schalke 04",
  "Bayer 04 Leverkusen": "Bayer Leverkusen",
  "İstanbul Başakşehir": "Başakşehir",
  "Middlesbrough FC": "Middlesbrough",
  "Fulham FC": "Fulham",
  "ACF Fiorentina": "Fiorentina",
  "Atalanta BC": "Atalanta",
  "FC Girondins Bordeaux": "Bordeaux",
  "Dnipro Dnipropetrovsk (- 2020)": "Dnipro",
  // National teams (English spellings → Turkish)
  France: "Fransa",
  Netherlands: "Hollanda",
  Germany: "Almanya",
  Italy: "İtalya",
  England: "İngiltere",
  Spain: "İspanya",
  Argentina: "Arjantin",
  Croatia: "Hırvatistan",
  Brazil: "Brezilya",
  Belgium: "Belçika",
  Russia: "Rusya",
  Morocco: "Fas",
};

/** Canonical national-team names with their English display names. */
const NATIONAL_EN: Record<string, string> = {
  Türkiye: "Turkey",
  Fransa: "France",
  Hollanda: "Netherlands",
  Almanya: "Germany",
  "Batı Almanya": "West Germany",
  İtalya: "Italy",
  İngiltere: "England",
  İspanya: "Spain",
  Arjantin: "Argentina",
  Hırvatistan: "Croatia",
  Brezilya: "Brazil",
  Belçika: "Belgium",
  Rusya: "Russia",
  Fas: "Morocco",
  Uruguay: "Uruguay",
  Portekiz: "Portugal",
  Yunanistan: "Greece",
};

/** English display names for clubs whose canonical name is Turkish. */
const CLUB_EN: Record<string, string> = { "Bayern Münih": "Bayern Munich" };

export const canonicalTeam = (name: string) => ALIASES[name] ?? name;

export interface Team {
  name: string;
  en: string;
  national: boolean;
  matches: Match[];
  /** Kit of the team's most recent match, for a colour swatch */
  kit: Match["kit"];
}

const year = (m: Match) => Number(m.date.slice(-4));

/** Teams with at least `min` matches where their XI is the one to guess, most matches first. */
export function teamsWithMatches(min = 3): Team[] {
  const byName = new Map<string, Match[]>();
  for (const m of MATCHES) {
    const name = canonicalTeam(m.team);
    byName.set(name, [...(byName.get(name) ?? []), m]);
  }
  return [...byName.entries()]
    .filter(([, ms]) => ms.length >= min)
    .map(([name, ms]) => {
      const latest = ms.reduce((a, b) => (year(b) > year(a) ? b : a));
      const national = name in NATIONAL_EN;
      return { name, en: NATIONAL_EN[name] ?? CLUB_EN[name] ?? name, national, matches: ms, kit: latest.kit };
    })
    .sort((a, b) => b.matches.length - a.matches.length || a.name.localeCompare(b.name, "tr"));
}

/** Matches where the given (canonical) team's XI is guessed. */
export function matchesOfTeam(name: string): Match[] {
  return MATCHES.filter((m) => canonicalTeam(m.team) === name);
}
