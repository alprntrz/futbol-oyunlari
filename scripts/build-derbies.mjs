#!/usr/bin/env node
/**
 * Build derby Match entries from Transfermarkt match sheets (factual data:
 * lineups, shirt numbers, scores). Emits JSON drafts for review.
 *
 * Usage: node scripts/build-derbies.mjs > data-drafts/derbies.json
 */

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(url, { headers: HEADERS });
    if (r.ok) return r.text();
    await sleep(8000);
  }
  throw new Error(`fetch failed: ${url}`);
}

function normalizeAnswer(raw) {
  return raw
    .toUpperCase()
    .replaceAll("İ", "I")
    .replaceAll("Ş", "S")
    .replaceAll("Ğ", "G")
    .replaceAll("Ü", "U")
    .replaceAll("Ö", "O")
    .replaceAll("Ç", "C")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z]/g, "");
}

const DF = new Set(["Goalkeeper", "Sweeper", "Right-Back", "Centre-Back", "Left-Back"]);
const MF = new Set(["Defensive Midfield", "Central Midfield", "Right Midfield", "Left Midfield", "Attacking Midfield"]);
const FW = new Set(["Right Winger", "Left Winger", "Second Striker", "Centre-Forward"]);

/**
 * Pick a formation key + ordered slot assignment from TM position labels.
 * Returns { formation, ordered } or null when the shape can't be mapped.
 */
