#!/usr/bin/env node
/**
 * Tiki Taka Toe — "managed by" criteria (after tiki-scrape-seasons.mjs and
 * tiki-scrape-coaches.mjs).
 *
 * For each anchor coach below: every player in src/data/players.ts who was in a
 * criteria club's squad in a season the coach was in charge there (at least
 * MIN_DAYS of the season). Club football only. Anchors with too few players in
 * the pool are dropped.
 *
 * Usage: node scripts/tiki-build-coaches.mjs  → writes src/data/coaches.ts
 */
import { readFileSync, writeFileSync } from "node:fs";

import { PLAYERS } from "../src/data/players.ts";

const MIN_PLAYERS = 25;
const MIN_DAYS = 60;
// id (stable: online grids send it), Transfermarkt name, name on the board
// id (stable), Transfermarkt name, name on the board, "g" world-class / "l" local (league grids only)
const ANCHORS = [
  ["guardiola", "Pep Guardiola", "Guardiola", "g"],
  ["mourinho", "José Mourinho", "Mourinho", "g"],
  ["ancelotti", "Carlo Ancelotti", "Ancelotti", "g"],
  ["klopp", "Jürgen Klopp", "Klopp", "g"],
  ["ferguson", "Sir Alex Ferguson", "Ferguson", "g"],
  ["wenger", "Arsène Wenger", "Wenger", "g"],
  ["zidane", "Zinédine Zidane", "Zidane", "g"],
  ["simeone", "Diego Simeone", "Simeone", "g"],
  ["conte", "Antonio Conte", "Conte", "g"],
  ["heynckes", "Jupp Heynckes", "Heynckes", "g"],
  ["vangaal", "Louis van Gaal", "Van Gaal", "g"],
  ["rijkaard", "Frank Rijkaard", "Rijkaard", "g"],
  ["luisenrique", "Luis Enrique", "Luis Enrique", "g"],
  ["tuchel", "Thomas Tuchel", "Tuchel", "g"],
  ["flick", "Hansi Flick", "Flick", "g"],
  ["capello", "Fabio Capello", "Capello", "g"],
  ["lippi", "Marcello Lippi", "Lippi", "g"],
  ["benitez", "Rafael Benítez", "Benítez", "g"],
  ["hiddink", "Guus Hiddink", "Hiddink", "g"],
  ["mancini", "Roberto Mancini", "Mancini", "g"],
  ["allegri", "Massimiliano Allegri", "Allegri", "g"],
  ["pochettino", "Mauricio Pochettino", "Pochettino", "g"],
  ["arteta", "Mikel Arteta", "Arteta", "g"],
  ["tenhag", "Erik ten Hag", "Ten Hag", "g"],
  ["xabialonso", "Xabi Alonso", "Xabi Alonso", "g"],
  ["ranieri", "Claudio Ranieri", "Ranieri", "g"],
  ["sacchi", "Arrigo Sacchi", "Sacchi", "g"],
  ["cruyff", "Johan Cruyff", "Cruyff", "g"],
  ["delbosque", "Vicente del Bosque", "Del Bosque", "g"],
  ["emery", "Unai Emery", "Emery", "g"],
  ["sarri", "Maurizio Sarri", "Sarri", "g"],
  ["slot", "Arne Slot", "Slot", "g"],
  ["pellegrini", "Manuel Pellegrini", "Pellegrini", "g"],
  ["koeman", "Ronald Koeman", "Koeman", "g"],
  ["villasboas", "André Villas-Boas", "Villas-Boas", "g"],
  ["hitzfeld", "Ottmar Hitzfeld", "Hitzfeld", "g"],
  ["spalletti", "Luciano Spalletti", "Spalletti", "g"],
  ["inzaghi", "Simone Inzaghi", "Simone Inzaghi", "l"],
  ["magath", "Felix Magath", "Magath", "l"],
  ["valverde", "Ernesto Valverde", "Valverde", "l"],
  ["terim", "Fatih Terim", "Fatih Terim", "l"],
  ["lucescu", "Mircea Lucescu", "Lucescu", "l"],
  ["denizli", "Mustafa Denizli", "Mustafa Denizli", "l"],
  ["okanburuk", "Okan Buruk", "Okan Buruk", "l"],
  ["gunes", "Şenol Güneş", "Şenol Güneş", "l"],
  ["aykut", "Aykut Kocaman", "Aykut Kocaman", "l"],
  ["daum", "Christoph Daum", "Daum", "l"],
  ["yanal", "Ersun Yanal", "Ersun Yanal", "l"],
  ["avci", "Abdullah Avcı", "Abdullah Avcı", "l"],
  ["sergen", "Sergen Yalçın", "Sergen Yalçın", "l"],
  ["jorgejesus", "Jorge Jesus", "Jorge Jesus", "l"],
  ["conceicao", "Sérgio Conceição", "Sérgio Conceição", "l"],
  ["amorim", "Rúben Amorim", "Amorim", "l"],
];

