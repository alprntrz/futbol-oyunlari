#!/usr/bin/env node
/**
 * Build derby / big-match entries for the top leagues (La Liga, Premier League,
 * Serie A, Bundesliga, plus Trabzonspor vs the big three) from Transfermarkt
 * match sheets. Winner's XI (home XI on a draw), like build-derbies.mjs.
 *
 * Usage:
 *   node scripts/build-league-derbies.mjs                 # all leagues
 *   node scripts/build-league-derbies.mjs laliga premier  # some leagues
 *   PAIR=rma_fcb node scripts/build-league-derbies.mjs laliga   # one pair
 *   YMIN=2005 TAKE=5 ...                                  # season floor / cap
 *
 * Each pair keeps `take` matches spread evenly across the seasons (newest to
 * oldest ≥ YMIN) so every era is represented, not just the latest.
 *
 * Writes data-drafts/league-<key>.json (rewritten after each pair) and caches
 * every fetched match sheet in scripts/.cache/tm/ so reruns and crashes are
 * cheap. Convert to TS with scripts/leagues-to-ts.mjs.
 */
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "fs";
import {
  arrange, arrangeByPitch, answerFor, enrichPitch, fetchMatch, get, normalizeAnswer, seasonOf, toDDMMYYYY,
} from "./lib/tm.mjs";
import { COMPETITIONS, LEAGUES, TEAMS } from "./lib/leagues.mjs";

const YMIN = Number(process.env.YMIN ?? 2005);
const TAKE = process.env.TAKE ? Number(process.env.TAKE) : null;
const ONLY_PAIR = process.env.PAIR ?? null;

const CACHE = "scripts/.cache/tm";
mkdirSync(CACHE, { recursive: true });
mkdirSync("data-drafts", { recursive: true });

const requested = process.argv.slice(2);
const leagueKeys = requested.length ? requested : Object.keys(LEAGUES);
for (const k of leagueKeys) if (!LEAGUES[k]) throw new Error(`unknown league: ${k}`);

const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "");

async function cachedMatch(id) {
  const file = `${CACHE}/${id}.json`;
  let md = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : await fetchMatch(id);
  // sheets cached before we parsed the formation graphic get their coordinates now
  if (!md.pitchChecked) md = await enrichPitch(md);
  writeFileSync(file, JSON.stringify(md));
  return md;
}

/** Pick n items spread evenly over a newest-first list (keeps newest and oldest). */
function spread(list, n) {
  if (list.length <= n) return list;
  if (n <= 1) return list.slice(0, n);
  return Array.from({ length: n }, (_, i) => list[Math.round((i * (list.length - 1)) / (n - 1))]);
}

async function listCandidates(pair) {
  const a = TEAMS[pair.a], b = TEAMS[pair.b];
  const html = await get(
    `https://www.transfermarkt.us/vergleich/vereineBegegnungen/statistik/${a.id}_${b.id}`
  );
  const comps = new Map();
  const out = [];
  for (const row of html.split("<tr").slice(1)) {
    const idm = row.match(/spielbericht\/index\/spielbericht\/(\d+)/);
    if (!idm) continue;
    if (!/>\s*\d+:\d+\s*</.test(row)) continue; // future fixtures
    const comp = row.match(/title="([^"]+)"[^>]*class="wettbewerblogo"/)?.[1] ?? "";
    comps.set(comp, (comps.get(comp) ?? 0) + 1);
    const label = COMPETITIONS.find(([re]) => re.test(comp))?.[1];
    const year = Number(row.match(/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \w{3} \d{1,2}, (\d{4})/)?.[1]);
    if (label && year >= YMIN) out.push({ id: idm[1], comp: label, year });
  }
  console.error(
    `  ${pair.a}-${pair.b}: competitions seen: ` +
      [...comps].map(([c, n]) => `${c || "?"}×${n}`).join(", ")
  );
  return out;
}

