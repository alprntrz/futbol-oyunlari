#!/usr/bin/env node
/**
 * List all matches between two clubs from Transfermarkt's head-to-head page.
 * Usage: node scripts/list-derbies.mjs <clubId1> <clubId2>
 * (Galatasaray 141, Fenerbahce 36, Besiktas 114)
 * Prints one JSON per line: {date, comp, home, away, score, id}
 */

const [a, b] = process.argv.slice(2);
if (!a || !b) {
  console.error("Usage: node scripts/list-derbies.mjs <clubId1> <clubId2>");
  process.exit(1);
}

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

const url = `https://www.transfermarkt.us/vergleich/vereineBegegnungen/statistik/${a}_${b}`;
const html = await (await fetch(url, { headers: HEADERS })).text();

// Rows: date cell, club links, result link with spielbericht id
const rows = html.split("<tr").slice(1);
for (const row of rows) {
  const idm = row.match(/spielbericht\/index\/spielbericht\/(\d+)/);
  if (!idm) continue;
  const date = row.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/)?.[1] ?? null;
  const clubs = [...row.matchAll(/vereinsname[^>]*>\s*<a[^>]*>([^<]+)</g)].map(
    (m) => m[1].trim()
  );
  const score = row.match(/spielbericht\/(?:index\/spielbericht\/)\d+"[^>]*>([\d:]+)/)?.[1]
    ?? row.match(/>(\d+:\d+)</)?.[1] ?? null;
  const comp = row.match(/wettbewerb\/[A-Z0-9]+"[^>]*title="([^"]+)"/)?.[1]
    ?? row.match(/title="([^"]*Lig[^"]*|[^"]*Kupa[^"]*|[^"]*Cup[^"]*)"/)?.[1]
    ?? null;
  console.log(JSON.stringify({ date, comp, clubs, score, id: idm[1] }));
}
