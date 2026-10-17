#!/usr/bin/env node
/**
 * Taktik Tahtası — each famous player's peak Transfermarkt market value (the
 * highest point of his value history; values exist from about 2004 on). Used by
 * scripts/taktik-build.mjs to set card costs. Resumable, one request per player,
 * ≥ 2.2 s apart. Output → scripts/.cache/raw-values.json: { tmId: peakEuros | 0 }
 *
 * Usage: node --import ./scripts/lib/alias.mjs scripts/taktik-scrape-values.mjs [limit]
 *   limit = how many of the most famous players to fetch (default 900)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { PLAYERS } from "@/data/players";

const OUT = "scripts/.cache/raw-values.json";
const TM_GAP_MS = 2300; // keep ≥ 2.2 s between Transfermarkt requests
const LIMIT = Number(process.argv[2] || 900);
const H = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36", "Accept-Language": "en-US,en;q=0.9" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Transfermarkt ids by name, from the squad scrape
const squads = JSON.parse(readFileSync("scripts/.cache/raw-squads.json", "utf8")).byId;
const idOf = new Map();
for (const [id, p] of Object.entries(squads)) if (!idOf.has(p.name)) idOf.set(p.name, id);

// most famous first (honours, then clubs): the same order the card tiers come from
const fame = (p) => (p.badges?.length ?? 0) * 4 + p.clubs.length * 0.8;
const order = PLAYERS.map((p) => p).sort((a, b) => fame(b) - fame(a)).slice(0, LIMIT);

const state = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
let n = 0;
for (const p of order) {
  const id = idOf.get(p.name);
  if (!id || state[id] !== undefined) continue;
  let peak = 0;
  for (let tries = 0; tries < 3; tries++) {
    try {
      const r = await fetch(`https://www.transfermarkt.com/ceapi/marketValueDevelopment/graph/${id}`, { headers: H });
      if (r.status === 429) {
        await sleep(20000);
        continue;
      }
      if (r.ok) {
        const j = await r.json();
        peak = Math.max(0, ...(j.list ?? []).map((x) => Number(x.y) || 0));
      }
      break;
    } catch {
      await sleep(6000);
    }
  }
  state[id] = peak;
  if (++n % 25 === 0) {
    writeFileSync(OUT, JSON.stringify(state));
    console.log(n, p.name, peak);
  }
  await sleep(TM_GAP_MS);
}
writeFileSync(OUT, JSON.stringify(state));
console.log("done", Object.keys(state).length);
