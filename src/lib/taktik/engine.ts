import { CATALOG, dealPool } from "./pool";
import {
  AUGMENT_REROLLS,
  AUGMENT_STAGES,
  BENCH,
  INCOME,
  INTEREST_CAP,
  INTEREST_STEP,
  LEVEL_SLOTS,
  LEVEL_XP,
  MANAGERS,
  MAX_ITEMS_PER_UNIT,
  MAX_LEVEL,
  REROLL_COST,
  SCOUT_CHANCE,
  SCOUT_DISCOUNT,
  SCOUT_PER_STAGE,
  PREMIUM_FIVE,
  SHOP_ODDS,
  SHOP_SIZE,
  SLOTS,
  STAGE,
  STAGE1,
  START_HP,
  WIN_GOLD,
  XP_BUY,
  XP_COST,
  XP_PER_ROUND,
  damage,
  streakGold,
  type Cost,
  type Pos,
  type RoundKind,
  type Star,
} from "./rules";
import { playMatch, type Side } from "./sim";
import type { AugmentId, CoachId, ItemId, Lobby, Manager, MatchResult, Personality, PoolPlayer, Unit } from "./types";

/**
 * Taktik Tahtası game state and rules (docs/design/taktik-tahtasi.md).
 * Pure functions over a plain Lobby object: no React, no timers. All randomness
 * goes through the lobby's seeded generator, so a lobby replays exactly.
 */

export const AUGMENTS: AugmentId[] = ["gegenpress", "bus", "longball", "academy", "cash", "signing", "wings", "crowd", "legend", "intl"];
export const COACHES: CoachId[] = ["pass", "bus", "press"];
export const ITEMS: ItemId[] = ["boot", "gloves", "shin", "band", "energy", "board"];

