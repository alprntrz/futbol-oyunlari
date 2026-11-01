#!/usr/bin/env node
/**
 * Tiki Taka Toe — club-season squads for the "played with" criteria.
 *
 * Same Transfermarkt pages as tiki-scrape-squads.mjs, but keeps who was in each
 * squad each season (Transfermarkt player ids), so teammates can be worked out:
 *   { names: { tmId: name }, squads: { "club_season": [tmId, …] }, done: [...] }
 * Output (resumable) → scripts/.cache/raw-seasons.json
 *
 * Usage:
 *   node scripts/tiki-scrape-seasons.mjs            # default 1950..2026
 *   FROM=2000 TO=2026 node scripts/tiki-scrape-seasons.mjs
 *
 * Then run: node scripts/tiki-build-teammates.mjs  → writes src/data/teammates.ts
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const CACHE_DIR = "scripts/.cache";
const OUT = `${CACHE_DIR}/raw-seasons.json`;
const FROM = Number(process.env.FROM || 1950);
const TO = Number(process.env.TO || 2026);
const TM_GAP_MS = 2200; // keep ≥ 2.2 s between Transfermarkt requests

const H = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36", "Accept-Language": "en-US,en;q=0.9" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(u) { for (let i = 0; i < 4; i++) { try { const r = await fetch(u, { headers: H }); if (r.status === 429) { await sleep(20000); continue; } if (r.ok) return r.text(); } catch {} await sleep(6000); } return null; }

// club id (matches src/lib/tiki.ts CLUBS) → Transfermarkt club id; same list as tiki-scrape-squads.mjs
const CLUBS = {
  realmadrid: 418, barcelona: 131, atletico: 13, sevilla: 368, valencia: 1049, villarreal: 1050,
  bayern: 27, dortmund: 16, schalke: 33, leverkusen: 15,
  manutd: 985, mancity: 281, liverpool: 31, chelsea: 631, arsenal: 11, tottenham: 148,
  juventus: 506, milan: 5, inter: 46, napoli: 6195, roma: 12,
  psg: 583, monaco: 162, ajax: 610, psv: 383, porto: 720, benfica: 294, sporting: 336,
  galatasaray: 141, fenerbahce: 36, besiktas: 114,
};

function parse(html) {
  const players = [];
  const re = /<td class="hauptlink">\s*<a href="\/[^"]*\/profil\/spieler\/(\d+)"[^>]*>\s*([^<]+?)\s*<\/a>/g;
  let m;
  while ((m = re.exec(html))) players.push({ id: m[1], name: m[2] });
  return players;
}

if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
const state = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : { names: {}, squads: {}, done: [] };
const done = new Set(state.done);

const jobs = [];
for (const [club, id] of Object.entries(CLUBS)) for (let s = FROM; s <= TO; s++) jobs.push({ club, id, s });

let n = 0;
for (const j of jobs) {
  n++;
  const key = `${j.club}_${j.s}`;
  if (done.has(key)) continue;
  const html = await get(`https://www.transfermarkt.us/x/kader/verein/${j.id}/saison_id/${j.s}/plus/1`);
  await sleep(TM_GAP_MS);
  if (html) {
    const squad = parse(html);
    if (squad.length) state.squads[key] = squad.map((p) => p.id);
    for (const p of squad) state.names[p.id] = p.name;
    done.add(key);
  }
  if (n % 15 === 0) { state.done = [...done]; writeFileSync(OUT, JSON.stringify(state)); console.error(`${n}/${jobs.length} club-seasons`); }
}
state.done = [...done];
writeFileSync(OUT, JSON.stringify(state));
console.error(`DONE. ${Object.keys(state.squads).length} squads → ${OUT}`);