function arrange(players) {
  const gk = players.filter((p) => p.pos === "Goalkeeper");
  if (gk.length !== 1) return null;
  const df = players.filter((p) => p.pos !== "Goalkeeper" && DF.has(p.pos));
  const mf = players.filter((p) => MF.has(p.pos));
  const fw = players.filter((p) => FW.has(p.pos));
  if (1 + df.length + mf.length + fw.length !== 11) return null;

  const take = (pool, poss) => {
    for (const pos of poss) {
      const i = pool.findIndex((p) => p.pos === pos);
      if (i >= 0) return pool.splice(i, 1)[0];
    }
    return pool.shift() ?? null;
  };

  // slot spec: list of preferred TM positions, drawn from a given line pool
  const build = (formation, specs) => {
    const pools = { df: [...df], mf: [...mf], fw: [...fw] };
    const ordered = [gk[0]];
    for (const [line, poss] of specs) {
      const p = take(pools[line], poss);
      if (!p) return null;
      ordered.push(p);
    }
    // Transfermarkt lists the two centre-backs left->right, but the pitch layout
    // (src/lib/formations.ts) renders slot 2 on the viewer's right and slot 3 on
    // the left. For back-four shapes, reverse the CB pair so the right-sided CB
    // lands on the right. (Only back-four: back-three slots 1-3 are all CBs.)
    if (formation.startsWith("4-")) {
      const t = ordered[2];
      ordered[2] = ordered[3];
      ordered[3] = t;
    }
    return { formation, ordered };
  };

  const D = df.length, M = mf.length, F = fw.length;
  const dm = mf.filter((p) => p.pos === "Defensive Midfield").length;

  if (D === 4 && M === 2 && F === 4)
    return build("4-2-4", [
      ["df", ["Right-Back"]], ["df", ["Centre-Back"]], ["df", ["Centre-Back"]], ["df", ["Left-Back"]],
      ["mf", ["Defensive Midfield", "Central Midfield"]], ["mf", ["Central Midfield"]],
      ["fw", ["Right Winger"]], ["fw", ["Centre-Forward", "Second Striker"]],
      ["fw", ["Centre-Forward", "Second Striker"]], ["fw", ["Left Winger"]],
    ]);
  if (D === 4 && M === 4 && F === 2) {
    const hasSS = fw.some((p) => p.pos === "Second Striker") && fw.some((p) => p.pos === "Centre-Forward");
    return build(hasSS ? "4-4-1-1" : "4-4-2", [
      ["df", ["Right-Back"]], ["df", ["Centre-Back"]], ["df", ["Centre-Back"]], ["df", ["Left-Back"]],
      ["mf", ["Right Midfield", "Right Winger"]], ["mf", ["Defensive Midfield", "Central Midfield"]],
      ["mf", ["Central Midfield", "Attacking Midfield"]], ["mf", ["Left Midfield"]],
      ["fw", ["Second Striker", "Centre-Forward"]], ["fw", ["Centre-Forward"]],
    ]);
  }
  if (D === 4 && M === 5 && F === 1) {
    if (dm >= 2)
      return build("4-2-3-1", [
        ["df", ["Right-Back"]], ["df", ["Centre-Back"]], ["df", ["Centre-Back"]], ["df", ["Left-Back"]],
        ["mf", ["Defensive Midfield"]], ["mf", ["Defensive Midfield", "Central Midfield"]],
        ["mf", ["Right Midfield"]], ["mf", ["Attacking Midfield", "Central Midfield"]], ["mf", ["Left Midfield"]],
        ["fw", ["Centre-Forward", "Second Striker"]],
      ]);
    return build("4-1-4-1", [
      ["df", ["Right-Back"]], ["df", ["Centre-Back"]], ["df", ["Centre-Back"]], ["df", ["Left-Back"]],
      ["mf", ["Defensive Midfield"]],
      ["mf", ["Right Midfield"]], ["mf", ["Central Midfield"]], ["mf", ["Central Midfield", "Attacking Midfield"]], ["mf", ["Left Midfield"]],
      ["fw", ["Centre-Forward", "Second Striker"]],
    ]);
  }
  if (D === 4 && M === 3 && F === 3)
    return build("4-3-3", [
      ["df", ["Right-Back"]], ["df", ["Centre-Back"]], ["df", ["Centre-Back"]], ["df", ["Left-Back"]],
      ["mf", ["Central Midfield", "Right Midfield"]], ["mf", ["Defensive Midfield", "Central Midfield"]], ["mf", ["Central Midfield", "Left Midfield", "Attacking Midfield"]],
      ["fw", ["Right Winger"]], ["fw", ["Centre-Forward", "Second Striker"]], ["fw", ["Left Winger"]],
    ]);
  if (D === 4 && M === 4 && F === 1 + 1 - 1) return null; // unreachable guard
  if (D === 4 && M === 6 && F === 0) return null;
  if ((D === 3 || D === 5) && M === 4 && F === 2) {
    // wing-backs live in DF (5) or MF (3) depending on labeling
    const specs = D === 5
      ? [
          ["df", ["Sweeper", "Centre-Back"]], ["df", ["Centre-Back"]], ["df", ["Centre-Back"]],
          ["df", ["Right-Back"]], ["df", ["Left-Back"]],
          ["mf", ["Central Midfield", "Defensive Midfield"]], ["mf", ["Central Midfield", "Defensive Midfield"]],
          ["mf", ["Attacking Midfield", "Right Midfield"]],
          ["fw", ["Centre-Forward", "Second Striker"]], ["fw", ["Centre-Forward", "Second Striker"]],
        ]
      : [
          ["df", ["Sweeper", "Centre-Back"]], ["df", ["Centre-Back"]], ["df", ["Centre-Back"]],
          ["mf", ["Right Midfield"]], ["mf", ["Left Midfield"]],
          ["mf", ["Central Midfield", "Defensive Midfield"]], ["mf", ["Central Midfield", "Defensive Midfield"]],
          ["mf", ["Attacking Midfield"]],
          ["fw", ["Centre-Forward", "Second Striker"]], ["fw", ["Centre-Forward", "Second Striker"]],
        ];
    // both shapes need exactly 10 outfield specs; 3-back variant pulls 5 from mf
    const r = build("3-5-2", specs);
    if (r) return r;
  }
  if (D === 3 && M === 5 && F === 2)
    return build("3-5-2", [
      ["df", ["Sweeper", "Centre-Back"]], ["df", ["Centre-Back"]], ["df", ["Centre-Back"]],
      ["mf", ["Right Midfield"]], ["mf", ["Left Midfield"]],
      ["mf", ["Central Midfield", "Defensive Midfield"]], ["mf", ["Central Midfield", "Defensive Midfield"]],
      ["mf", ["Attacking Midfield", "Central Midfield"]],
      ["fw", ["Centre-Forward", "Second Striker"]], ["fw", ["Centre-Forward", "Second Striker"]],
    ]);
  if (D === 5 && M === 3 && F === 2)
    return build("3-5-2", [
      ["df", ["Sweeper", "Centre-Back"]], ["df", ["Centre-Back"]], ["df", ["Centre-Back"]],
      ["df", ["Right-Back"]], ["df", ["Left-Back"]],
      ["mf", ["Central Midfield", "Defensive Midfield"]], ["mf", ["Central Midfield", "Defensive Midfield"]],
      ["mf", ["Attacking Midfield", "Central Midfield"]],
      ["fw", ["Centre-Forward", "Second Striker"]], ["fw", ["Centre-Forward", "Second Striker"]],
    ]);
  if (D === 5 && M === 4 && F === 1)
    return build("3-4-2-1", [
      ["df", ["Centre-Back", "Sweeper"]], ["df", ["Centre-Back"]], ["df", ["Centre-Back"]],
      ["df", ["Right-Back"]], ["df", ["Left-Back"]],
      ["mf", ["Central Midfield", "Defensive Midfield"]], ["mf", ["Central Midfield", "Defensive Midfield"]],
      ["mf", ["Attacking Midfield", "Right Midfield"]], ["mf", ["Attacking Midfield", "Left Midfield"]],
      ["fw", ["Centre-Forward", "Second Striker"]],
    ]);
  if (D === 4 && M === 3 && F === 3 - 1) return null;
  if (D === 4 && (M === 3) && F === 2 + 1 - 1) return null;
  if (D === 4 && M === 3 && F === 2)
    return null; // 4-3-2 + ? impossible (sums to 10)
  if (D === 4 && M === 2 && F === 3 + 1 - 1) return null;
  if (D === 3 && M === 4 && F === 3)
    return build("3-4-3d", [
      ["df", ["Centre-Back", "Sweeper"]], ["df", ["Centre-Back"]], ["df", ["Centre-Back"]],
      ["mf", ["Defensive Midfield", "Central Midfield"]],
      ["mf", ["Central Midfield", "Right Midfield"]], ["mf", ["Central Midfield", "Left Midfield"]],
      ["mf", ["Attacking Midfield"]],
      ["fw", ["Right Winger"]], ["fw", ["Centre-Forward", "Second Striker"]], ["fw", ["Left Winger"]],
    ]);
  return null;
}

