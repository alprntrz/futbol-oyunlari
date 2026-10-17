/**
 * Dribbling Rush (docs/design/futbol-kosu.md): an endless three-lane runner. Pure and
 * deterministic (seeded); every function is a worklet so the phone runs the whole loop on
 * the UI thread (mobile/src/app/kosu/oyun.tsx). The state is one plain object mutated in place.
 *
 * World units are metres: x across (lanes at -LANE, 0, +LANE), y up, z forward.
 */

export const LANE = 2.4;
/** run speed at the start and the ceiling (m/s), and how fast it climbs */
export const SPEED0 = 11;
export const SPEED_MAX = 27;
const ACCEL = 0.11;
/** jump: up-speed and gravity (≈ 0.62 s in the air, 1.5 m high); a swipe down in the air slams down */
const JUMP_V = 9.6;
const GRAVITY = -31;
const SLAM_V = -26;
/** a roll lasts this long (s) */
const SLIDE_S = 0.62;
/** lane switch: the runner closes this share of the gap per second (snappy, like the reference feel) */
const LANE_SNAP = 16;
/** a second side bump within this time ends the run */
const STUMBLE_S = 2.6;
/** obstacles and coins are laid out this far ahead */
const AHEAD = 90;
/** collision half-depth (m) */
const HIT_Z = 0.55;

/**
 * 0 slide tackle (jump), 1 board (roll), 2 standing defender (switch lane), 3 cones (jump),
 * 4 a wall of four players (switch lane: too tall to jump, too low to roll), 5 a sprinkler
 * (not a foul: running through it soaks you and slows you down a moment; jump it)
 */
export type ObstacleKind = 0 | 1 | 2 | 3 | 4 | 5;
export interface Obstacle {
  z: number;
  lane: number;
  kind: ObstacleKind;
  /** a standing defender can drift to the next lane: target lane and when */
  moveTo: number;
  /** a sprinkler already soaked you */
  hit?: number;
}
/** soaked by a sprinkler: this long, at this share of the speed */
const WET_S = 1.1;
const WET_SPEED = 0.62;
export interface Coin {
  z: number;
  lane: number;
  y: number;
  taken: number;
}
export type Input = "" | "left" | "right" | "up" | "down";

/**
 * Power-ups, found on the pitch (never bought): 0 boots = a burst of speed straight through
 * everything; 1 magnet = coins fly to you; 2 armband = forgives one crash; 3 double = 2× points.
 */
export type PowerKind = 0 | 1 | 2 | 3;
export const POWER_S = [5, 9, 0, 10];
export interface Pickup {
  z: number;
  lane: number;
  kind: PowerKind;
  taken: number;
}
/** a power-up roughly every this many metres (not before the first goal's run-in) */
const POWER_GAP = 170;
/** boots: extra speed on top of the run's own, and a little grace once they run out */
const BOOST = 1.6;
const BOOST_GRACE = 0.8;
/** magnet reach (m) */
const MAGNET_R = 7;

/** a goal across the three lanes: the right answer's lane (-1, 0, 1), and how it went (0 not yet, 1 scored, -1 saved) */
export interface Goal {
  z: number;
  correct: number;
  result: number;
  /** which question (index into the list the screen made) */
  q: number;
}
/** first goal this far in, then every GOAL_GAP metres or so; the stretch before a goal is kept clear */
const GOAL_FIRST = 260;
const GOAL_GAP = 420;
const GOAL_CLEAR = 75;
/** the multiplier goes up with every goal, back to 1 on a save */
export const MULT_MAX = 5;
const GOAL_POINTS = 100;

export interface RunState {
  rng: number;
  t: number;
  /** distance run (the runner's z) */
  z: number;
  speed: number;
  /** lane the runner is heading for (-1, 0, 1), where it was, and its x now */
  lane: number;
  from: number;
  x: number;
  y: number;
  vy: number;
  /** roll time left */
  slide: number;
  /** time since the last side bump (big = none) */
  stumble: number;
  /** a forward fall / caught: when it happened (0 = running) */
  dead: number;
  deadKind: "front" | "caught" | "";
  obstacles: Obstacle[];
  coins: Coin[];
  /** next z to lay a row at */
  next: number;
  coinsTaken: number;
  /** a coin was just picked up, a jump / roll / switch happened, a bump: for sounds and haptics */
  events: number;
  lastEvent: "" | "coin" | "bump" | "dead" | "jump" | "roll" | "lane" | "goal" | "save" | "power" | "saved" | "splash";
  goals: Goal[];
  nextGoal: number;
  pickups: Pickup[];
  nextPower: number;
  /** seconds left of boots, magnet, double points; armband = how many crashes it still forgives */
  boots: number;
  magnet: number;
  double: number;
  armband: number;
  /** after a forgiven crash or the boots: a moment of passing through */
  ghost: number;
  /** soaked by a sprinkler: seconds left of running slower */
  wet: number;
  /** right-answer lanes, one per question (the screen lays the options out to match) */
  answers: number[];
  goalsScored: number;
  saves: number;
  mult: number;
  /** points so far (metres and coins times the multiplier, goal bonuses) */
  score: number;
  /** camera x and y, eased */
  camX: number;
  camY: number;
  /** screen shake left (s) */
  shake: number;
}

