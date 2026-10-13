#!/usr/bin/env node
/**
 * Taktik Tahtası — player positions (GK / DEF / MID / FWD) from the same
 * Transfermarkt squad pages as tiki-scrape-seasons.mjs (one page per club and
 * season). Keeps, per Transfermarkt player id, the position text of each season
 * the player was listed. Output (resumable) → scripts/.cache/raw-positions.json:
 *   { names: { tmId: name }, pos: { tmId: { "Goalkeeper": 3, ... } }, done: [...] }
 *
 * Usage: node scripts/taktik-scrape-positions.mjs   (FROM / TO env like the others)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const CACHE_DIR = "scripts/.cache";
const OUT = `${CACHE_DIR}/raw-positions.json`;
const FROM = Number(process.env.FROM || 1950);
const TO = Number(process.env.TO || 2026);
const TM_GAP_MS = 2200; // keep ≥ 2.2 s between Transfermarkt requests

const H = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36", "Accept-Language": "en-US,en;q=0.9" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(u) { for (let i = 0; i < 4; i++) { try { const r = await fetch(u, { headers: H }); if (r.status === 429) { await sleep(20000); continue; } if (r.ok) return r.text(); } catch {} await sleep(6000); } return null; }

// same club list as tiki-scrape-squads.mjs
const CLUBS = {
  realmadrid: 418, barcelona: 131, atletico: 13, sevilla: 368, valencia: 1049, villarreal: 1050,
  bayern: 27, dortmund: 16, schalke: 33, leverkusen: 15,
  manutd: 985, mancity: 281, liverpool: 31, chelsea: 631, arsenal: 11, tottenham: 148,
  juventus: 506, milan: 5, inter: 46, napoli: 6195, roma: 12,
  psg: 583, monaco: 162, ajax: 610, psv: 383, porto: 720, benfica: 294, sporting: 336,
  galatasaray: 141, fenerbahce: 36, besiktas: 114,
};

/** name link, then the position cell right under it */
function parse(html) {
  const out = [];
  const re = /<td class="hauptlink">\s*<a href="\/[^"]*\/profil\/spieler\/(\d+)"[^>]*>\s*([^<]+?)\s*<\/a>\s*<\/td>\s*<\/tr>\s*<tr>\s*<td>\s*([^<]+?)\s*<\/td>/g;
  let m;
  while ((m = re.exec(html))) out.push({ id: m[1], name: m[2], pos: m[3] });
  return out;
}

if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
const state = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : { names: {}, pos: {}, done: [] };
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
    for (const p of parse(html)) {
      state.names[p.id] = p.name;
      const counts = (state.pos[p.id] ??= {});
      counts[p.pos] = (counts[p.pos] ?? 0) + 1;
    }
    done.add(key);
  }
  if (n % 15 === 0) { state.done = [...done]; writeFileSync(OUT, JSON.stringify(state)); console.error(`${n}/${jobs.length} club-seasons`); }
}
state.done = [...done];
writeFileSync(OUT, JSON.stringify(state));
console.error(`DONE. ${Object.keys(state.pos).length} players → ${OUT}`);