// ── random (mulberry32, state kept in the lobby)
export function rand(l: Lobby): number {
  l.rng = (l.rng + 0x6d2b79f5) >>> 0;
  let t = l.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T,>(l: Lobby, xs: T[]): T => xs[Math.floor(rand(l) * xs.length)];

export const roundsOf = (stage: number): RoundKind[] => (stage === 1 ? STAGE1 : STAGE);
export const roundKind = (l: Lobby): RoundKind => roundsOf(l.stage)[l.round];
export const alive = (l: Lobby) => l.managers.filter((m) => m.place === null);
export const fieldCap = (m: Manager) => LEVEL_SLOTS[m.level - 1];
export const fielded = (m: Manager) => m.units.filter((u) => u.slot !== null);
export const bench = (m: Manager) => m.units.filter((u) => u.slot === null);
export const xpToNext = (m: Manager) => (m.level >= MAX_LEVEL ? 0 : LEVEL_XP[m.level - 1]);

/** Sell value: cost for a single card; 3× cost − 1 for silver, 9× − 1 for gold. */
export const sellValue = (u: Unit) => (u.star === 1 ? u.cost : (u.star === 2 ? 3 : 9) * u.cost - 1);
const copiesIn = (s: Star) => (s === 1 ? 1 : s === 2 ? 3 : 9);

/** A new lobby: managers[0..humans-1] are people, the rest bots. */
export function newLobby(seed: number, humans: { name: string; coach: CoachId }[], bots: { name: string; personality: Personality; coach?: CoachId }[]): Lobby {
  const l: Lobby = { seed, rng: seed >>> 0, players: [], copies: [], managers: [], stage: 1, round: 0, played: 0, last: [], over: false };
  const pool = dealPool(() => rand(l));
  l.players = pool.players;
  l.copies = pool.copies;
  const people = [...humans.map((h) => ({ ...h, personality: null as Personality | null })), ...bots.map((b) => ({ ...b, coach: b.coach ?? pick(l, COACHES) }))];
  l.managers = people.slice(0, MANAGERS).map((p, id) => ({
    id,
    name: p.name,
    bot: p.personality,
    hp: START_HP,
    gold: 0,
    level: 1,
    xp: 0,
    units: [],
    items: [],
    shop: [],
    locked: false,
    streak: 0,
    coach: p.coach,
    augments: [],
    offer: null,
    place: null,
    lastOpponent: null,
    scoutsThisStage: 0,
    target: null,
    uidSeq: 0,
  }));
  // a free 1-cost player each to start with
  for (const m of l.managers) {
    const cheap = l.players.filter((p) => p.cost === 1 && l.copies[p.pid] > 0);
    const p = pick(l, cheap);
    addUnit(l, m, p);
    autoArrange(m);
  }
  startRound(l, true);
  return l;
}

// ── shop

function rollCost(l: Lobby, level: number): Cost {
  const odds = SHOP_ODDS[level - 1];
  let r = rand(l) * 100;
  for (let i = 0; i < 5; i++) if ((r -= odds[i]) < 0) return (i + 1) as Cost;
  return 1;
}

function drawCard(l: Lobby, level: number): number | null {
  for (let tries = 0; tries < 5; tries++) {
    const cost = rollCost(l, level);
    const options = l.players.filter((p) => p.cost === cost && l.copies[p.pid] > 0);
    if (!options.length) continue;
    // weighted by copies left, like a real pool
    const total = options.reduce((n, p) => n + l.copies[p.pid], 0);
    let r = rand(l) * total;
    for (const p of options) if ((r -= l.copies[p.pid]) < 0) return p.pid;
  }
  return null;
}

export function refreshShop(l: Lobby, m: Manager) {
  m.shop = Array.from({ length: SHOP_SIZE }, () => {
    const pid = drawCard(l, m.level);
    return pid === null ? null : { pid };
  });
  // from stage 2 one card in each shop is a star: a 4 (or now and then a legend, 5)
  if (l.stage >= 2) {
    const want: Cost = rand(l) < PREMIUM_FIVE[Math.min(l.stage, PREMIUM_FIVE.length - 1)] ? 5 : 4;
    const options = l.players.filter((p) => p.cost === want && l.copies[p.pid] > 0);
    if (options.length) m.shop[Math.floor(rand(l) * SHOP_SIZE)] = { pid: pick(l, options).pid };
  }
  if (m.scoutsThisStage < SCOUT_PER_STAGE && rand(l) < SCOUT_CHANCE) {
    const idx = m.shop.map((c, i) => (c ? i : -1)).filter((i) => i >= 0);
    if (idx.length) {
      m.shop[pick(l, idx)]!.scout = true;
      m.scoutsThisStage++;
    }
  }
}

/** The price shown for a shop card (a named scout card is cheaper). */
export const priceOf = (l: Lobby, pid: number, named: boolean) => Math.max(1, l.players[pid].cost - (named ? SCOUT_DISCOUNT : 0));

/** Does a guess name the scouted player? Accent- and case-insensitive, surname is enough. */
export function namesPlayer(guess: string, name: string) {
  const fold = (s: string) =>
    s
      .toUpperCase()
      .replaceAll("İ", "I")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Z ]/g, "")
      .trim();
  const g = fold(guess);
  if (g.length < 3) return false;
  const full = fold(name);
  return g === full || full.split(/\s+/).slice(-1)[0] === g || full.endsWith(" " + g);
}

function addUnit(l: Lobby, m: Manager, p: PoolPlayer, scouted = false): Unit {
  l.copies[p.pid]--;
  const u: Unit = { ...p, uid: `${m.id}-${m.uidSeq++}`, star: 1, items: [], slot: null, scouted };
  m.units.push(u);
  merge(m);
  return u;
}

/** Three of the same player and star level become one of the next level, in place of a fielded copy if any. */
function merge(m: Manager) {
  for (;;) {
    let done = true;
    for (const u of m.units) {
      if (u.star >= 3) continue;
      const same = m.units.filter((x) => x.pid === u.pid && x.star === u.star);
      if (same.length < 3) continue;
      const trio = same.sort((a, b) => Number(b.slot !== null) - Number(a.slot !== null)).slice(0, 3);
      const keep = trio[0];
      const items = trio.flatMap((x) => x.items);
      keep.star = (keep.star + 1) as Star;
      keep.items = items.slice(0, MAX_ITEMS_PER_UNIT);
      m.items.push(...items.slice(MAX_ITEMS_PER_UNIT));
      keep.scouted = trio.some((x) => x.scouted);
      m.units = m.units.filter((x) => x === keep || !trio.includes(x));
      done = false;
      break;
    }
    if (done) return;
  }
}

/** Would buying this card fit (bench space, or it completes a merge)? */
export function canTake(m: Manager, pid: number) {
  if (bench(m).length < BENCH) return true;
  return m.units.filter((x) => x.pid === pid && x.star === 1).length >= 2;
}

export type BuyResult = "ok" | "gold" | "full" | "empty";

