#!/usr/bin/env node
/**
 * Build derby Match entries from Transfermarkt match sheets (factual data:
 * lineups, shirt numbers, scores). Emits JSON drafts for review.
 *
 * Usage: node scripts/build-derbies.mjs > data-drafts/derbies.json
 */

import { arrange, fetchMatch, get, seasonOf, sleep, toDDMMYYYY, normalizeAnswer } from "./lib/tm.mjs";

const ALL_PAIRS = [
  { ids: "141_36", take: 20 }, // GS - FB
  { ids: "141_114", take: 18 }, // GS - BJK
  { ids: "36_114", take: 18 }, // FB - BJK
];
const wanted = process.argv.slice(2);
const PAIRS = wanted.length
  ? ALL_PAIRS.filter((p) => wanted.includes(p.ids))
  : ALL_PAIRS;

const COMP_OK = /Süper Lig|Türkiye Kupasi|TFF Süper Kupa|Süper Final|1\.Lig/i;

const TEAM_INFO = {
  Galatasaray: {
    name: "Galatasaray",
    kit: { body: "#a32638", sleeves: "#fdb912", number: "#ffffff" },
  },
  Fenerbahce: {
    name: "Fenerbahçe",
    kit: { body: "#163962", sleeves: "#ffed00", number: "#ffffff" },
  },
  Besiktas: {
    name: "Beşiktaş",
    kit: { body: "#000000", sleeves: "#ffffff", number: "#ffffff" },
  },
  "Besiktas JK": {
    name: "Beşiktaş",
    kit: { body: "#000000", sleeves: "#ffffff", number: "#ffffff" },
  },
};

const COMP_NAMES = {
  "Süper Lig": { tr: "Süper Lig Derbisi", en: "Süper Lig Derby" },
  "Türkiye Kupasi": { tr: "Türkiye Kupası Derbisi", en: "Turkish Cup Derby" },
  "TFF Süper Kupa": { tr: "TFF Süper Kupası", en: "Turkish Super Cup" },
  "Süper Final": { tr: "Süper Final Derbisi", en: "Süper Final Derby" },
};

// Optional env overrides for a deeper/older backfill without changing defaults:
//   TAKE=70 YMIN=2005 YMAX=2017 node scripts/build-derbies.mjs
const TAKE = process.env.TAKE ? Number(process.env.TAKE) : null;
const YMIN = process.env.YMIN ? Number(process.env.YMIN) : 0;
const YMAX = process.env.YMAX ? Number(process.env.YMAX) : 9999;

const out = [];
const skipped = [];

for (const pair of PAIRS) {
  const listHtml = await get(
    `https://www.transfermarkt.us/vergleich/vereineBegegnungen/statistik/${pair.ids}`
  );
  const rows = listHtml.split("<tr").slice(1);
  const candidates = [];
  for (const row of rows) {
    const idm = row.match(/spielbericht\/index\/spielbericht\/(\d+)/);
    if (!idm) continue;
    // played matches have a numeric result in the row; skip future fixtures
    if (!/>\s*\d+:\d+\s*</.test(row)) continue;
    const comp =
      row.match(/title="([^"]+)"[^>]*class="wettbewerblogo"/)?.[1] ?? "";
    if (!COMP_OK.test(comp)) continue;
    candidates.push({ id: idm[1], comp });
    if (candidates.length >= (TAKE ?? pair.take)) break;
  }

  for (const c of candidates) {
    try {
      await sleep(1800);
      const md = await fetchMatch(c.id);
      if (!md.date || !md.score || md.homeXI.length !== 11 || md.awayXI.length !== 11) {
        skipped.push({ id: c.id, why: "incomplete", date: md.date });
        continue;
      }
      const yr = Number(md.date.slice(0, 4));
      if (yr < YMIN || yr > YMAX) continue;
      const [hs, as] = md.score.map(Number);
      // use winner's XI; draws → home XI
      const useHome = hs >= as;
      const sideKey = useHome ? "home" : "away";
      const teamRaw = useHome ? md.home : md.away;
      const oppRaw = useHome ? md.away : md.home;
      const info = TEAM_INFO[teamRaw];
      const oppInfo = TEAM_INFO[oppRaw];
      if (!info || !oppInfo) {
        skipped.push({ id: c.id, why: `teams: ${md.home} vs ${md.away}` });
        continue;
      }
      const xi = useHome ? md.homeXI : md.awayXI;
      const arranged = arrange(xi);
      if (!arranged) {
        skipped.push({
          id: c.id,
          why: "formation " + xi.map((p) => p.pos).join(","),
          date: md.date,
        });
        continue;
      }
      const scorerCounts = {};
      for (const g of md.goals) {
        if (g.ownGoal) continue;
        if (g.side !== sideKey) continue;
        scorerCounts[g.scorer] = (scorerCounts[g.scorer] ?? 0) + 1;
      }
      const compKey = Object.keys(COMP_NAMES).find((k) => c.comp.includes(k)) ?? "Süper Lig";
      const lineup = arranged.ordered.map((p) => {
        const goalsFor =
          scorerCounts[p.name] ??
          Object.entries(scorerCounts).find(([n]) =>
            n.split(" ").pop() === p.name.split(" ").pop() && n === p.name
          )?.[1];
        const tokens = p.name.split(" ");
        const answer = normalizeAnswer(tokens[tokens.length - 1]) || normalizeAnswer(p.name);
        return {
          name: p.name,
          answer,
          number: p.number,
          ...(goalsFor ? { goals: goalsFor } : {}),
        };
      });
      const score = useHome ? `${hs}-${as}` : `${as}-${hs}`;
      out.push({
        id: `derbi-${md.date}-${info.name.toLowerCase().replace(/[^a-z]/g, "")}`,
        tags: ["turkiye", "derbi"],
        competition: COMP_NAMES[compKey],
        season: seasonOf(md.date),
        date: toDDMMYYYY(md.date),
        team: info.name,
        opponent: oppInfo.name,
        score,
        formation: arranged.formation,
        kit: info.kit,
        lineup,
      });
      console.error(`OK ${md.date} ${info.name} ${score} ${oppInfo.name} [${arranged.formation}]`);
    } catch (e) {
      skipped.push({ id: c.id, why: String(e).slice(0, 80) });
    }
  }
}

console.error(`\nBuilt ${out.length}, skipped ${skipped.length}`);
for (const s of skipped) console.error("SKIP", JSON.stringify(s));
console.log(JSON.stringify(out, null, 2));
