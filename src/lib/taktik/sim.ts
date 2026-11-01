import { BASE_POWER, LATE_FROM, SLICES, SLOTS, STAR_MULT, ZONE_ATK, zoneFit, type Pos } from "./rules";
import { evaluate, type Mods, type TraitState } from "./traits";
import type { AugmentId, CoachId, MatchEvent, Unit } from "./types";

/**
 * The match (docs §7): 12 attack slices, deterministic for a given random
 * source, so a phone and the server reach the same score. No live movement:
 * each slice decides possession, a chance, a shot and maybe a goal.
 */

export interface Side {
  name: string;
  units: Unit[];
  coach: CoachId | null;
  augments: AugmentId[];
}

interface Sheet {
  atk: number;
  def: number;
  poss: number;
  /** same three in the late slices (energy drinks, late bonuses) */
  lateAtk: number;
  lateDef: number;
  latePoss: number;
  keeper: number;
  avgUnit: number;
  mods: Mods;
  /** shooters and how likely each one is to be the scorer */
  shooters: { name: string; w: number }[];
  fwdCount: number;
  traits: TraitState[];
  total: number;
}

/** A unit's own power: cost, star level, club chemistry and the like. */
export const unitPower = (u: Unit) => BASE_POWER[u.cost] * STAR_MULT[u.star];

/** Team numbers for the match, from the units on the pitch. */
export function sheet(side: Side): Sheet {
  const onPitch = side.units.filter((u) => u.slot !== null);
  const boost = { club: side.augments.includes("legend"), country: side.augments.includes("intl") };
  const { traits, mods } = evaluate(onPitch, unitPower, boost);
  if (side.augments.includes("bus")) {
    mods.def *= 1.25;
    mods.atk *= 0.9;
  }
  if (side.augments.includes("longball")) {
    mods.atk *= 1.15;
    mods.poss *= 0.9;
  }
  const band = 1 + 0.05 * onPitch.reduce((n, u) => n + u.items.filter((i) => i === "band").length, 0);

  let atk = 0;
  let def = 0;
  let poss = 0;
  let lateExtra = 0;
  let keeper = 0;
  let sum = 0;
  let fwdCount = 0;
  const shooters: { name: string; w: number }[] = [];
  for (const u of onPitch) {
    const zone: Pos = SLOTS[u.slot!];
    let fit = zoneFit(u.pos, zone);
    fit = fit + (1 - fit) * mods.flex;
    if (u.items.includes("board")) fit = 1;
    let e = unitPower(u) * (mods.unit[u.uid] ?? 1) * fit * band;
    if (side.coach === "pass" && zone === "MID") e *= 1.12;
    if (side.coach === "bus" && zone === "DEF") e *= 1.08;
    sum += e;
    if (zone === "GK") {
      keeper += e + (u.items.includes("gloves") ? 25 : 0);
      continue;
    }
    if (zone === "FWD") fwdCount++;
    const a = e * ZONE_ATK[zone] + (u.items.includes("boot") ? 20 : 0);
    const d = e * (1 - ZONE_ATK[zone]) + (u.items.includes("shin") ? 20 : 0);
    atk += a;
    def += d;
    if (zone === "MID") poss += e;
    if (zone === "DEF") poss += e * 0.3;
    if (u.items.includes("energy")) lateExtra += 0.2 * e;
    shooters.push({ name: u.name, w: a });
  }
  const lateMult = 1 + mods.late;
  const share = atk + def > 0 ? atk / (atk + def) : 0.5;
  return {
    atk: atk * mods.atk,
    def: def * mods.def,
    poss: poss * mods.poss,
    lateAtk: (atk + lateExtra * share) * mods.atk * lateMult,
    lateDef: (def + lateExtra * (1 - share)) * mods.def * lateMult,
    latePoss: poss * mods.poss * lateMult,
    keeper,
    avgUnit: onPitch.length ? sum / onPitch.length : 1,
    mods,
    shooters,
    fwdCount,
    traits,
    total: sum,
  };
}

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
/** equal teams attack at about 1: attack shares sum smaller than defence shares */
const Q0 = 1.25;

export interface Played {
  goals: [number, number];
  pens: [number, number] | null;
  winner: 0 | 1;
  events: MatchEvent[];
}

