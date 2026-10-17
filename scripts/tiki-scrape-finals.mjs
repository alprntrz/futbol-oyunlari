#!/usr/bin/env node
/**
 * Tic-Tac-Toe "Played in a Champions League final": the starting XIs of every European
 * Cup / Champions League final (Transfermarkt). Per season: the competition's fixture
 * page (to find the final), then the final's match sheet (scripts/lib/tm.mjs fetchMatch,
 * ≥ 2.2 s between requests, pages cached in scripts/.cache/tm/).
 * Output → scripts/.cache/raw-finals.json: { "2023": ["Ederson", …], … }
 * Then: node --import ./scripts/lib/alias.mjs scripts/tiki-build-honours.mjs
 *
 * Usage: node scripts/tiki-scrape-finals.mjs [fromSeason] [toSeason]   (default 1955 2025; 2024 = 2024/25)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { fetchMatch, get } from "./lib/tm.mjs";

const OUT = "scripts/.cache/raw-finals.json";
const CACHE = "scripts/.cache/tm";
const FROM = Number(process.argv[2] || 1955);
const TO = Number(process.argv[3] || 2025);
mkdirSync(CACHE, { recursive: true });

const state = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};

async function cached(file, fetcher) {
  if (existsSync(file)) return readFileSync(file, "utf8");
  const body = await fetcher();
  writeFileSync(file, body);
  return body;
}

for (let s = FROM; s <= TO; s++) {
  if (state[s]) continue;
  const html = await cached(`${CACHE}/cl-plan-${s}.html`, () => get(`https://www.transfermarkt.com/uefa-champions-league/gesamtspielplan/pokalwettbewerb/CL/saison_id/${s}`));
  // the "Final" block's match link (the last round on the page)
  const at = html.lastIndexOf(">Final<");
  const ids = [...html.slice(at > 0 ? at : 0).matchAll(/spielbericht\/index\/spielbericht\/(\d+)/g)].map((m) => m[1]);
  if (!ids.length) {
    console.log(s, "no final found");
    continue;
  }
  // a replayed final (1974): both games count
  const names = new Set();
  for (const id of [...new Set(ids)].slice(0, 2)) {
    const file = `${CACHE}/${id}.json`;
    const md = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : await fetchMatch(id);
    if (!existsSync(file)) writeFileSync(file, JSON.stringify(md));
    for (const p of [...(md.homeXI ?? []), ...(md.awayXI ?? [])]) names.add(p.name);
  }
  state[s] = [...names];
  writeFileSync(OUT, JSON.stringify(state));
  console.log(s, state[s].length, "players");
}
console.log("done", Object.keys(state).length, "finals");
