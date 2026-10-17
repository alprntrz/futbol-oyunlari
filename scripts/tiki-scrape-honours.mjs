#!/usr/bin/env node
/**
 * Tic-Tac-Toe honours with counts (step 1/2): each well-known player's Transfermarkt
 * achievements page ("erfolge"): how many Champions League / league titles, and the
 * competitions they were top scorer in. Resumable, one request per player, ≥ 2.2 s
 * apart, pages cached in scripts/.cache/tm-erfolge/. Output → scripts/.cache/raw-honours.json:
 *   { tmId: { titles: { "UEFA Champions League winner": 4, … }, top: ["UEFA Champions League", …] } }
 * Then: node --import ./scripts/lib/alias.mjs scripts/tiki-build-honours.mjs
 *
 * Usage: node --import ./scripts/lib/alias.mjs scripts/tiki-scrape-honours.mjs [limit]
 *   limit = how many of the best-known players (PLAYERS order: honours, then clubs) to fetch (default 3500)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { PLAYERS } from "@/data/players";

const OUT = "scripts/.cache/raw-honours.json";
const PAGES = "scripts/.cache/tm-erfolge";
const TM_GAP_MS = 2300; // keep ≥ 2.2 s between Transfermarkt requests
const LIMIT = Number(process.argv[2] || 3500);
const H = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36", "Accept-Language": "en-US,en;q=0.9" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&#0?39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ");

// Transfermarkt ids by name, from the squad scrape
const squads = JSON.parse(readFileSync("scripts/.cache/raw-squads.json", "utf8")).byId;
const idOf = new Map();
for (const [id, p] of Object.entries(squads)) if (!idOf.has(p.name)) idOf.set(p.name, id);

/** "4x UEFA Champions League winner" headings, and the competitions under "Top goal scorer" */
function parse(html) {
  const titles = {};
  for (const m of html.matchAll(/<h2[^>]*>\s*([\s\S]*?)\s*<\/h2>/g)) {
    const t = decode(m[1].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
    const c = /^(\d+)x (.+)$/.exec(t);
    if (c) titles[c[2]] = Number(c[1]);
  }
  const top = [];
  const i = html.indexOf("x Top goal scorer");
  if (i >= 0) {
    const end = html.indexOf("<h2", i + 20);
    const seg = html.slice(i, end > 0 ? end : i + 40000);
    // each row: the competition's logo (title="…") then " - n Goals"
    for (const m of seg.matchAll(/erfolg_table_wappen">\s*<img[^>]*?title="([^"]+)"/g)) top.push(decode(m[1]).trim());
  }
  return { titles, top: [...new Set(top)] };
}

if (!existsSync(PAGES)) mkdirSync(PAGES, { recursive: true });
const state = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
let n = 0;
for (const p of PLAYERS.slice(0, LIMIT)) {
  const id = idOf.get(p.name);
  if (!id || state[id]) continue;
  const file = `${PAGES}/${id}.html`;
  let html = existsSync(file) ? readFileSync(file, "utf8") : null;
  if (!html) {
    for (let tries = 0; tries < 3 && !html; tries++) {
      try {
        const r = await fetch(`https://www.transfermarkt.com/x/erfolge/spieler/${id}`, { headers: H });
        if (r.status === 429) {
          await sleep(20000);
          continue;
        }
        if (r.ok) html = await r.text();
        else break;
      } catch {
        await sleep(6000);
      }
    }
    await sleep(TM_GAP_MS);
    if (html) writeFileSync(file, html);
  }
  state[id] = html ? parse(html) : { titles: {}, top: [] };
  if (++n % 25 === 0) {
    writeFileSync(OUT, JSON.stringify(state));
    console.log(n, p.name);
  }
}
writeFileSync(OUT, JSON.stringify(state));
console.log("done", Object.keys(state).length);