/** Buy shop card `i`; for a scout card pass the guess (a right one makes it cheaper). */
export function buy(l: Lobby, m: Manager, i: number, guess?: string): BuyResult {
  const card = m.shop[i];
  if (!card) return "empty";
  const p = l.players[card.pid];
  const named = !!card.scout && guess !== undefined && namesPlayer(guess, p.name);
  const price = priceOf(l, card.pid, named);
  if (m.gold < price) return "gold";
  if (!canTake(m, card.pid)) return "full";
  m.gold -= price;
  m.shop[i] = null;
  addUnit(l, m, p, named);
  return "ok";
}

export function sell(l: Lobby, m: Manager, uid: string) {
  const u = m.units.find((x) => x.uid === uid);
  if (!u) return;
  m.gold += sellValue(u);
  l.copies[u.pid] += copiesIn(u.star);
  m.items.push(...u.items);
  m.units = m.units.filter((x) => x !== u);
}

export function reroll(l: Lobby, m: Manager) {
  if (m.gold < REROLL_COST) return false;
  m.gold -= REROLL_COST;
  refreshShop(l, m);
  return true;
}

function gainXp(m: Manager, xp: number) {
  if (m.level >= MAX_LEVEL) return;
  m.xp += xp;
  while (m.level < MAX_LEVEL && m.xp >= xpToNext(m)) {
    m.xp -= xpToNext(m);
    m.level++;
  }
}

export function buyXp(m: Manager) {
  if (m.gold < XP_COST || m.level >= MAX_LEVEL) return false;
  m.gold -= XP_COST;
  gainXp(m, XP_BUY);
  return true;
}

// ── the pitch

/** Move a unit to a pitch slot (swapping with whoever is there) or to the bench (`slot` null). */
export function move(m: Manager, uid: string, slot: number | null) {
  const u = m.units.find((x) => x.uid === uid);
  if (!u) return false;
  if (slot === null) {
    if (u.slot !== null && bench(m).length >= BENCH) return false;
    u.slot = null;
    return true;
  }
  const there = m.units.find((x) => x.slot === slot);
  if (there) {
    there.slot = u.slot;
    u.slot = slot;
    return true;
  }
  if (u.slot === null && fielded(m).length >= fieldCap(m)) return false;
  u.slot = slot;
  return true;
}

/** Give a spare item (index into m.items) to a unit. */
export function equip(m: Manager, itemIndex: number, uid: string) {
  const u = m.units.find((x) => x.uid === uid);
  const item = m.items[itemIndex];
  if (!u || !item || u.items.length >= MAX_ITEMS_PER_UNIT) return false;
  u.items.push(item);
  m.items.splice(itemIndex, 1);
  return true;
}

const ZONE_SLOTS = (zone: Pos) => SLOTS.map((z, i) => (z === zone ? i : -1)).filter((i) => i >= 0);
const NEAR: Record<Pos, Pos[]> = { GK: [], DEF: ["MID", "FWD"], MID: ["DEF", "FWD"], FWD: ["MID", "DEF"] };

/**
 * Put the best team on the pitch: a keeper in goal, then the strongest players in
 * their own zones (club mates count a little extra), up to the club level's limit.
 */
export function autoArrange(m: Manager) {
  for (const u of m.units) u.slot = null;
  const cap = fieldCap(m);
  const clubCount = new Map<string, number>();
  for (const u of m.units) if (u.club) clubCount.set(u.club, (clubCount.get(u.club) ?? 0) + 1);
  const value = (u: Unit) => u.cost * (u.star === 1 ? 1 : u.star === 2 ? 2.4 : 5) * 10 + (u.club && (clubCount.get(u.club) ?? 0) >= 2 ? 6 : 0) + u.items.length * 4;
  const free = new Set(SLOTS.map((_, i) => i));
  let placed = 0;
  const keeper = m.units.filter((u) => u.pos === "GK").sort((a, b) => value(b) - value(a))[0];
  if (keeper && cap > 0) {
    keeper.slot = 0;
    free.delete(0);
    placed++;
  }
  const outfield = m.units.filter((u) => u.slot === null && u.pos !== "GK").sort((a, b) => value(b) - value(a));
  for (const u of outfield) {
    if (placed >= cap) break;
    const zones: Pos[] = [u.pos, ...NEAR[u.pos]];
    const slot = zones.flatMap(ZONE_SLOTS).find((i) => free.has(i));
    if (slot === undefined) continue;
    u.slot = slot;
    free.delete(slot);
    placed++;
  }
  // nobody in goal and room left: the weakest fielded-able player goes in
  if (!keeper && placed < cap && free.has(0)) {
    const stand = m.units.filter((u) => u.slot === null).sort((a, b) => value(a) - value(b))[0];
    if (stand) stand.slot = 0;
  }
  // keep the bench within limits by selling is the caller's job
}

