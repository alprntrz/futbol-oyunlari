/**
 * Shared Transfermarkt helpers for the derby builders (build-derbies.mjs for
 * the Turkish big three, build-league-derbies.mjs for the other leagues):
 * throttled fetch, match-sheet parser, formation arranger, answer derivation.
 */

import { execFile } from "child_process";
import { promisify } from "util";
import { FORMATIONS } from "../../src/lib/formations.ts";

const execFileP = promisify(execFile);

export const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));


// Transfermarkt soft-blocks bursts with 403/429; space requests out and back
// off progressively when it does.
const MIN_GAP_MS = Number(process.env.TM_GAP_MS ?? 2200);
let lastReq = 0;

export async function get(url) {
  for (let i = 0; i < 6; i++) {
    const wait = lastReq + MIN_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastReq = Date.now();
    try {
      // curl, not fetch: its -m deadline is enforced even when a connection
      // stalls mid-response (Node's fetch hung for hours on one).
      const { stdout } = await execFileP(
        "curl",
        ["-sS", "-m", "40", "-A", HEADERS["User-Agent"], "-H", `Accept-Language: ${HEADERS["Accept-Language"]}`,
         "-w", "\n%{http_code}", url],
        { maxBuffer: 64 * 1024 * 1024 }
      );
      const cut = stdout.lastIndexOf("\n");
      if (stdout.slice(cut + 1).trim() === "200") return stdout.slice(0, cut);
    } catch {
      // timeout / connection reset: treat like a soft block
    }
    await sleep(15000 * (i + 1));
  }
  throw new Error(`fetch failed: ${url}`);
}

