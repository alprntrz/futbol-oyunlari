#!/usr/bin/env node
/**
 * Tiki Taka Toe — head coaches per criteria club (for the "managed by" criteria).
 *
 * One Transfermarkt page per club: its manager history (name + appointed/left
 * dates). Raw pages are cached in scripts/.cache/tm-coaches/ so the parser can be
 * re-run without fetching again; parsed result → scripts/.cache/raw-coaches.json:
 *   { club: [{ tmId, name, from: "YYYY-MM-DD", to: "YYYY-MM-DD" | null }] }
 *
 * Usage: node scripts/tiki-scrape-coaches.mjs
 * Then:  node scripts/tiki-build-coaches.mjs  → writes src/data/coaches.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const DIR = "scripts/.cache/tm-coaches";
const OUT = "scripts/.cache/raw-coaches.json";
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

const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
/** "Jul 1, 2008" / "01/07/2008" / "2008-07-01" → "2008-07-01" */
function isoDate(s) {
  if (!s) return null;
  let m = /([A-Z][a-z]{2}) (\d{1,2}), (\d{4})/.exec(s);
  if (m && MONTHS[m[1]]) return `${m[3]}-${String(MONTHS[m[1]]).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  m = /(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? m[0] : null;
}

/** Each table row: the coach's profile link, then appointed and end dates. */
function parse(html) {
  const out = [];
  const rows = html.split(/<tr class="(?:odd|even)">/).slice(1);
  for (const row of rows) {
    const link = /href="\/[^"]*\/profil\/trainer\/(\d+)"[^>]*>([^<]+)</.exec(row);
    if (!link) continue;
    const cells = [...row.matchAll(/<td class="zentriert[^"]*">([\s\S]*?)<\/td>/g)].map((c) => c[1].replace(/<[^>]+>/g, " ").trim());
    const dates = cells.map(isoDate).filter(Boolean);
    if (!dates.length) continue;
    out.push({ tmId: link[1], name: link[2].trim(), from: dates[0], to: dates[1] ?? null });
  }
  return out;
}

mkdirSync(DIR, { recursive: true });
const result = {};
for (const [club, id] of Object.entries(CLUBS)) {
  const file = `${DIR}/${club}.html`;
  if (!existsSync(file)) {
    const html = await get(`https://www.transfermarkt.us/x/mitarbeiterhistorie/verein/${id}/personalie_id/1`);
    await sleep(TM_GAP_MS);
    if (!html) {
      console.error(`${club}: no page`);
      continue;
    }
    writeFileSync(file, html);
  }
  result[club] = parse(readFileSync(file, "utf8"));
  console.error(`${club}: ${result[club].length} coaches`);
}
writeFileSync(OUT, JSON.stringify(result));
console.error(`→ ${OUT}`);
