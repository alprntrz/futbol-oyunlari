#!/usr/bin/env node
/**
 * Convert data-drafts/league-*.json (from build-league-derbies.mjs) into TS
 * data files:
 *   src/data/matches-ligler.ts   ← laliga, premier, seriea, bundesliga, superlig
 *   src/data/matches-derbiler.ts ← derbiler (Galatasaray / Fenerbahçe / Beşiktaş)
 * A target is only rewritten when at least one of its drafts exists.
 *
 * - drops matches already present in the *other* data files (same date + a
 *   shared team), e.g. a cup final that is also a curated match
 * - keeps at most MAX_GOALLESS goalless draws per target (the XI is the puzzle,
 *   but a scorer-less match is a little less fun)
 * - applies ANSWER_OVERRIDES ("Sokratis Papastathopoulos" → SOKRATIS) to drafts
 *   generated before an override existed
 * - writes one compact JSON object per line (these arrays ship in the client
 *   bundle, so indentation is expensive)
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { ANSWER_OVERRIDES } from "./lib/tm.mjs";

const MAX_GOALLESS = 12;

const TARGETS = [
  {
    out: "src/data/matches-ligler.ts",
    name: "MATCHES_LIGLER",
    leagues: ["laliga", "premier", "seriea", "bundesliga", "superlig"],
    header: `La Liga / Premier Lig / Serie A / Bundesliga derbileri ve dev maçları ile
 * Trabzonspor – 3 büyükler (2005+). Auto-generated from Transfermarkt match
 * sheets (factual lineup data, players placed from TM's formation graphic) by
 * scripts/build-league-derbies.mjs → scripts/leagues-to-ts.mjs. Winner's XI
 * (home XI on draws). Captains omitted: not marked in the source. Süper Lig
 * entries carry the "turkiye" tag.`,
  },
  {
    out: "src/data/matches-derbiler.ts",
    name: "MATCHES_DERBILER",
    leagues: ["derbiler"],
    header: `3 büyükler derbileri (2005+) — Galatasaray / Fenerbahçe / Beşiktaş.
 * Auto-generated from Transfermarkt match sheets (factual lineup data, players
 * placed from TM's formation graphic) by scripts/build-league-derbies.mjs →
 * scripts/leagues-to-ts.mjs. Winner's XI (home XI on draws). Captains omitted:
 * not marked in the source.`,
  },
];
const GENERATED = new Set(TARGETS.map((t) => t.out.split("/").pop()));
// files this script's output replaces (kept out of the duplicate scan)
GENERATED.add("matches-derbiler-eski.ts");

const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "");

// date → team slugs already in the hand-made / other data files on that date
const existing = new Map();
for (const f of readdirSync("src/data")) {
  if (!/^matches.*\.ts$/.test(f) || GENERATED.has(f)) continue;
  const src = readFileSync(`src/data/${f}`, "utf8");
  const re = /"?date"?:\s*"(\d\d\.\d\d\.\d{4})"[\s\S]{0,200}?"?team"?:\s*"([^"]+)"[\s\S]{0,200}?"?opponent"?:\s*"([^"]+)"/g;
  for (const m of src.matchAll(re)) {
    const list = existing.get(m[1]) ?? [];
    list.push(slug(m[2]), slug(m[3]));
    existing.set(m[1], list);
  }
}

// optional target filter: `node scripts/leagues-to-ts.mjs ligler` / `derbiler`
const only = process.argv.slice(2);

for (const target of TARGETS) {
  if (only.length && !only.some((o) => target.out.includes(o))) continue;
  const files = target.leagues.map((k) => [k, `data-drafts/league-${k}.json`]);
  if (!files.some(([, f]) => existsSync(f))) {
    console.error(`${target.out}: no drafts yet — left untouched`);
    continue;
  }
  const seen = new Set();
  const entries = [];
  const perLeague = {};
  let dupes = 0, boring = 0;
  for (const [key, file] of files) {
    if (!existsSync(file)) {
      console.error(`missing ${file} — skipped`);
      continue;
    }
    for (const d of JSON.parse(readFileSync(file, "utf8"))) {
      if (seen.has(d.id)) continue;
      seen.add(d.id);
      const onDay = existing.get(d.date) ?? [];
      if (onDay.includes(slug(d.team)) || onDay.includes(slug(d.opponent))) {
        dupes++;
        continue;
      }
      if (d.score === "0-0" && ++boring > MAX_GOALLESS) continue;
      for (const p of d.lineup) if (ANSWER_OVERRIDES[p.name]) p.answer = ANSWER_OVERRIDES[p.name];
      entries.push(d);
      perLeague[key] = (perLeague[key] ?? 0) + 1;
    }
  }

  const ts = `import type { Match } from "@/lib/types";

/**
 * ${target.header}
 */
export const ${target.name}: Match[] = [
${entries.map((e) => "  " + JSON.stringify(e)).join(",\n")},
];
`;
  writeFileSync(target.out, ts);
  console.log(
    `wrote ${entries.length} matches to ${target.out}`,
    perLeague,
    `(dupes dropped: ${dupes}, extra 0-0 dropped: ${Math.max(0, boring - MAX_GOALLESS)})`
  );
}