function toDDMMYYYY(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function seasonOf(iso) {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  return m >= 7 ? `${y}/${String((y + 1) % 100).padStart(2, "0")}` : `${y - 1}/${String(y % 100).padStart(2, "0")}`;
}

async function fetchMatch(id) {
  const lineupHtml = await get(
    `https://www.transfermarkt.us/x_y/aufstellung/spielbericht/${id}`
  );
  const players = [];
  const re =
    /title="([^"]+)"\s*>\s*<div class="rn_nummer">\s*(\d+)\s*<\/div>[\s\S]{0,900}?<a href="\/[^/]+\/profil\/spieler\/(\d+)"[\s\S]{0,300}?title="([^"]+)"/g;
  let m;
  while ((m = re.exec(lineupHtml)) !== null) {
    players.push({ pos: m[1], number: Number(m[2]), name: m[4] });
  }
  const indexHtml = await get(
    `https://www.transfermarkt.us/x_y/index/spielbericht/${id}`
  );
  const goals = [];
  const goalSection = indexHtml.split('id="sb-tore"')[1]?.split("</ul>")[0] ?? "";
  for (const g of goalSection.matchAll(
    /<li class="sb-aktion-(heim|gast)"[\s\S]*?<\/li>/g
  )) {
    const scorer = g[0].match(/class="wichtig"[^>]*>([^<]+)</)?.[1]?.trim();
    const ownGoal = /own-goal/i.test(g[0]);
    if (scorer) goals.push({ side: g[1] === "heim" ? "home" : "away", scorer, ownGoal });
  }
  const score = indexHtml.match(/sb-endstand[^>]*>\s*(\d+)[:](\d+)/)?.slice(1, 3);
  const date = indexHtml.match(/\/datum\/(\d{4}-\d{2}-\d{2})/)?.[1];
  const teams = [...indexHtml.matchAll(/sb-vereinslink[^>]*>([^<]+)</g)].map((t) =>
    t[1].trim()
  );
  return {
    id,
    date,
    home: teams[0],
    away: teams[1],
    score,
    homeXI: players.slice(0, 11),
    awayXI: players.slice(11, 22),
    goals,
  };
}

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