function rnd(s: RunState): number {
  "worklet";
  s.rng = (s.rng + 0x6d2b79f5) >>> 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function newRun(seed: number, answers: number[] = []): RunState {
  "worklet";
  const s: RunState = {
    rng: seed >>> 0,
    t: 0,
    z: 0,
    speed: SPEED0,
    lane: 0,
    from: 0,
    x: 0,
    y: 0,
    vy: 0,
    slide: 0,
    stumble: 99,
    dead: 0,
    deadKind: "",
    obstacles: [],
    coins: [],
    next: 34,
    coinsTaken: 0,
    events: 0,
    lastEvent: "",
    camX: 0,
    camY: 0,
    shake: 0,
    goals: [],
    nextGoal: GOAL_FIRST,
    pickups: [],
    nextPower: 120,
    boots: 0,
    magnet: 0,
    double: 0,
    armband: 0,
    ghost: 0,
    wet: 0,
    answers,
    goalsScored: 0,
    saves: 0,
    mult: 1,
    score: 0,
  };
  // a free run-up with a coin line before the first obstacles
  for (let i = 0; i < 8; i++) s.coins.push({ z: 12 + i * 2.2, lane: 0, y: 0, taken: 0 });
  return s;
}

/** score: metres and coins times the multiplier, plus goal bonuses */
export const scoreOf = (s: RunState) => {
  "worklet";
  return Math.floor(s.score);
};

/** points multiplier right now (goals × double points) */
export const multOf = (s: RunState) => {
  "worklet";
  return s.mult * (s.double > 0 ? 2 : 1);
};

/** the next goal still to come, if any */
export function nextGoalOf(s: RunState): Goal | null {
  "worklet";
  for (const g of s.goals) if (!g.result) return g;
  return null;
}

function emit(s: RunState, e: RunState["lastEvent"]) {
  "worklet";
  s.events++;
  s.lastEvent = e;
}

/** a coin line along a lane; over a jumpable obstacle it arcs */
function coinLine(s: RunState, z0: number, lane: number, n: number, arcAt: number) {
  "worklet";
  for (let i = 0; i < n; i++) {
    const z = z0 + i * 2.2;
    const d = arcAt ? Math.abs(z - arcAt) : 99;
    const y = d < 4 ? 1.5 * Math.cos((d / 4) * (Math.PI / 2)) : 0;
    s.coins.push({ z, lane, y, taken: 0 });
  }
}

/**
 * One row of obstacles at z: one or two lanes blocked, always one lane you can run, jump or
 * roll through; as the run gets faster rows come closer together and walls get commoner.
 */
function layRow(s: RunState, z: number) {
  "worklet";
  const level = Math.min(1, s.z / 2500);
  const r = rnd(s);
  const free = Math.floor(rnd(s) * 3) - 1;
  const lanes = [-1, 0, 1].filter((l) => l !== free);
  if (r < 0.28) {
    // one jump / roll obstacle across all three lanes: you must act
    const kind: ObstacleKind = rnd(s) < 0.5 + level * 0.2 ? 1 : rnd(s) < 0.5 ? 0 : 3;
    for (const l of [-1, 0, 1]) s.obstacles.push({ z, lane: l, kind, moveTo: l });
    coinLine(s, z - 6, free, 6, kind === 1 ? 0 : z);
  } else if (r < 0.62) {
    // two standing defenders: run the free lane (one may step across at higher speed); now and then a wall of four instead
    for (const l of lanes) {
      if (rnd(s) < 0.22 + level * 0.15) {
        s.obstacles.push({ z, lane: l, kind: 4, moveTo: l });
        continue;
      }
      const drift = level > 0.25 && rnd(s) < 0.25 ? free : l;
      s.obstacles.push({ z, lane: l, kind: 2, moveTo: drift });
    }
    coinLine(s, z - 8, free, 7, 0);
  } else {
    // mixed: a defender in one lane, a tackle or wall in another, the third open
    const kind: ObstacleKind = rnd(s) < 0.5 ? 0 : 1;
    s.obstacles.push({ z, lane: lanes[0], kind: 2, moveTo: lanes[0] });
    s.obstacles.push({ z, lane: lanes[1], kind, moveTo: lanes[1] });
    coinLine(s, z - 6, kind === 0 ? lanes[1] : free, 6, kind === 0 ? z : 0);
  }
  // now and then a sprinkler in the open lane between rows: jump it or get soaked
  if (z > 120 && rnd(s) < 0.18) s.obstacles.push({ z: z + 14, lane: free, kind: 5, moveTo: free });
  // now and then a power-up in the open lane just after the row
  if (z > s.nextPower && Math.abs(z - s.nextGoal) > 90) {
    const r2 = rnd(s);
    const kind: PowerKind = r2 < 0.3 ? 1 : r2 < 0.55 ? 3 : r2 < 0.8 ? 2 : 0;
    s.pickups.push({ z: z + 9, lane: free, kind, taken: 0 });
    s.nextPower = z + POWER_GAP + rnd(s) * 120;
  }
}

/** a defender who drifts across starts moving when the runner is this close */
const DRIFT_AT = 26;

/** lane x of an obstacle now (a drifting defender slides across as you close in) */
export function obstacleX(o: Obstacle, runnerZ: number): number {
  "worklet";
  if (o.moveTo === o.lane) return o.lane * LANE;
  const k = Math.max(0, Math.min(1, (DRIFT_AT - (o.z - runnerZ)) / 10));
  return (o.lane + (o.moveTo - o.lane) * k) * LANE;
}

function bump(s: RunState) {
  "worklet";
  s.shake = 0.25;
  emit(s, "bump");
  if (s.stumble < STUMBLE_S) {
    if (s.armband > 0) {
      s.armband = 0;
      s.ghost = 1.2;
      s.stumble = 99;
      emit(s, "saved");
      return;
    }
    die(s, "caught");
    return;
  }
  s.stumble = 0;
}

function die(s: RunState, kind: "front" | "caught") {
  "worklet";
  s.dead = s.t;
  s.deadKind = kind;
  s.shake = 0.45;
  emit(s, "dead");
}

/** Advance the run by dt seconds with this input ("" = none). */
export function step(s: RunState, input: Input, dt: number) {
  "worklet";
  s.t += dt;
  if (s.dead) {
    // a short slide to a stop after the foul
    s.speed = Math.max(0, s.speed - 40 * dt);
    s.z += s.speed * dt;
    s.shake = Math.max(0, s.shake - dt);
    return;
  }
  s.speed = Math.min(SPEED_MAX, s.speed + ACCEL * dt * (1 + s.speed / SPEED_MAX));
  const v = (s.boots > 0 ? s.speed * BOOST : s.speed) * (s.wet > 0 ? WET_SPEED : 1);
  s.wet = Math.max(0, s.wet - dt);
  s.z += v * dt;
  s.score += v * dt * multOf(s);
  if (s.boots > 0) {
    s.boots = Math.max(0, s.boots - dt);
    if (s.boots === 0) s.ghost = BOOST_GRACE;
  }
  s.magnet = Math.max(0, s.magnet - dt);
  s.double = Math.max(0, s.double - dt);
  s.ghost = Math.max(0, s.ghost - dt);
  s.stumble += dt;
  s.shake = Math.max(0, s.shake - dt);

  // input
  const grounded = s.y <= 0.001;
  if (input === "left" || input === "right") {
    const to = Math.max(-1, Math.min(1, s.lane + (input === "left" ? -1 : 1)));
    if (to !== s.lane) {
      s.from = s.lane;
      s.lane = to;
      emit(s, "lane");
    } else bump(s);
  } else if (input === "up" && grounded) {
    s.vy = JUMP_V;
    s.slide = 0;
    emit(s, "jump");
  } else if (input === "down") {
    if (!grounded) s.vy = SLAM_V;
    s.slide = SLIDE_S;
    emit(s, "roll");
  }

  // movement
  s.x += (s.lane * LANE - s.x) * Math.min(1, dt * LANE_SNAP);
  if (!grounded || s.vy > 0) {
    s.vy += GRAVITY * dt;
    s.y = Math.max(0, s.y + s.vy * dt);
    if (s.y === 0) s.vy = 0;
  }
  if (s.slide > 0 && s.y === 0) s.slide = Math.max(0, s.slide - dt);
  s.camX += (s.x * 0.85 - s.camX) * Math.min(1, dt * 7);
  s.camY += (s.y * 0.35 - s.camY) * Math.min(1, dt * 6);

  // lay out what's ahead, drop what's behind
  while (s.next < s.z + AHEAD) {
    // a goal coming up: keep the run-in clear, put the goal across the lanes, carry on behind it
    if (s.answers.length && s.next > s.nextGoal - GOAL_CLEAR) {
      const q = s.goals.length;
      s.goals.push({ z: s.nextGoal, correct: s.answers[q % s.answers.length], result: 0, q });
      coinLine(s, s.nextGoal - 40, 0, 6, 0);
      s.next = s.nextGoal + 40;
      s.nextGoal += GOAL_GAP + rnd(s) * 120;
      continue;
    }
    layRow(s, s.next);
    const gap = 30 - Math.min(14, s.z / 180) + rnd(s) * 8;
    s.next += gap;
  }
  if (s.goals.length > 3 && s.goals[0].z < s.z - 20) s.goals = s.goals.filter((g) => g.z > s.z - 20);

  // through a goal: the lane you're in is your answer
  for (const g of s.goals) {
    if (g.result || s.z < g.z) continue;
    const lane = Math.max(-1, Math.min(1, Math.round(s.x / LANE)));
    if (lane === g.correct) {
      g.result = 1;
      s.goalsScored++;
      s.score += GOAL_POINTS * multOf(s);
      s.mult = Math.min(MULT_MAX, s.mult + 1);
      emit(s, "goal");
    } else {
      g.result = -1;
      s.saves++;
      s.mult = 1;
      emit(s, "save");
    }
  }
  if (s.obstacles.length && s.obstacles[0].z < s.z - 8) s.obstacles = s.obstacles.filter((o) => o.z > s.z - 8);
  if (s.coins.length && s.coins[0].z < s.z - 8) s.coins = s.coins.filter((c) => c.z > s.z - 8);
  if (s.pickups.length && s.pickups[0].z < s.z - 8) s.pickups = s.pickups.filter((p) => p.z > s.z - 8);

  // power-ups
  for (const p of s.pickups) {
    if (p.taken || Math.abs(p.z - s.z) > 1 || Math.abs(p.lane * LANE - s.x) > 1.2 || s.y > 1.6) continue;
    p.taken = 1;
    if (p.kind === 0) s.boots = POWER_S[0];
    else if (p.kind === 1) s.magnet = POWER_S[1];
    else if (p.kind === 2) s.armband = 1;
    else s.double = POWER_S[3];
    emit(s, "power");
  }

  // coins
  for (const c of s.coins) {
    if (c.taken) continue;
    // the magnet pulls every coin in reach, in any lane
    const pulled = s.magnet > 0 && c.z - s.z < MAGNET_R && c.z - s.z > -0.5;
    if (!pulled && Math.abs(c.z - s.z) > 0.9) continue;
    if (pulled || (Math.abs(c.lane * LANE - s.x) < 1.1 && Math.abs(c.y - s.y) < 1.2)) {
      c.taken = 1;
      s.coinsTaken++;
      s.score += 10 * multOf(s);
      emit(s, "coin");
    }
  }

  // obstacles (the boots and a moment after a forgiven crash pass straight through)
  if (s.boots > 0 || s.ghost > 0) return;
  for (const o of s.obstacles) {
    const dz = o.z - s.z;
    if (dz > HIT_Z || dz < -HIT_Z) continue;
    const ox = obstacleX(o, s.z);
    const dx = Math.abs(ox - s.x);
    if (dx > LANE * 0.62) continue;
    const clears = o.kind === 0 || o.kind === 3 || o.kind === 5 ? s.y > 0.55 : o.kind === 1 ? s.slide > 0 : false;
    if (clears) continue;
    // a sprinkler only soaks you
    if (o.kind === 5) {
      if (!o.hit && dx < LANE * 0.45) {
        o.hit = 1;
        s.wet = WET_S;
        s.shake = 0.15;
        emit(s, "splash");
      }
      continue;
    }
    // mostly beside it while switching lanes: a side bump, bounce back to where you came from
    if (dx > LANE * 0.32 && s.lane !== s.from) {
      s.lane = s.from;
      bump(s);
      continue;
    }
    // the armband forgives one crash: a moment to pass through, the run goes on
    if (s.armband > 0) {
      s.armband = 0;
      s.ghost = 1.2;
      s.shake = 0.3;
      emit(s, "saved");
      return;
    }
    die(s, "front");
    return;
  }
}
