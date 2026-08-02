#!/usr/bin/env node
/**
 * Parse a Transfermarkt match sheet into structured lineup data
 * (factual match data: shirt numbers, names, positions, goals).
 *
 * Usage: node scripts/fetch-tm.mjs <spielberichtId>
 * Prints JSON: { formationHome, formationAway, home: [...], away: [...], goals: [...] }
 */

const id = process.argv[2];
if (!id) {
  console.error("Usage: node scripts/fetch-tm.mjs <spielberichtId>");
  process.exit(1);
}

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

async function get(url) {
  const r = await fetch(url, { headers: HEADERS });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.text();
}

const lineupHtml = await get(
  `https://www.transfermarkt.us/x_y/aufstellung/spielbericht/${id}`
);

// Formation is derived downstream from position labels; TM pages don't
// reliably expose it as text.

// Player entries in page order: number, then profile link title, position title
const players = [];
const re =
  /title="([^"]+)"\s*>\s*<div class="rn_nummer">\s*(\d+)\s*<\/div>[\s\S]{0,900}?<a href="\/[^/]+\/profil\/spieler\/(\d+)"[\s\S]{0,300}?title="([^"]+)"/g;
let m;
while ((m = re.exec(lineupHtml)) !== null) {
  players.push({ pos: m[1], number: Number(m[2]), name: m[4] });
}

// First 11 = home XI, next 11 = away XI (substitutes appear in later sections
// without the same structure; guard by slicing 22)
const home = players.slice(0, 11);
const away = players.slice(11, 22);

// Goals from the match sheet page
const indexHtml = await get(
  `https://www.transfermarkt.us/x_y/index/spielbericht/${id}`
);
const goals = [];
const goalSection = indexHtml.split('id="sb-tore"')[1]?.split("</ul>")[0] ?? "";
for (const g of goalSection.matchAll(
  /<li class="sb-aktion-(heim|gast)"[\s\S]*?<\/li>/g
)) {
  const block = g[0];
  const side = g[1] === "heim" ? "home" : "away";
  const scorer = block.match(/class="wichtig"[^>]*>([^<]+)</)?.[1]?.trim();
  const ownGoal = /own-goal/i.test(block);
  if (scorer) goals.push({ side, scorer, ownGoal });
}

// Score + date from the header
const score = indexHtml
  .match(/sb-endstand[^>]*>\s*(\d+)[:](\d+)/)
  ?.slice(1, 3);
const date = indexHtml.match(/\/datum\/(\d{4}-\d{2}-\d{2})/)?.[1];
const teams = [...indexHtml.matchAll(/sb-vereinslink[^>]*>([^<]+)</g)].map(
  (t) => t[1].trim()
);

console.log(
  JSON.stringify(
    {
      id,
      date,
      teams: teams.slice(0, 2),
      score: score ? `${score[0]}-${score[1]}` : null,
      home,
      away,
      goals,
    },
    null,
    2
  )
);