export function normalizeAnswer(raw) {
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

/** Players fans know by a first name / nickname rather than the surname. */
export const ANSWER_OVERRIDES = {
  "Sokratis Papastathopoulos": "SOKRATIS",
  "Kepa Arrizabalaga": "KEPA",
};

const PARTICLES = new Set([
  "de", "di", "da", "do", "dos", "das", "del", "della", "van", "von", "der",
  "den", "ter", "ten", "el", "al", "le", "la", "bin", "ben", "dal", "dalla",
]);
const SUFFIXES = new Set(["junior", "jr", "jr.", "neto", "filho", "sobrinho"]);

/**
 * Answer to type for a player: the surname as fans say it. Keeps the particle
 * ("Kevin De Bruyne" → "DE BRUYNE", spaced, like the curated matches), drops a
 * trailing Junior/Neto ("Vinicius Junior" → "VINICIUS"), and shortens very long
 * hyphenated surnames to their last part.
 */
export function answerFor(fullName) {
  if (ANSWER_OVERRIDES[fullName]) return ANSWER_OVERRIDES[fullName];
  const tokens = fullName.trim().split(/\s+/);
  if (tokens.length === 1) return normalizeAnswer(tokens[0]);
  let end = tokens.length;
  if (end > 1 && SUFFIXES.has(tokens[end - 1].toLowerCase())) end--;
  let start = end - 1;
  while (start > 0 && PARTICLES.has(tokens[start - 1].toLowerCase())) start--;
  const words = tokens.slice(start, end).map(normalizeAnswer).filter(Boolean);
  let answer = words.join(" ");
  if (answer.replace(/ /g, "").length > 11 && tokens[end - 1].includes("-")) {
    answer = normalizeAnswer(tokens[end - 1].split("-").pop());
  }
  return answer || normalizeAnswer(fullName);
}

const DF = new Set(["Goalkeeper", "Sweeper", "Right-Back", "Centre-Back", "Left-Back"]);
const MF = new Set(["Defensive Midfield", "Central Midfield", "Right Midfield", "Left Midfield", "Attacking Midfield"]);
const FW = new Set(["Right Winger", "Left Winger", "Second Striker", "Centre-Forward"]);

/**
 * Pick a formation key + ordered slot assignment from TM position labels.
 * Returns { formation, ordered } or null when the shape can't be mapped.
 */
export function arrange(players, opts = {}) {
  const gk = players.filter((p) => p.pos === "Goalkeeper");
  if (gk.length !== 1) return null;
  const df = players.filter((p) => p.pos !== "Goalkeeper" && DF.has(p.pos));
  const mf = players.filter((p) => MF.has(p.pos));
  const fw = players.filter((p) => FW.has(p.pos));
  if (1 + df.length + mf.length + fw.length !== 11) return null;

  // Real left/right from the formation graphic when available. The keeper is
  // normally drawn at the bottom (team's right = larger `left`); if the graphic
  // is flipped (keeper at the top) the sides mirror.
  const hasXY = players.every((p) => typeof p.x === "number");
  const mirrored = hasXY && gk[0].y < 50;
  const rightFirst = (a, b) => (mirrored ? a.x - b.x : b.x - a.x);
  if (hasXY) for (const line of [df, mf, fw]) line.sort(rightFirst);

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
    // Centre-backs. With graphic coordinates: place them by their real sides
    // ([right, left] in a back four, [right, centre, left] in a back three;
    // 3-5-2's slots are [centre, right, left]). Without coordinates fall back to
    // Transfermarkt's list order, which runs left->right for a back four (the
    // pitch layout wants right-first, hence the swap); back-three order is
    // unreliable there, so it is left as listed.
    if (formation.startsWith("4-")) {
      const cb = [ordered[2], ordered[3]];
      if (hasXY) cb.sort(rightFirst);
      else cb.reverse();
      [ordered[2], ordered[3]] = cb;
    } else if (formation.startsWith("3-") && hasXY) {
      const [r, c, l] = ordered.slice(1, 4).sort(rightFirst);
      [ordered[1], ordered[2], ordered[3]] = formation === "3-5-2" ? [c, r, l] : [r, c, l];
    }
    return { formation, ordered };
  };

  const D = df.length, M = mf.length, F = fw.length;
  const dm = mf.filter((p) => p.pos === "Defensive Midfield").length;

  if (D === 4 && M === 2 && F === 4) {
    // Transfermarkt files the wingers and the number 10 under forwards, so in
    // modern matches this shape is really a 4-2-3-1 (a genuine 4-2-4 is 1970s).
    if (opts.modern && fw.some((p) => p.pos === "Right Winger") && fw.some((p) => p.pos === "Left Winger"))
      return build("4-2-3-1", [
        ["df", ["Right-Back"]], ["df", ["Centre-Back"]], ["df", ["Centre-Back"]], ["df", ["Left-Back"]],
        ["mf", ["Defensive Midfield", "Central Midfield"]], ["mf", ["Central Midfield", "Defensive Midfield"]],
        ["fw", ["Right Winger"]], ["fw", ["Second Striker", "Centre-Forward"]], ["fw", ["Left Winger"]],
        ["fw", ["Centre-Forward", "Second Striker"]],
      ]);
    return build("4-2-4", [
      ["df", ["Right-Back"]], ["df", ["Centre-Back"]], ["df", ["Centre-Back"]], ["df", ["Left-Back"]],
      ["mf", ["Defensive Midfield", "Central Midfield"]], ["mf", ["Central Midfield"]],
      ["fw", ["Right Winger"]], ["fw", ["Centre-Forward", "Second Striker"]],
      ["fw", ["Centre-Forward", "Second Striker"]], ["fw", ["Left Winger"]],
    ]);
  }
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
  if (D === 3 && M === 6 && F === 1)
    return build("3-4-2-1", [
      ["df", ["Centre-Back", "Sweeper"]], ["df", ["Centre-Back"]], ["df", ["Centre-Back"]],
      ["mf", ["Right Midfield"]], ["mf", ["Left Midfield"]],
      ["mf", ["Defensive Midfield", "Central Midfield"]], ["mf", ["Central Midfield", "Defensive Midfield"]],
      ["mf", ["Attacking Midfield"]], ["mf", ["Attacking Midfield"]],
      ["fw", ["Centre-Forward", "Second Striker"]],
    ]);
  if (D === 5 && M === 2 && F === 3)
    return build("3-4-3", [
      ["df", ["Centre-Back", "Sweeper"]], ["df", ["Centre-Back"]], ["df", ["Centre-Back"]],
      ["df", ["Right-Back"]], ["mf", ["Central Midfield", "Defensive Midfield"]],
      ["mf", ["Central Midfield", "Defensive Midfield"]], ["df", ["Left-Back"]],
      ["fw", ["Right Winger"]], ["fw", ["Centre-Forward", "Second Striker"]], ["fw", ["Left Winger"]],
    ]);
  if (D === 3 && M === 4 && F === 3 && mf.some((p) => p.pos === "Right Midfield") && mf.some((p) => p.pos === "Left Midfield"))
    return build("3-4-3", [
      ["df", ["Centre-Back", "Sweeper"]], ["df", ["Centre-Back"]], ["df", ["Centre-Back"]],
      ["mf", ["Right Midfield"]], ["mf", ["Central Midfield", "Defensive Midfield"]],
      ["mf", ["Central Midfield", "Defensive Midfield", "Attacking Midfield"]], ["mf", ["Left Midfield"]],
      ["fw", ["Right Winger"]], ["fw", ["Centre-Forward", "Second Striker"]], ["fw", ["Left Winger"]],
    ]);
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

export function toDDMMYYYY(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export function seasonOf(iso) {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  return m >= 7 ? `${y}/${String((y + 1) % 100).padStart(2, "0")}` : `${y - 1}/${String(y % 100).padStart(2, "0")}`;
}

/**
 * Player positions from the formation graphic on a match's index page
 * (`top`/`left` in %). Returns { home, away } arrays of { number, x, y } for the
 * 22 starters, or null when the page has no graphic (older matches).
 */
export function parsePitch(indexHtml) {
  const blocks = [];
  for (const b of indexHtml.matchAll(
    /<div class="formation-player-container"\s+style="([^"]*)">([\s\S]*?)<\/span>/g
  )) {
    const y = b[1].match(/top:\s*([\d.]+)%/)?.[1];
    const x = b[1].match(/left:\s*([\d.]+)%/)?.[1];
    const number = b[2].match(/tm-shirt-number[^>]*>\s*(\d+)\s*</)?.[1];
    if (x && y && number) blocks.push({ number: Number(number), x: Number(x), y: Number(y) });
  }
  if (blocks.length !== 22) return null;
  const shapes = [...indexHtml.matchAll(/Line-up:\s*([^<\n]+)/g)].map((m) => m[1].trim());
  return { home: blocks.slice(0, 11), away: blocks.slice(11), homeShape: shapes[0], awayShape: shapes[1] };
}