const norm = (s) => s.toUpperCase().replaceAll("İ","I").replaceAll("Ş","S").replaceAll("Ğ","G").replaceAll("Ü","U").replaceAll("Ö","O").replaceAll("Ç","C").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^A-Z]/g,"");
const decode = (s) => s.replace(/&amp;/g,"&").replace(/&#0?39;/g,"'").replace(/&quot;/g,'"').trim();
const day = (iso) => Date.parse(iso + "T00:00:00Z") / 86400000;

const coaches = JSON.parse(readFileSync("scripts/.cache/raw-coaches.json", "utf8"));
const { names, squads } = JSON.parse(readFileSync("scripts/.cache/raw-seasons.json", "utf8"));
const poolByNorm = new Map(PLAYERS.map((p) => [norm(p.name), p.name]));
const today = new Date().toISOString().slice(0, 10);

const out = [];
for (const [id, tmName, label, scope] of ANCHORS) {
  const want = norm(tmName.replace(/^Sir /, ""));
  const players = new Set();
  const clubsSeen = new Set();
  let spells = 0;
  for (const [club, list] of Object.entries(coaches)) {
    for (const c of list) {
      if (norm(decode(c.name).replace(/^Sir /, "")) !== want) continue;
      spells++;
      clubsSeen.add(club);
      const from = day(c.from);
      const to = day(c.to ?? today);
      for (let s = Number(c.from.slice(0, 4)) - 1; s <= Number((c.to ?? today).slice(0, 4)); s++) {
        // season s runs from 1 July s to 30 June s+1
        const overlap = Math.min(to, day(`${s + 1}-06-30`)) - Math.max(from, day(`${s}-07-01`));
        if (overlap < MIN_DAYS) continue;
        for (const pid of squads[`${club}_${s}`] ?? []) {
          const name = poolByNorm.get(norm(decode(names[pid] ?? "")));
          if (name) players.add(name);
        }
      }
    }
  }
  if (players.size < MIN_PLAYERS) { console.error(`skip ${id}: ${players.size} players (${spells} spells)`); continue; }
  out.push({ id, name: label, global: scope === "g", clubs: [...clubsSeen].sort(), players: [...players].sort() });
  console.error(`${id}: ${players.size} players (${spells} spells)`);
}

const body = `/**
 * "Managed by" criteria for Tiki Taka Toe: players each coach had in a criteria
 * club's squad (a season they were in charge there), among the players in
 * players.ts. Generated by scripts/tiki-build-coaches.mjs from Transfermarkt
 * squads and manager histories — do not edit by hand. Ids are stable: online grids send them.
 */
export interface CoachedBy {
  id: string;
  /** shown on the board: "Managed by {name}" */
  name: string;
  /** dealt in the all-clubs grids; otherwise only in league grids of \`clubs\` */
  global: boolean;
  /** criteria clubs the coach managed */
  clubs: string[];
  /** players.ts names */
  players: string[];
}

export const COACHES: CoachedBy[] = ${JSON.stringify(out)};
`;
writeFileSync("src/data/coaches.ts", body);
console.error(`${out.length} coaches → src/data/coaches.ts`);