/** Play a match. `rand` must be the lobby's seeded random source. */
export function playMatch(a: Side, b: Side, rand: () => number): Played {
  const s = [sheet(a), sheet(b)];
  const sides = [a, b];
  // a team facing a stronger one gets its "big game" bonus
  for (const k of [0, 1] as const) {
    if (s[1 - k].total > s[k].total) {
      const m = s[k].mods.bigGame;
      s[k].atk *= m;
      s[k].def *= m;
      s[k].lateAtk *= m;
      s[k].lateDef *= m;
    }
    if (sides[1 - k].augments.includes("gegenpress")) {
      s[k].poss *= 0.9;
      s[k].latePoss *= 0.9;
    }
    if (sides[1 - k].coach === "press") {
      s[k].poss *= 0.85;
      s[k].latePoss *= 0.85;
    }
  }

  const goals: [number, number] = [0, 0];
  const events: MatchEvent[] = [];
  const shieldUsed = [false, false];
  const busUsed = [false, false];
  const pressLeft = [2, 2];
  const genius = [s[0].mods.genius, s[1].mods.genius];

  const pickShooter = (k: 0 | 1) => {
    const list = s[k].shooters;
    const total = list.reduce((n, x) => n + x.w, 0);
    let r = rand() * total;
    for (const x of list) if ((r -= x.w) <= 0) return x.name;
    return list[0]?.name ?? "—";
  };

  const attack = (k: 0 | 1, slice: number, boost = 1) => {
    const o = (1 - k) as 0 | 1;
    // nobody on the pitch to shoot
    if (!s[k].shooters.length) return false;
    const late = slice >= LATE_FROM;
    let myAtk = late ? s[k].lateAtk : s[k].atk;
    const theirDef = late ? s[o].lateDef : s[o].def;
    if (goals[k] < goals[o]) myAtk *= s[k].mods.behind;
    if (sides[k].augments.includes("wings") && s[k].fwdCount >= 2) myAtk *= 1.15;
    const q = (Q0 * myAtk * boost) / Math.max(1, theirDef);
    let shot = rand() < clamp(0.2 + 0.3 * q, 0.1, 0.85);
    if (!shot && genius[k] > 0) {
      genius[k]--;
      shot = true;
    }
    if (!shot) return false;
    const kRel = Math.max(0.15, s[o].keeper / Math.max(1, s[k].avgUnit));
    let p = q / (q + kRel) + s[k].mods.setPiece + s[k].mods.accuracy * 0.3;
    if (slice >= SLICES - 2) p += s[k].mods.lastMinute;
    const name = pickShooter(k);
    if (rand() >= clamp(p, 0.05, 0.9)) {
      events.push({ slice, side: k, kind: rand() < 0.5 ? "save" : "miss", name });
      return false;
    }
    if (s[o].mods.shield && !shieldUsed[o]) {
      shieldUsed[o] = true;
      events.push({ slice, side: k, kind: "shield", name });
      return false;
    }
    // the "bus" coach cancels the first goal after half time
    if (sides[o].coach === "bus" && !busUsed[o] && slice >= SLICES / 2) {
      busUsed[o] = true;
      events.push({ slice, side: k, kind: "shield", name });
      return false;
    }
    goals[k]++;
    events.push({ slice, side: k, kind: "goal", name });
    return true;
  };

  for (let slice = 0; slice < SLICES; slice++) {
    const late = slice >= LATE_FROM;
    const w0 = late ? s[0].latePoss : s[0].poss;
    const w1 = late ? s[1].latePoss : s[1].poss;
    let p0 = clamp(w0 / Math.max(1, w0 + w1) + (rand() - 0.5) * 0.3, 0.1, 0.9);
    // the "pass master" keeps the ball for two slices mid-game
    if (slice === 4 || slice === 5) {
      const has0 = a.coach === "pass";
      const has1 = b.coach === "pass";
      if (has0 !== has1) p0 = has0 ? 1 : 0;
    }
    const k: 0 | 1 = rand() < p0 ? 0 : 1;
    const scored = attack(k, slice);
    if (scored) continue;
    // a quick break the other way
    const o = (1 - k) as 0 | 1;
    let counter = s[o].mods.counter;
    if (sides[o].coach === "press" && pressLeft[o] > 0 && slice >= 3) {
      pressLeft[o]--;
      counter = 1;
    }
    if (counter > 0 && rand() < counter) attack(o, slice, 1.1);
  }

  let pens: [number, number] | null = null;
  let winner: 0 | 1;
  if (goals[0] === goals[1]) {
    pens = [0, 0];
    const taker = (k: 0 | 1) => clamp(0.75 + 0.1 * (s[k].avgUnit - s[1 - k].keeper) / Math.max(40, s[k].avgUnit), 0.55, 0.9);
    for (let i = 0; i < 5 || pens[0] === pens[1]; i++) {
      if (rand() < taker(0)) pens[0]++;
      if (rand() < taker(1)) pens[1]++;
      if (i > 30) break;
    }
    if (pens[0] === pens[1]) pens[rand() < 0.5 ? 0 : 1]++;
    winner = pens[0] > pens[1] ? 0 : 1;
  } else winner = goals[0] > goals[1] ? 0 : 1;

  return { goals, pens, winner, events };
}
