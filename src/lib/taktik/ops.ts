import { autoArrange, buy, buyXp, chooseAugment, equip, fillField, move, reroll, rerollAugment, sell } from "./engine";
import { SLOTS } from "./rules";
import type { Lobby, Manager } from "./types";

/**
 * A manager's moves during set-up, the one list both the phone (offline, and as an
 * instant guess online) and the server (server-taktik.js, the real thing online) run.
 * Arguments come from a phone, so they are checked here.
 */
export type Op =
  | { op: "buy"; i: number; guess?: string }
  | { op: "sell"; uid: string }
  | { op: "move"; uid: string; slot: number | null }
  | { op: "reroll" }
  | { op: "xp" }
  | { op: "equip"; index: number; uid: string }
  | { op: "augment"; i: number }
  | { op: "augSwap"; i: number }
  | { op: "arrange" };

/** moves with a random outcome: online the phone waits for the server instead of guessing */
export const RANDOM_OPS = new Set<Op["op"]>(["reroll", "augSwap"]);

const isInt = (v: unknown, lo: number, hi: number): v is number => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;
const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 40;

/** Apply one move. Returns true / "ok" when it went through, false or a reason ("gold", "full") when not. */
export function applyOp(l: Lobby, m: Manager, o: Op): boolean | string {
  switch (o.op) {
    case "buy": {
      if (!isInt(o.i, 0, 9) || (o.guess !== undefined && (typeof o.guess !== "string" || o.guess.length > 60))) return false;
      const r = buy(l, m, o.i, o.guess);
      // straight onto the pitch while there's room (the manager's own placements stay)
      if (r === "ok") fillField(m);
      return r;
    }
    case "sell":
      if (!isId(o.uid) || !m.units.some((u) => u.uid === o.uid)) return false;
      sell(l, m, o.uid);
      return true;
    case "move":
      return isId(o.uid) && (o.slot === null || isInt(o.slot, 0, SLOTS.length - 1)) && move(m, o.uid, o.slot);
    case "reroll":
      return reroll(l, m);
    case "xp":
      return buyXp(m);
    case "equip":
      return isInt(o.index, 0, 40) && isId(o.uid) && equip(m, o.index, o.uid);
    case "augment":
      if (!m.offer || !isInt(o.i, 0, m.offer.length - 1)) return false;
      chooseAugment(l, m, o.i);
      // a card that brings players (Academy, Star signing) walks them onto the pitch too
      fillField(m);
      return true;
    case "augSwap":
      return !!m.offer && isInt(o.i, 0, m.offer.length - 1) && rerollAugment(l, m, o.i);
    case "arrange":
      autoArrange(m);
      return true;
    default:
      return false;
  }
}
