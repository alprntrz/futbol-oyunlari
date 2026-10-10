import { MATCHES } from "@/data/matches";
import { ALL_CRITERIA } from "@/lib/tiki";
import type { Match } from "@/lib/types";

import { CLUB_KITS, type Kit } from "~/components/HatTrickBoard";

import type { JerseyStyle } from "./brand";

const rgb = (hex: string) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
};
const dist = (a: string, b: string) => {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
};
const luminance = (hex: string) => {
  const [r, g, b] = rgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

/** Collar style: classic polo for pre-2000 matches, otherwise V-neck or crew per team. */
export function jerseyStyle(match: Match): JerseyStyle {
  if (Number(match.date.slice(-4)) < 2000) return "polo";
  let h = 0;
  for (const ch of match.team) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 2 ? "crew" : "vneck";
}

// The data has no goalkeeper kits; pick a colour that stands out from both
// the outfield shirt and the pitch.
const KEEPER_COLOURS = ["#F59E0B", "#0EA5E9", "#111827", "#A855F7", "#F472B6"];
const PITCH = "#3BA55C";

export function keeperKit(kit: Match["kit"]) {
  const body = KEEPER_COLOURS.reduce((best, c) =>
    Math.min(dist(c, kit.body), dist(c, PITCH)) > Math.min(dist(best, kit.body), dist(best, PITCH)) ? c : best
  );
  return { body, sleeves: body, number: luminance(body) > 0.6 ? "#0B1220" : "#FFFFFF" };
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/\b(fc|cf|sv|cp|ac|ssc|as|ca|fk|vfl|1893|club|calcio)\b/g, "")
    .replace(/[^a-z0-9]/g, "");

const plain = (body: string, sleeves = body): Kit => ({ body, sleeves });

/** Home kits for opponents that never appear as the guessed side, nor among the grid clubs. */
const EXTRA: Record<string, Kit> = {
  // national teams (Turkish and English names)
  cekya: plain("#D7141A"), czechia: plain("#D7141A"), czechrepublic: plain("#D7141A"),
  ingiltere: plain("#FFFFFF"), england: plain("#FFFFFF"),
  kolombiya: plain("#FCD116"), colombia: plain("#FCD116"),
  guneykore: plain("#CD2E3A"), southkorea: plain("#CD2E3A"),
  ukrayna: plain("#FFD500"), ukraine: plain("#FFD500"),
  portekiz: plain("#C8102E", "#046A38"), portugal: plain("#C8102E", "#046A38"),
  gana: plain("#FFFFFF"), ghana: plain("#FFFFFF"),
  paraguay: { body: "#D52B1E", sleeves: "#FFFFFF", pattern: { color: "#FFFFFF", bands: 5 } },
  kostarika: plain("#CE1126"), costarica: plain("#CE1126"),
  isvec: plain("#FECC00", "#006AA7"), sweden: plain("#FECC00", "#006AA7"),
  gurcistan: plain("#FFFFFF"), georgia: plain("#FFFFFF"),
  avusturya: plain("#ED2939"), austria: plain("#ED2939"),
  hollanda: plain("#F36C21"), netherlands: plain("#F36C21"),
  hirvatistan: { body: "#FFFFFF", sleeves: "#FFFFFF", pattern: { color: "#E1251B", bands: 5 } },
  croatia: { body: "#FFFFFF", sleeves: "#FFFFFF", pattern: { color: "#E1251B", bands: 5 } },
  japonya: plain("#1D2D5C"), japan: plain("#1D2D5C"),
  senegal: plain("#FFFFFF", "#00853F"),
  cin: plain("#DE2910"), china: plain("#DE2910"),
  belcika: plain("#E30613"), belgium: plain("#E30613"),
  // clubs
  riverplate: { body: "#FFFFFF", sleeves: "#FFFFFF", pattern: { color: "#E2001A", bands: 3 } },
  braga: plain("#D6001C", "#FFFFFF"),
  parma: { body: "#FFFFFF", sleeves: "#FFFFFF", pattern: { color: "#FFD700", bands: 3 } },
  steauabucharest: plain("#E30613", "#0033A0"),
  psveindhoven: { body: "#ED1C24", sleeves: "#ED1C24", pattern: { color: "#FFFFFF", bands: 7 } },
  osasuna: plain("#D2122E", "#0A1D56"),
  rangers: plain("#1B458F"),
  hamburger: plain("#FFFFFF", "#E30613"),
  dynamokyiv: plain("#FFFFFF", "#005BAC"),
  olympiquemarseille: plain("#FFFFFF", "#2FAEE0"),
  apoelnicosia: { body: "#FFD200", sleeves: "#005EB8", pattern: { color: "#005EB8", bands: 5 } },
  malaga: { body: "#FFFFFF", sleeves: "#0072CE", pattern: { color: "#0072CE", bands: 7 } },
  basel: { body: "#D2001F", sleeves: "#004B9E", pattern: { color: "#004B9E", bands: 2 } },
  wolfsburg: plain("#65B32E", "#FFFFFF"),
  celtadevigo: plain("#8AC3EE"),
  eintrachtfrankfurt: plain("#E1000F", "#111111"),
  bodoglimt: plain("#FFE500"),
  kayserierciyesspor: plain("#FFD100", "#E30613"),
  kayserispor: { body: "#FFD100", sleeves: "#E30613", pattern: { color: "#E30613", bands: 7 } },
  bursaspor: { body: "#00953B", sleeves: "#00953B", pattern: { color: "#FFFFFF", bands: 7 } },
  eskisehirspor: plain("#E30613", "#111111"),
  konyaspor: { body: "#00843D", sleeves: "#00843D", pattern: { color: "#FFFFFF", bands: 2, horizontal: true } },
  alanyaspor: plain("#F58220", "#00843D"),
  antalyaspor: { body: "#E30613", sleeves: "#E30613", pattern: { color: "#FFFFFF", bands: 7 } },
};

let lookup: Map<string, Kit> | null = null;

/** A team's home kit by name, for the opponent in a match header (grey shirt if unknown). */
export function teamKit(name: string): Kit {
  if (!lookup) {
    // later sources win: grid-club kits carry stripes and halves, so they beat plain match colours
    lookup = new Map();
    for (const m of MATCHES) lookup.set(norm(m.team), { body: m.kit.body, sleeves: m.kit.sleeves });
    for (const c of ALL_CRITERIA) if (c.kind === "club" && CLUB_KITS[c.id]) for (const n of [c.tr, c.en]) lookup.set(norm(n), CLUB_KITS[c.id]);
    for (const [k, v] of Object.entries(EXTRA)) lookup.set(k, v);
  }
  return lookup.get(norm(name)) ?? plain("#D4DAD6");
}