// ── rounds

/**
 * Put bench players into free spots on the pitch while there's room, best first,
 * each in his own zone (or a near one). Players already on the pitch stay where
 * the manager put them. Returns how many were placed.
 */
export function fillField(m: Manager): number {
  const cap = fieldCap(m);
  const taken = new Set(m.units.filter((u) => u.slot !== null).map((u) => u.slot!));
  const value = (u: Unit) => u.cost * (u.star === 1 ? 1 : u.star === 2 ? 2.4 : 5) + u.items.length * 0.4;
  let placed = 0;
  for (const u of m.units.filter((x) => x.slot === null).sort((a, b) => value(b) - value(a))) {
    if (taken.size >= cap) break;
    const zones: Pos[] = u.pos === "GK" ? ["GK"] : [u.pos, ...NEAR[u.pos]];
    const slot = zones.flatMap(ZONE_SLOTS).find((i) => !taken.has(i));
    if (slot === undefined) continue;
    u.slot = slot;
    taken.add(slot);
    placed++;
  }
  return placed;
}

/** Gold, XP, a fresh shop and a tactics card offer, at the start of each round. */
function startRound(l: Lobby, first = false) {
  for (const m of alive(l)) {
    if (!first) {
      const interest = Math.min(INTEREST_CAP, Math.floor(m.gold / INTEREST_STEP));
      m.income = { base: INCOME, interest, streak: streakGold(Math.abs(m.streak)) };
      m.gold += INCOME + interest + m.income.streak;
      gainXp(m, XP_PER_ROUND);
    } else m.gold += INCOME - 2;
    if (!m.locked || first) refreshShop(l, m);
    m.locked = false;
    if (l.round === 0 && AUGMENT_STAGES.includes(l.stage)) {
      const options = AUGMENTS.filter((a) => !m.augments.includes(a));
      const offer: AugmentId[] = [];
      while (offer.length < 3 && options.length) offer.push(options.splice(Math.floor(rand(l) * options.length), 1)[0]);
      m.offer = offer;
      m.offerRerolls = AUGMENT_REROLLS;
    }
  }
}

/** Swap one card of the offer for another the manager has neither taken nor been offered. */
export function rerollAugment(l: Lobby, m: Manager, i: number): boolean {
  if (!m.offer?.[i] || !m.offerRerolls) return false;
  const options = AUGMENTS.filter((a) => !m.augments.includes(a) && !m.offer!.includes(a));
  if (!options.length) return false;
  m.offer[i] = options[Math.floor(rand(l) * options.length)];
  m.offerRerolls--;
  return true;
}

/** Take a tactics card from the offer. */
export function chooseAugment(l: Lobby, m: Manager, i: number) {
  const a = m.offer?.[i];
  if (!a) return;
  m.offer = null;
  m.augments.push(a);
  if (a === "cash") m.gold += 15;
  if (a === "signing") {
    const fours = l.players.filter((p) => p.cost === 4 && l.copies[p.pid] > 0);
    const p = fours.length ? pick(l, fours) : null;
    if (p && canTake(m, p.pid)) addUnit(l, m, p);
  }
  if (a === "academy") {
    const ones = l.players.filter((p) => p.cost === 2 && l.copies[p.pid] >= 2);
    for (let k = 0; k < 3 && ones.length; k++) {
      const p = ones.splice(Math.floor(rand(l) * ones.length), 1)[0];
      for (let c = 0; c < 2; c++) if (bench(m).length < BENCH) addUnit(l, m, p);
    }
  }
}

function sideOf(m: Manager, name = m.name): Side {
  return { name, units: m.units, coach: m.coach, augments: m.augments };
}

