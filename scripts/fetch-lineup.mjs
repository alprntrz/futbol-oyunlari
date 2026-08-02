#!/usr/bin/env node
/**
 * Fetch starting XIs from a Wikipedia match article (factual match data).
 *
 * Usage: node scripts/fetch-lineup.mjs "2005 UEFA Champions League final"
 *
 * Parses the wikitext lineup tables (rows like:
 *   |GK ||'''1''' ||{{flagicon|BRA}} [[Cláudio Taffarel]]
 * ) and prints both teams' starters as JSON drafts, plus the raw goals
 * lines from the football box so scorers can be cross-checked.
 */

const title = process.argv[2];
if (!title) {
  console.error("Usage: node scripts/fetch-lineup.mjs <wikipedia page title>");
  process.exit(1);
}

const api = `https://en.wikipedia.org/w/api.php?action=parse&prop=wikitext&format=json&formatversion=2&redirects=1&page=${encodeURIComponent(title)}`;

const res = await fetch(api, {
  headers: { "User-Agent": "futbol-oyunlari-dataset/1.0 (personal project)" },
});
if (!res.ok) {
  console.error(`HTTP ${res.status}`);
  process.exit(1);
}
const data = await res.json();
if (data.error) {
  console.error("API error:", data.error.info);
  process.exit(1);
}
const text = data.parse.wikitext;

/** Strip wiki markup from a player cell, return { name, captain, note } */
function parsePlayerCell(cell) {
  const captain =
    /\(\s*\[\[Captain \(association football\)\|c\]\]\s*\)/i.test(cell) ||
    /\|c\]\]\)/.test(cell);
  // first [[link]] or [[link|display]]
  const m = cell.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
  if (!m) return null;
  // skip the captain-article link itself
  if (/^Captain \(association football\)/.test(m[1])) {
    const rest = cell.replace(m[0], "");
    return parsePlayerCell(rest);
  }
  const name = (m[2] || m[1]).trim();
  const article = m[1].trim();
  const subOff = /\{\{(sub off|suboff)/i.test(cell);
  const sentOff = /sent off|red card/i.test(cell);
  return { name, article, captain, subOff, sentOff };
}

const POS = new Set([
  "GK", "RB", "CB", "LB", "SW", "RWB", "LWB", "DF",
  "DM", "CM", "RM", "LM", "AM", "MF",
  "RW", "LW", "CF", "SS", "ST", "FW", "RF", "LF",
  // pre-1970s era position codes (half-backs, inside/outside forwards)
  "RH", "LH", "CH", "OR", "OL", "IR", "IL",
]);

const lines = text.split("\n");
const blocks = [];
let current = [];

for (const raw of lines) {
  const line = raw.trim();
  // typical row:  |GK ||'''1''' ||{{flagicon|BRA}} [[Cláudio Taffarel]]
  const m = line.match(
    /^\|\s*([A-Z]{2,3})\s*\|\|\s*'{0,3}(\d+)'{0,3}\s*\|\|(.*)$/
  );
  if (m && POS.has(m[1])) {
    const player = parsePlayerCell(m[3]);
    if (player) {
      current.push({ pos: m[1], number: Number(m[2]), ...player });
      continue;
    }
  }
  // end of a block (substitutes header, manager row, table end)
  if (current.length >= 11) {
    blocks.push(current.slice(0, 11));
    current = [];
  } else if (
    current.length > 0 &&
    /substitute|manager|\|\}/i.test(line)
  ) {
    current = [];
  }
}
if (current.length >= 11) blocks.push(current.slice(0, 11));

// goals lines from the football box for scorer cross-check
const goalLines = lines
  .filter((l) => /^\s*\|\s*goals[12]\s*=/.test(l))
  .map((l) => l.trim());

// score + teams from the football box
const teamLines = lines
  .filter((l) => /^\s*\|\s*(team[12]|score)\s*=/.test(l))
  .map((l) => l.trim());

console.log(
  JSON.stringify(
    {
      page: data.parse.title,
      box: teamLines,
      goals: goalLines,
      teams: blocks.map((b) =>
        b.map(
          (p) =>
            `${p.pos}\t#${p.number}\t${p.name}${p.captain ? " (C)" : ""}${p.sentOff ? " [RED]" : ""}`
        )
      ),
    },
    null,
    2
  )
);
