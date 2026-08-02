#!/usr/bin/env node
/**
 * Tiki Taka Toe — build the player pool (step 1/2).
 *
 * Scrapes the senior squads of every criteria club (see CLUBS below) for each
 * season in the range, from Transfermarkt, and aggregates per player:
 *   { name, nat, clubs: [criteria-club ids they appeared for] }
 * Output (resumable) → scripts/.cache/raw-squads.json
 *
 * Usage:
 *   node scripts/tiki-scrape-squads.mjs            # default 1950..2025
 *   FROM=2000 TO=2025 node scripts/tiki-scrape-squads.mjs
 *
 * Then run: node scripts/tiki-build-players.mjs  → writes src/data/players.ts
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const CACHE_DIR = "scripts/.cache";
const OUT = `${CACHE_DIR}/raw-squads.json`;
const FROM = Number(process.env.FROM || 1950);
const TO = Number(process.env.TO || 2025);

const H = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36", "Accept-Language": "en-US,en;q=0.9" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(u) { for (let i = 0; i < 4; i++) { try { const r = await fetch(u, { headers: H }); if (r.status === 429) { await sleep(20000); continue; } if (r.ok) return r.text(); } catch {} await sleep(6000); } return null; }

// club id (matches src/lib/tiki.ts CLUBS) → Transfermarkt club id
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
  while ((m = re.exec(html))) {
    const after = html.slice(m.index + 10, m.index + 1800);
    const flag = after.match(/title="([^"]+)"[^>]*class="flaggenrahmen|class="flaggenrahmen[^"]*"[^>]*title="([^"]+)"/);
    players.push({ id: m[1], name: m[2], nat: flag ? (flag[1] || flag[2]) : null });
  }
  return players;
}

if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
const state = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : { byId: {}, done: [] };
const done = new Set(state.done);
const byId = state.byId;

const jobs = [];
for (const [club, id] of Object.entries(CLUBS)) for (let s = FROM; s <= TO; s++) jobs.push({ club, id, s });

let n = 0;
for (const j of jobs) {
  n++;
  const key = `${j.id}_${j.s}`;
  if (done.has(key)) continue;
  const html = await get(`https://www.transfermarkt.us/x/kader/verein/${j.id}/saison_id/${j.s}/plus/1`);
  await sleep(1300);
  if (html) {
    for (const p of parse(html)) {
      const rec = byId[p.id] || (byId[p.id] = { name: p.name, nat: p.nat, clubs: [] });
      if (p.nat && !rec.nat) rec.nat = p.nat;
      if (!rec.clubs.includes(j.club)) rec.clubs.push(j.club);
      rec.name = p.name;
    }
  }
  done.add(key);
  if (n % 15 === 0) { state.done = [...done]; writeFileSync(OUT, JSON.stringify(state)); console.error(`${n}/${jobs.length} club-seasons (players: ${Object.keys(byId).length})`); }
}
state.done = [...done];
writeFileSync(OUT, JSON.stringify(state));
console.error(`DONE. ${Object.keys(byId).length} unique players → ${OUT}`);
