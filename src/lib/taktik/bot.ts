import { autoArrange, bench, buy, buyXp, chooseAugment, priceOf, rand, reroll, sell, equip, fielded, sellValue } from "./engine";
import { BENCH, REROLL_COST, SAVINGS, XP_COST } from "./rules";
import type { Lobby, Manager, Personality, Unit } from "./types";

/**
 * House managers (docs §12). Each has a personality:
 *   loyal: picks a club early and collects it;
 *   econ: sits on 50 gold, levels on time;
 *   roller: levels fast and spends on rolls;
 *   opportunist: takes the best card on offer.
 * `scout` is how often the bot names a scout card (for the balance sim).
 */

/** level a bot wants by stage / round */
const PLAN: Record<Personality, number[]> = {
  // index: stage (1-based); value: target level at that stage
  loyal: [0, 3, 5, 6, 7, 8, 8, 9, 9, 9],
  econ: [0, 3, 4, 6, 7, 8, 9, 9, 9, 9],
  roller: [0, 3, 5, 7, 8, 8, 9, 9, 9, 9],
  opportunist: [0, 3, 5, 6, 7, 8, 8, 9, 9, 9],
};
const RESERVE: Record<Personality, number> = { loyal: 30, econ: 50, roller: 10, opportunist: 30 };

export const botScout = new Map<number, number>();

function wants(m: Manager, l: Lobby, pid: number) {
  const p = l.players[pid];
  let v = 0;
  const same = m.units.filter((u) => u.pid === pid);
  if (same.length) v += 6 + same.length * 4;
  if (m.target && p.club === m.target) v += 8;
  const myCountries = new Map<string, number>();
  const myClubs = new Map<string, number>();
  for (const u of fielded(m)) {
    myCountries.set(u.country, (myCountries.get(u.country) ?? 0) + 1);
    if (u.club) myClubs.set(u.club, (myClubs.get(u.club) ?? 0) + 1);
  }
  v += (myCountries.get(p.country) ?? 0) * 2 + (p.club ? (myClubs.get(p.club) ?? 0) * 3 : 0);
  v += p.cost * 2;
  // a team needs a keeper
  if (p.pos === "GK" && !m.units.some((u) => u.pos === "GK")) v += 10;
  return v;
}

function buyRound(l: Lobby, m: Manager, reserve: number) {
  const order = m.shop
    .map((c, i) => ({ c, i }))
    .filter((x) => x.c)
    .sort((a, b) => wants(m, l, b.c!.pid) - wants(m, l, a.c!.pid));
  for (const { c, i } of order) {
    // decide at the full price; naming a scout card only makes it cheaper
    const full = priceOf(l, c!.pid, false);
    const v = wants(m, l, c!.pid);
    if (m.gold - full - reserve < 0 && v < 14) continue;
    const named = !!c!.scout && rand(l) < (botScout.get(m.id) ?? 0.5);
    if (m.gold < priceOf(l, c!.pid, named)) continue;
    if (bench(m).length >= BENCH) sellWorst(m, l);
    buy(l, m, i, named ? l.players[c!.pid].name : undefined);
  }
}

function sellWorst(m: Manager, l: Lobby) {
  const worst = bench(m)
    .filter((u) => m.units.filter((x) => x.pid === u.pid).length === 1)
    .sort((a, b) => sellValue(a) - sellValue(b))[0];
  if (worst) sell(l, m, worst.uid);
}

/** One planning phase for a house manager. */
export function botTurn(l: Lobby, m: Manager) {
  const kind = m.bot!;
  if (m.offer) chooseAugment(l, m, Math.floor(rand(l) * m.offer.length));
  if (kind === "loyal" && !m.target) {
    const clubs = m.units.map((u) => u.club).filter(Boolean) as string[];
    m.target = clubs[0] ?? null;
  }
  const hurt = m.hp < 40;
  const reserve = hurt ? 0 : Math.min(RESERVE[kind], SAVINGS.find((s) => m.gold >= s.from)?.from ?? 0);
  buyRound(l, m, reserve);

  // level up on plan
  while (m.level < PLAN[kind][Math.min(9, l.stage)] && m.gold - XP_COST >= (hurt ? 0 : reserve)) buyXp(m);

  // roll when rich, hurt, or (roller) once the level is reached
  let rolls = 0;
  const rollable = () => m.gold - REROLL_COST >= (hurt ? 0 : kind === "roller" ? 10 : RESERVE[kind]);
  while (rollable() && rolls < (hurt ? 6 : kind === "roller" ? 4 : 2) && (hurt || m.gold > RESERVE[kind] + 10 || kind === "roller")) {
    reroll(l, m);
    buyRound(l, m, hurt ? 0 : reserve);
    rolls++;
  }

  autoArrange(m);
  while (bench(m).length > BENCH) sellWorst(m, l);

  // items: gloves to the keeper, the rest to the strongest players
  for (let i = m.items.length - 1; i >= 0; i--) {
    const item = m.items[i];
    const team = fielded(m).filter((u) => u.items.length < 2);
    const pickFor = (us: Unit[]) => us.sort((a, b) => b.cost * b.star - a.cost * a.star)[0];
    const to = item === "gloves" ? team.find((u) => u.slot === 0) : pickFor(team.filter((u) => u.slot !== 0));
    if (to) equip(m, i, to.uid);
  }
}