function attachPitch(md, pitch) {
  md.pitchChecked = true;
  if (!pitch) return md;
  md.homeShape = pitch.homeShape;
  md.awayShape = pitch.awayShape;
  for (const [xi, spots] of [[md.homeXI, pitch.home], [md.awayXI, pitch.away]]) {
    for (const p of xi) {
      const s = spots.find((q) => q.number === p.number);
      if (s) { p.x = s.x; p.y = s.y; }
    }
  }
  return md;
}

/** Add formation-graphic coordinates to a match fetched before we parsed them. */
export async function enrichPitch(md) {
  const html = await get(`https://www.transfermarkt.us/x_y/index/spielbericht/${md.id}`);
  return attachPitch(md, parsePitch(html));
}

export async function fetchMatch(id) {
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
  return attachPitch(
    {
      id,
      date,
      home: teams[0],
      away: teams[1],
      score,
      homeXI: players.slice(0, 11),
      awayXI: players.slice(11, 22),
      goals,
    },
    parsePitch(indexHtml)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Placement from the formation graphic

/** Minimum-cost assignment of rows to columns (square matrix), Hungarian method. */
function hungarian(cost) {
  const n = cost.length, INF = 1e18;
  const u = Array(n + 1).fill(0), v = Array(n + 1).fill(0);
  const p = Array(n + 1).fill(0), way = Array(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = Array(n + 1).fill(INF), used = Array(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = INF, j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
  }
  const assign = Array(n);
  for (let j = 1; j <= n; j++) assign[p[j] - 1] = j - 1;
  return assign;
}

const MAX_DECLARED_FIT = 160;

/** TM caption ("4-4-2 diamond", "3-5-2 flat") → one of our FormationKeys, or null. */
function shapeKey(shape) {
  const m = shape?.match(/^(\d(?:-\d)+)\s*(.*)$/);
  if (!m) return null;
  const [, nums, tag] = m;
  if (nums === "4-4-2" && /diamond/i.test(tag)) return "4-3-1-2";
  if (nums === "4-1-2-1-2") return "4-3-1-2";
  if (nums === "3-4-3" && /diamond/i.test(tag)) return "3-4-3d";
  return FORMATIONS[nums] ? nums : null;
}

/**
 * Place the XI from their real graphic positions: normalise to the game's pitch
 * space (team defends the bottom, its right = viewer's right), then pick the
 * FORMATIONS template whose slots fit best (Hungarian assignment, squared
 * distance). Returns { formation, ordered, fit } — `fit` is the mean squared
 * distance per outfield player — or null without coordinates.
 */
export function arrangeByPitch(players, shape) {
  if (players.length !== 11 || !players.every((p) => typeof p.x === "number")) return null;
  const gks = players.filter((p) => p.pos === "Goalkeeper");
  if (gks.length !== 1) return null;
  const gk = gks[0];
  const flip = gk.y < 50; // graphic drawn with the keeper at the top: rotate 180°
  const spot = (p) => {
    const x = flip ? 80 - p.x : p.x;
    const y = flip ? 80 - p.y : p.y;
    return { x: (x / 80) * 100, y: 92 - (80 - y) * 0.9 };
  };
  const outfield = players.filter((p) => p !== gk);
  const pts = outfield.map(spot);

  const fit = (formations) => {
    let best = null;
    for (const formation of formations) {
      const targets = FORMATIONS[formation].slice(1);
      const cost = pts.map((a) => targets.map((t) => (a.x - t.x) ** 2 + (a.y - t.y) ** 2));
      const assign = hungarian(cost);
      const total = assign.reduce((sum, col, row) => sum + cost[row][col], 0);
      if (!best || total < best.total) best = { formation, assign, total };
    }
    return best;
  };
  // Prefer the shape the coach lined up in (TM's "Line-up: 3-5-2 flat" caption);
  // fall back to the best-fitting template when it is unknown or fits badly.
  const declared = shapeKey(shape);
  let best = declared ? fit([declared]) : null;
  if (!best || best.total / 10 > MAX_DECLARED_FIT) best = fit(Object.keys(FORMATIONS));
  const ordered = [gk];
  for (let slot = 0; slot < 10; slot++) ordered.push(outfield[best.assign.indexOf(slot)]);
  return { formation: best.formation, ordered, fit: best.total / 10 };
}
