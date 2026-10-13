#!/usr/bin/env node
/**
 * Tiki Taka Toe — "played with" criteria (after tiki-scrape-seasons.mjs).
 *
 * For each anchor star below, every player in src/data/players.ts who shared a
 * squad with them at one of the criteria clubs in the same season. Only club
 * football (the scraped clubs), not national teams. Anchors with too few
 * teammates in the pool are dropped.
 *
 * Usage: node scripts/tiki-build-teammates.mjs  → writes src/data/teammates.ts
 */
import { readFileSync, writeFileSync } from "node:fs";

import { PLAYERS } from "../src/data/players.ts";

const MIN_MATES = 25;
// id (stable: online grids send it), Transfermarkt name, name on the board
// id (stable: online grids send it), Transfermarkt name, name on the board,
// "g" world-class (dealt in the all-clubs grids) or "l" local (only in league grids of their clubs)
const ANCHORS = [
  ["messi", "Lionel Messi", "Messi", "g"],
  ["cr7", "Cristiano Ronaldo", "Cristiano Ronaldo", "g"],
  ["zlatan", "Zlatan Ibrahimović", "Zlatan", "g"],
  ["neymar", "Neymar", "Neymar", "g"],
  ["mbappe", "Kylian Mbappé", "Mbappé", "g"],
  ["modric", "Luka Modrić", "Modrić", "g"],
  ["ramos", "Sergio Ramos", "Sergio Ramos", "g"],
  ["benzema", "Karim Benzema", "Benzema", "g"],
  ["lewandowski", "Robert Lewandowski", "Lewandowski", "g"],
  ["buffon", "Gianluigi Buffon", "Buffon", "g"],
  ["pirlo", "Andrea Pirlo", "Pirlo", "g"],
  ["totti", "Francesco Totti", "Totti", "g"],
  ["maldini", "Paolo Maldini", "Maldini", "g"],
  ["rooney", "Wayne Rooney", "Rooney", "g"],
  ["gerrard", "Steven Gerrard", "Gerrard", "g"],
  ["lampard", "Frank Lampard", "Lampard", "g"],
  ["henry", "Thierry Henry", "Henry", "g"],
  ["kaka", "Kaká", "Kaká", "g"],
  ["xavi", "Xavi", "Xavi", "g"],
  ["iniesta", "Andrés Iniesta", "Iniesta", "g"],
  ["casillas", "Iker Casillas", "Casillas", "g"],
  ["ozil", "Mesut Özil", "Özil", "g"],
  ["sneijder", "Wesley Sneijder", "Sneijder", "g"],
  ["drogba", "Didier Drogba", "Drogba", "g"],
  ["salah", "Mohamed Salah", "Salah", "g"],
  ["debruyne", "Kevin De Bruyne", "De Bruyne", "g"],
  ["haaland", "Erling Haaland", "Haaland", "g"],
  ["beckham", "David Beckham", "Beckham", "g"],
  ["delpiero", "Alessandro Del Piero", "Del Piero", "g"],
  ["zidane", "Zinédine Zidane", "Zidane", "g"],
  ["figo", "Luís Figo", "Figo", "g"],
  ["dimaria", "Ángel Di María", "Di María", "g"],
  ["suarez", "Luis Suárez", "Suárez", "g"],
  ["griezmann", "Antoine Griezmann", "Griezmann", "g"],
  ["kane", "Harry Kane", "Kane", "g"],
  ["shevchenko", "Andriy Shevchenko", "Shevchenko", "g"],
  ["zanetti", "Javier Zanetti", "Zanetti", "g"],
  ["giggs", "Ryan Giggs", "Giggs", "g"],
  ["torres", "Fernando Torres", "Fernando Torres", "g"],
  ["kahn", "Oliver Kahn", "Kahn", "g"],
  ["ballack", "Michael Ballack", "Ballack", "g"],
  ["falcao", "Radamel Falcao", "Falcao", "l"],
  ["hagi", "Gheorghe Hagi", "Hagi", "l"],
  ["arda", "Arda Turan", "Arda Turan", "l"],
  ["hakan", "Hakan Şükür", "Hakan Şükür", "l"],
  ["quaresma", "Ricardo Quaresma", "Quaresma", "l"],
  ["icardi", "Mauro Icardi", "Icardi", "l"],
  ["dzeko", "Edin Džeko", "Džeko", "l"],
  ["emre", "Emre Belözoğlu", "Emre Belözoğlu", "l"],
  ["volkan", "Volkan Demirel", "Volkan Demirel", "l"],
  ["sergen", "Sergen Yalçın", "Sergen Yalçın", "l"],
  ["burak", "Burak Yılmaz", "Burak Yılmaz", "l"],
  ["muslera", "Fernando Muslera", "Muslera", "l"],
  ["tanju", "Tanju Çolak", "Tanju Çolak", "l"],
  ["scholes", "Paul Scholes", "Scholes", "l"],
  ["terry", "John Terry", "Terry", "l"],
  ["villa", "David Villa", "David Villa", "l"],
  ["batistuta", "Gabriel Batistuta", "Batistuta", "l"],
  ["reus", "Marco Reus", "Reus", "l"],
  ["ruicosta", "Rui Costa", "Rui Costa", "l"],
  ["nunogomes", "Nuno Gomes", "Nuno Gomes", "l"],
  ["deco", "Deco", "Deco", "l"],
];