/** A friendly (PvE) side for this stage and round: weaker early, stronger later. */
function friendly(l: Lobby): Side {
  const n = l.stage === 1 ? 2 + l.round : 4 + l.stage;
  const cost = Math.min(4, Math.max(1, l.stage - 1)) as Cost;
  const units: Unit[] = [];
  const zones: Pos[] = ["GK", "DEF", "FWD", "MID", "DEF", "MID", "FWD", "DEF", "MID", "DEF", "MID"];
  const used = new Set<number>();
  for (let k = 0; k < Math.min(n, 11); k++) {
    const zone = zones[k];
    const slot = ZONE_SLOTS(zone).find((i) => !used.has(i))!;
    used.add(slot);
    const c = CATALOG[Math.floor(rand(l) * CATALOG.length)];
    units.push({ ...c, cost, pos: zone, pid: -1, uid: `f-${k}`, star: 1, items: [], slot, club: null, badges: [] });
  }
  return { name: "friendly", units, coach: null, augments: [] };
}

/**
 * End the planning phase: bots act, the round's matches are played, damage and
 * gold handed out, eliminations placed, and the next round starts.
 */
export function endRound(l: Lobby, botTurn: (l: Lobby, m: Manager) => void) {
  if (l.over) return;
  for (const m of alive(l)) {
    if (m.offer) chooseAugment(l, m, 0);
    if (m.bot) botTurn(l, m);
  }
  const kind = roundKind(l);
  const results: MatchResult[] = [];
  const live = alive(l);

  if (kind === "pve") {
    for (const m of live) {
      const f = friendly(l);
      const r = playMatch(sideOf(m), f, () => rand(l));
      const won = r.winner === 0;
      let item: ItemId | null = null;
      let gold = 1;
      if (won) {
        item = pick(l, ITEMS);
        gold = l.stage === 1 ? 2 : 1 + Math.floor(rand(l) * 3);
        m.items.push(item);
      }
      m.gold += gold;
      const dmg = won || l.stage === 1 ? 0 : 2;
      if (dmg) m.hp -= dmg;
      results.push({ home: m.id, away: -1, goals: r.goals, pens: r.pens, winner: r.winner, events: r.events, awayName: "friendly", damage: dmg, drops: { gold, item } });
    }
  } else {
    // pair up, avoiding last round's opponent where possible
    const order = live.slice().sort(() => rand(l) - 0.5);
    const pairs: [Manager, Manager | null][] = [];
    while (order.length > 1) {
      const a = order.shift()!;
      let j = order.findIndex((b) => b.id !== a.lastOpponent);
      if (j < 0) j = 0;
      pairs.push([a, order.splice(j, 1)[0]]);
    }
    if (order.length) pairs.push([order[0], null]);
    for (const [a, b] of pairs) {
      // odd one out plays a copy of someone (that someone takes no damage)
      const ghost = b ?? pick(l, live.filter((x) => x !== a));
      const r = playMatch(sideOf(a), sideOf(ghost), () => rand(l));
      const diff = r.pens ? 1 : Math.abs(r.goals[0] - r.goals[1]);
      const dmg = damage(l.stage, diff);
      const loser = r.winner === 0 ? ghost : a;
      const winner = r.winner === 0 ? a : ghost;
      const hit = (m: Manager) => {
        const d = m.augments.includes("crowd") ? Math.max(1, dmg - 3) : dmg;
        m.hp -= d;
        m.streak = m.streak < 0 ? m.streak - 1 : -1;
        return d;
      };
      const win = (m: Manager) => {
        m.gold += WIN_GOLD;
        m.streak = m.streak > 0 ? m.streak + 1 : 1;
      };
      let dealt = dmg;
      if (b) {
        dealt = hit(loser);
        win(winner);
      } else if (loser === a) dealt = hit(a);
      else win(a);
      a.lastOpponent = ghost.id;
      if (b) b.lastOpponent = a.id;
      results.push({ home: a.id, away: ghost.id, goals: r.goals, pens: r.pens, winner: r.winner, events: r.events, awayName: b ? ghost.name : `${ghost.name}*`, damage: dealt });
    }
  }
  l.last = results;
  l.played++;

  // eliminations: worst health places last
  const out = alive(l)
    .filter((m) => m.hp <= 0)
    .sort((x, y) => x.hp - y.hp);
  let place = alive(l).length;
  for (const m of out) m.place = place--;
  const left = alive(l);
  if (left.length <= 1 || l.stage > 9) {
    left.sort((x, y) => y.hp - x.hp).forEach((m, i) => (m.place = i + 1));
    l.over = true;
    return;
  }

  // next round
  l.round++;
  if (l.round >= roundsOf(l.stage).length) {
    l.stage++;
    l.round = 0;
    for (const m of l.managers) m.scoutsThisStage = 0;
  }
  startRound(l);
}
