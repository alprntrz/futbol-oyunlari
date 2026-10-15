#!/usr/bin/env node
/**
 * Kart Düellosu — career numbers from Wikidata (CC0, free to reuse), matched to
 * our players through their Transfermarkt id (Wikidata property P2446).
 *
 * Per player: height, date of birth and every team stint with its appearances
 * and goals (qualifiers P1350 / P1351), flagged when the team is a national team.
 * Output (resumable) → scripts/.cache/raw-wikidata.json  { tm: { … } | null }
 *
 * Usage: node scripts/duel-fetch-wikidata.mjs   (then node scripts/duel-build.mjs)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { PLAYERS } from "../src/data/players.ts";

const OUT = "scripts/.cache/raw-wikidata.json";
const LIMIT = Number(process.env.LIMIT || 4000); // the best-known players (players.ts is sorted by notability)
const BATCH = 120;
const GAP_MS = 2500; // be gentle with the public endpoint
const UA = "TiktakoDataBuild/1.0 (football quiz app; one-off batch)";

const norm = (s) => s.toUpperCase().replaceAll("İ", "I").replaceAll("Ş", "S").replaceAll("Ğ", "G").replaceAll("Ü", "U").replaceAll("Ö", "O").replaceAll("Ç", "C").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z]/g, "");
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&#0?39;/g, "'").replace(/&quot;/g, '"').trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// our name → Transfermarkt ids seen under that name (squads + positions scrapes)
const byName = new Map();
for (const f of ["scripts/.cache/raw-seasons.json", "scripts/.cache/raw-positions.json"]) {
  if (!existsSync(f)) continue;
  for (const [id, name] of Object.entries(JSON.parse(readFileSync(f, "utf8")).names ?? {})) {
    const n = norm(decode(name));
    if (!n) continue;
    (byName.get(n) ?? byName.set(n, new Set()).get(n)).add(id);
  }
}

const state = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
const want = [];
for (const p of PLAYERS.slice(0, LIMIT)) for (const id of byName.get(norm(p.name)) ?? []) if (!(id in state)) want.push(id);
console.error(`${want.length} Transfermarkt ids to look up`);

async function query(ids) {
  const q = `SELECT ?tm ?p ?height ?birth ?team ?nat ?m ?g WHERE {
    VALUES ?tm { ${ids.map((i) => `"${i}"`).join(" ")} }
    ?p wdt:P2446 ?tm.
    OPTIONAL { ?p wdt:P2048 ?height }
    OPTIONAL { ?p wdt:P569 ?birth }
    OPTIONAL { ?p p:P54 ?st. ?st ps:P54 ?team.
      OPTIONAL { ?st pq:P1350 ?m } OPTIONAL { ?st pq:P1351 ?g }
      BIND(EXISTS { ?team wdt:P31/wdt:P279* wd:Q1194951 } || EXISTS { ?team wdt:P31/wdt:P279* wd:Q6979593 } AS ?nat) }
  }`;
  for (let i = 0; i < 4; i++) {
    const r = await fetch("https://query.wikidata.org/sparql", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/sparql-results+json", "User-Agent": UA },
      body: new URLSearchParams({ query: q }),
    }).catch(() => null);
    if (r?.ok) return (await r.json()).results.bindings;
    await sleep(r?.status === 429 ? 60000 : 10000);
  }
  return null;
}

for (let i = 0; i < want.length; i += BATCH) {
  const ids = want.slice(i, i + BATCH);
  const rows = await query(ids);
  await sleep(GAP_MS);
  if (!rows) continue;
  const got = {};
  for (const b of rows) {
    const tm = b.tm.value;
    const e = (got[tm] ??= { q: b.p.value.split("/").pop(), height: null, birth: null, stints: {} });
    if (b.height) e.height = Number(b.height.value);
    if (b.birth) e.birth = b.birth.value.slice(0, 10);
    if (b.team) {
      // one row per stint and qualifier combo: keep the biggest numbers per team
      const t = (e.stints[b.team.value.split("/").pop()] ??= { nat: b.nat?.value === "true", m: 0, g: 0 });
      if (b.m) t.m = Math.max(t.m, Number(b.m.value) || 0);
      if (b.g) t.g = Math.max(t.g, Number(b.g.value) || 0);
    }
  }
  for (const id of ids) state[id] = got[id] ?? null;
  writeFileSync(OUT, JSON.stringify(state));
  console.error(`${Math.min(i + BATCH, want.length)}/${want.length}`);
}
console.error(`DONE → ${OUT}`);