for (const key of leagueKeys) {
  const league = LEAGUES[key];
  const out = [];
  const skipped = [];
  console.error(`\n=== ${key}`);

  for (const pair of league.pairs) {
    if (ONLY_PAIR && ONLY_PAIR !== `${pair.a}_${pair.b}`) continue;
    const A = TEAMS[pair.a], B = TEAMS[pair.b];
    let cands;
    try {
      cands = spread(await listCandidates(pair), TAKE ?? pair.take);
    } catch (e) {
      console.error(`ERR list ${pair.a}-${pair.b}: ${String(e).slice(0, 100)} — pair skipped, rerun to retry`);
      continue;
    }
    let built = 0;

    for (const c of cands) {
      try {
        const md = await cachedMatch(c.id);
        if (!md.date || !md.score || md.homeXI.length !== 11 || md.awayXI.length !== 11) {
          skipped.push({ id: c.id, why: "incomplete", date: md.date });
          continue;
        }

        const [hs, as] = md.score.map(Number);
        const useHome = hs >= as;
        const raw = useHome ? md.home : md.away;
        const oppRaw = useHome ? md.away : md.home;
        const isA = A.re.test(raw), isB = B.re.test(raw);
        if (isA === isB || !(A.re.test(oppRaw) || B.re.test(oppRaw))) {
          skipped.push({ id: c.id, why: `teams: ${md.home} vs ${md.away}`, date: md.date });
          continue;
        }
        const team = isA ? A : B;
        const opp = isA ? B : A;

        const xi = useHome ? md.homeXI : md.awayXI;
        // real positions from TM's formation graphic; label-based guess for old
        // sheets that have none
        const arranged =
          arrangeByPitch(xi, useHome ? md.homeShape : md.awayShape) ?? arrange(xi, { modern: true });
        if (!arranged) {
          skipped.push({ id: c.id, why: "formation " + xi.map((p) => p.pos).join(","), date: md.date });
          continue;
        }

        const sideKey = useHome ? "home" : "away";
        const scorers = {};
        for (const g of md.goals) {
          if (g.ownGoal || g.side !== sideKey) continue;
          scorers[g.scorer] = (scorers[g.scorer] ?? 0) + 1;
        }
        const goalsOf = (name) => {
          if (scorers[name]) return scorers[name];
          const last = name.split(" ").pop();
          const hits = Object.keys(scorers).filter((n) => n.split(" ").pop() === last);
          return hits.length === 1 ? scorers[hits[0]] : undefined;
        };

        const lineup = arranged.ordered.map((p) => {
          const g = goalsOf(p.name);
          return { name: p.name, answer: answerFor(p.name), number: p.number, ...(g ? { goals: g } : {}) };
        });
        // Two players sharing a surname (two Garcías) would be ambiguous: use
        // "FIRST LAST" for those.
        const counts = {};
        for (const p of lineup) counts[p.answer] = (counts[p.answer] ?? 0) + 1;
        for (const p of lineup) {
          const first = p.name.trim().split(/\s+/)[0];
          if (counts[p.answer] > 1 && p.name.trim().includes(" ")) {
            p.answer = `${normalizeAnswer(first)} ${p.answer}`;
          }
        }

        const label = pair.derby ?? { tr: `${A.name} – ${B.name}`, en: `${A.name} – ${B.name}` };
        out.push({
          id: `${key}-${md.date}-${slug(team.name)}-${slug(opp.name)}`,
          tags: league.tags,
          competition: pair.plain
            ? { tr: `${c.comp.tr} Derbisi`, en: `${c.comp.en} Derby` }
            : { tr: `${label.tr} · ${c.comp.tr}`, en: `${label.en} · ${c.comp.en}` },
          season: seasonOf(md.date),
          date: toDDMMYYYY(md.date),
          team: team.name,
          opponent: opp.name,
          score: useHome ? `${hs}-${as}` : `${as}-${hs}`,
          formation: arranged.formation,
          kit: team.kit,
          lineup,
        });
        built++;
        console.error(
          `OK ${md.date} ${team.name} ${useHome ? hs : as}-${useHome ? as : hs} ${opp.name} [${arranged.formation}` +
            `${arranged.fit === undefined ? ", labels" : ", fit " + arranged.fit.toFixed(0)}]`
        );
      } catch (e) {
        skipped.push({ id: c.id, why: String(e).slice(0, 100) });
        console.error(`ERR ${c.id} ${String(e).slice(0, 100)}`);
      }
    }
    console.error(`  → ${pair.a}-${pair.b}: ${built} built`);
    writeFileSync(`data-drafts/league-${key}.json`, JSON.stringify(out, null, 1));
  }

  console.error(`\n${key}: built ${out.length}, skipped ${skipped.length}`);
  for (const s of skipped) console.error("SKIP", JSON.stringify(s));
}
