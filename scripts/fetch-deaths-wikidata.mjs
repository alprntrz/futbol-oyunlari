#!/usr/bin/env node
/**
 * Date of death (Wikidata P570) for every player already in
 * scripts/.cache/raw-wikidata.json (duel-fetch-wikidata.mjs), so the search can
 * show "1960–2020" instead of an age for players who have died.
 * Adds `death: "YYYY-MM-DD" | ""` to each entry (resumable: entries that have
 * the field are skipped).
 *
 * Usage: node scripts/fetch-deaths-wikidata.mjs   (then node scripts/duel-build.mjs)
 */
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "scripts/.cache/raw-wikidata.json";
const BATCH = 300;
const GAP_MS = 2500;
const UA = "TiktakoDataBuild/1.0 (football quiz app; one-off batch)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const state = JSON.parse(readFileSync(FILE, "utf8"));
const todo = Object.values(state).filter((e) => e && e.death === undefined);
console.error(`${todo.length} players to check`);

for (let i = 0; i < todo.length; i += BATCH) {
  const batch = todo.slice(i, i + BATCH);
  const q = `SELECT ?p ?d WHERE { VALUES ?p { ${batch.map((e) => `wd:${e.q}`).join(" ")} } ?p wdt:P570 ?d }`;
  let rows = null;
  for (let tries = 0; tries < 4 && !rows; tries++) {
    const r = await fetch("https://query.wikidata.org/sparql", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/sparql-results+json", "User-Agent": UA },
      body: new URLSearchParams({ query: q }),
    }).catch(() => null);
    if (r?.ok) rows = (await r.json()).results.bindings;
    else await sleep(10000);
  }
  if (!rows) continue;
  const died = new Map(rows.map((b) => [b.p.value.split("/").pop(), b.d.value.slice(0, 10)]));
  for (const e of batch) e.death = died.get(e.q) ?? "";
  writeFileSync(FILE, JSON.stringify(state));
  console.error(`${Math.min(i + BATCH, todo.length)}/${todo.length}`);
  await sleep(GAP_MS);
}
console.error("DONE");
