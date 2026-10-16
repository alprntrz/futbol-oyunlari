import type { Cost, Pos, Star } from "./rules";

/** A footballer in this lobby's pool. `pid` indexes Lobby.players. */
export interface PoolPlayer {
  pid: number;
  name: string;
  cost: Cost;
  pos: Pos;
  /** main club id (tiki CLUBS) or null */
  club: string | null;
  country: string;
  badges: string[];
}

export type ItemId = "boot" | "gloves" | "shin" | "band" | "energy" | "board";
export type AugmentId = "gegenpress" | "bus" | "longball" | "academy" | "cash" | "signing" | "wings" | "crowd" | "legend" | "intl";
export type CoachId = "pass" | "bus" | "press";
export type Personality = "loyal" | "econ" | "roller" | "opportunist";

/** A card a manager owns: on the pitch (`slot`) or on the bench (`slot` null). */
export interface Unit extends Omit<PoolPlayer, "pid"> {
  uid: string;
  pid: number;
  star: Star;
  items: ItemId[];
  slot: number | null;
  /** bought by naming it from a scout report */
  scouted?: boolean;
}

export interface ShopCard {
  pid: number;
  /** a scout report: shown as clues; naming it takes SCOUT_DISCOUNT off */
  scout?: boolean;
}

export interface Manager {
  id: number;
  name: string;
  bot: Personality | null;
  hp: number;
  gold: number;
  level: number;
  xp: number;
  units: Unit[];
  /** items not given to anyone yet */
  items: ItemId[];
  shop: (ShopCard | null)[];
  locked: boolean;
  /** > 0 win streak, < 0 loss streak */
  streak: number;
  /** where this round's gold came from (shown at the start of the round); absent in old saves */
  income?: { base: number; interest: number; streak: number } | null;
  coach: CoachId;
  augments: AugmentId[];
  /** tactics cards to choose from, when one is due */
  offer: AugmentId[] | null;
  /** swaps left on the current offer (each card can be swapped for a new one); absent in old saves */
  offerRerolls?: number;
  /** finishing place once out (1 = winner) */
  place: number | null;
  lastOpponent: number | null;
  scoutsThisStage: number;
  /** a club the "loyal" bot is collecting */
  target: string | null;
  uidSeq: number;
}

export interface MatchEvent {
  slice: number;
  side: 0 | 1;
  kind: "goal" | "save" | "miss" | "shield";
  /** who shot */
  name: string;
}

export interface MatchResult {
  home: number;
  away: number;
  goals: [number, number];
  /** shoot-out score when it was a draw */
  pens: [number, number] | null;
  winner: 0 | 1;
  events: MatchEvent[];
  /** away is a friendly (PvE) side, or a copy of a manager (odd number left) */
  awayName: string;
  damage: number;
  /** pve drops for the home manager */
  drops?: { gold: number; item: ItemId | null };
}

export interface Lobby {
  seed: number;
  rng: number;
  players: PoolPlayer[];
  /** copies left in the pool, by pid */
  copies: number[];
  managers: Manager[];
  stage: number;
  /** index into the stage's round list */
  round: number;
  /** total rounds played */
  played: number;
  /** last round's matches */
  last: MatchResult[];
  over: boolean;
}
