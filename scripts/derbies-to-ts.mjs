#!/usr/bin/env node
/**
 * Convert data-drafts/derbies.json into src/data/matches-derbiler.ts
 */
import { readFileSync, writeFileSync } from "fs";

const drafts = [
  ...JSON.parse(readFileSync("data-drafts/derbies.json", "utf8")),
  ...JSON.parse(readFileSync("data-drafts/derbies-bjk.json", "utf8")),
];

// de-dupe ids (safety) and drop 0-0 matches beyond a small quota so the
// collection stays fun (0-0 title deciders are fine, random 0-0s less so)
const seen = new Set();
let boring = 0;
const entries = [];
for (const d of drafts) {
  if (seen.has(d.id)) continue;
  seen.add(d.id);
  if (d.score === "0-0") {
    boring++;
    if (boring > 3) continue;
  }
  entries.push(d);
}

const ts = `import type { Match } from "@/lib/types";

/**
 * 3 büyükler derbileri — Galatasaray / Fenerbahçe / Beşiktaş.
 * Auto-generated from Transfermarkt match sheets (factual lineup data)
 * by scripts/build-derbies.mjs. Winner's XI (home XI on draws).
 * Captains omitted: not marked in the source.
 */
export const MATCHES_DERBILER: Match[] = ${JSON.stringify(entries, null, 2)};
`;

writeFileSync("src/data/matches-derbiler.ts", ts);
console.log(`wrote ${entries.length} derby matches`);
