/**
 * Taktik Tahtası balance: plays all-bot lobbies and prints how games go.
 * Run from the repo root:
 *   node --import ./scripts/lib/alias.mjs mobile/scripts/taktik-sim.mts [lobbies]
 * Targets (docs §14): ~20–24 rounds a game; top-4 rate per personality and per
 * country style 40–60 %; scout-savvy managers +3–5 % top 4; about 1.3–1.8 goals a side.
 */
import { botScout, botTurn } from "../../src/lib/taktik/bot.ts";
import { alive, endRound, newLobby } from "../../src/lib/taktik/engine.ts";
import { STYLES } from "../../src/lib/taktik/traits.ts";
import { sheet } from "../../src/lib/taktik/sim.ts";
import type { Personality } from "../../src/lib/taktik/types.ts";

const LOBBIES = Number(process.argv[2] ?? 200);
const KINDS: Personality[] = ["loyal", "econ", "roller", "opportunist"];

const rounds: number[] = [];
const stages: number[] = [];
const goals: number[] = [];
let pens = 0;
let matches = 0;
const top4 = new Map<string, [number, number]>(); // key → [top4, games]
const count = (k: string, good: boolean) => {
  const c = top4.get(k) ?? [0, 0];
  c[0] += good ? 1 : 0;
  c[1]++;
  top4.set(k, c);
};
let golds = 0;
let goldFive = 0;
const levels: number[] = [];

for (let g = 0; g < LOBBIES; g++) {
  const bots = Array.from({ length: 8 }, (_, i) => ({ name: `bot${i}`, personality: KINDS[i % 4] }));
  const l = newLobby(1000 + g * 7919, [], bots);
  // half the managers name scout cards well, half rarely
  l.managers.forEach((m) => botScout.set(m.id, m.id % 2 ? 0.9 : 0.1));
  const styleOf = new Map<number, string>();
  while (!l.over) {
    endRound(l, botTurn);
    for (const r of l.last) {
      if (r.away === -1) continue;
      matches++;
      goals.push(r.goals[0], r.goals[1]);
      if (r.pens) pens++;
    }
    // remember each manager's strongest active country style when they go out / at the end
    for (const m of l.managers) {
      if (styleOf.has(m.id) && m.place !== null) continue;
      const s = sheet({ name: m.name, units: m.units, coach: m.coach, augments: m.augments });
      const style = s.traits.find((t) => t.kind === "country" && t.tier > 0 && STYLES[t.id]);
      styleOf.set(m.id, style ? style.id : "none");
    }
  }
  rounds.push(l.played);
  stages.push(l.stage);
  for (const m of l.managers) {
    const good = (m.place ?? 9) <= 4;
    count(`personality:${m.bot}`, good);
    count(`scout:${m.id % 2 ? "savvy" : "rarely"}`, good);
    count(`coach:${m.coach}`, good);
    count(`style:${styleOf.get(m.id)}`, good);
    for (const a of m.augments) count(`augment:${a}`, good);
    levels.push(m.level);
    for (const u of m.units) {
      if (u.star === 3) golds++;
      if (u.star === 3 && u.cost === 5) goldFive++;
    }
  }
  void alive;
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
console.log(`lobbies ${LOBBIES}`);
console.log(`rounds per game  avg ${avg(rounds).toFixed(1)}  min ${Math.min(...rounds)}  max ${Math.max(...rounds)}  (≈ ${(avg(rounds) * 38 / 60).toFixed(1)} min at ~38 s a round: 25 s set-up + a 13 s match)`);
console.log(`last stage       avg ${avg(stages).toFixed(1)}`);
console.log(`goals per side   ${avg(goals).toFixed(2)}   shoot-outs ${((pens / Math.max(1, matches)) * 100).toFixed(0)} %`);
console.log(`final level      ${avg(levels).toFixed(1)}   gold cards per lobby ${(golds / LOBBIES).toFixed(2)}   gold 5-costs per 50 lobbies ${((goldFive / LOBBIES) * 50).toFixed(1)}`);
console.log("\ntop-4 rate");
for (const [k, [t, n]] of [...top4].sort()) if (n >= 20) console.log(`  ${k.padEnd(26)} ${((t / n) * 100).toFixed(0).padStart(3)} %  (${n})`);