const norm = (s) => s.toUpperCase().replaceAll("İ","I").replaceAll("Ş","S").replaceAll("Ğ","G").replaceAll("Ü","U").replaceAll("Ö","O").replaceAll("Ç","C").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^A-Z]/g,"");
const decode = (s) => s.replace(/&amp;/g,"&").replace(/&#0?39;/g,"'").replace(/&quot;/g,'"').trim();

const { names, squads } = JSON.parse(readFileSync("scripts/.cache/raw-seasons.json", "utf8"));
const poolByNorm = new Map(PLAYERS.map((p) => [norm(p.name), p.name]));

// Transfermarkt id → the squads (club_season) they were in
const squadsOf = new Map();
for (const [key, ids] of Object.entries(squads)) for (const id of ids) (squadsOf.get(id) ?? squadsOf.set(id, []).get(id)).push(key);

const out = [];
for (const [id, tmName, label, scope] of ANCHORS) {
  // same name can belong to several people: take the one with the most squads
  const want = norm(tmName);
  const tmIds = Object.keys(names).filter((k) => norm(decode(names[k])) === want);
  const tmId = tmIds.sort((a, b) => (squadsOf.get(b)?.length ?? 0) - (squadsOf.get(a)?.length ?? 0))[0];
  if (!tmId) { console.error(`skip ${id}: not in the scraped squads`); continue; }
  const self = poolByNorm.get(want);
  const mates = new Set();
  for (const key of squadsOf.get(tmId) ?? []) for (const other of squads[key]) {
    if (other === tmId) continue;
    const name = poolByNorm.get(norm(decode(names[other])));
    if (name && name !== self) mates.add(name);
  }
  if (mates.size < MIN_MATES) { console.error(`skip ${id}: ${mates.size} teammates`); continue; }
  const clubs = [...new Set((squadsOf.get(tmId) ?? []).map((k) => k.slice(0, k.lastIndexOf("_"))))].sort();
  out.push({ id, name: label, global: scope === "g", clubs, mates: [...mates].sort() });
  console.error(`${id}: ${mates.size} teammates (${(squadsOf.get(tmId) ?? []).length} squads)`);
}

const body = `/**
 * "Played with" criteria for Tiki Taka Toe: each star's club teammates (same
 * squad, same season, at one of the criteria clubs) among the players in
 * players.ts. Generated by scripts/tiki-build-teammates.mjs from Transfermarkt
 * squads — do not edit by hand. Ids are stable: online grids send them.
 */
export interface Teammates {
  id: string;
  /** shown on the board: "Played with {name}" */
  name: string;
  /** dealt in the all-clubs grids; otherwise only in league grids of \`clubs\` */
  global: boolean;
  /** criteria clubs the star played for */
  clubs: string[];
  /** players.ts names */
  mates: string[];
}

export const TEAMMATES: Teammates[] = ${JSON.stringify(out)};
`;
writeFileSync("src/data/teammates.ts", body);
console.error(`${out.length} anchors → src/data/teammates.ts`);
