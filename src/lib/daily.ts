import { MATCHES } from "@/data/matches";
import type { Match } from "./types";

/** Days since epoch in local time, used as the daily puzzle index. */
export function dayNumber(date = new Date()): number {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor(local.getTime() / 86_400_000);
}

/** Deterministic small hash so consecutive days don't walk the list in order. */
function scramble(n: number): number {
  let x = n ^ 0x5f356495;
  x = Math.imul(x, 0x85ebca6b) >>> 0;
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35) >>> 0;
  x ^= x >>> 16;
  return x >>> 0;
}

export function dailyMatch(date = new Date()): { match: Match; day: number } {
  const day = dayNumber(date);
  const match = MATCHES[scramble(day) % MATCHES.length];
  return { match, day };
}

export function randomMatch(excludeId?: string, pool: Match[] = MATCHES): Match {
  const filtered = pool.filter((m) => m.id !== excludeId);
  const source = filtered.length > 0 ? filtered : pool;
  return source[Math.floor(Math.random() * source.length)];
}

/** Matches featuring Turkish teams (club or national side). */
export function turkishMatches(): Match[] {
  return MATCHES.filter((m) => m.tags?.includes("turkiye"));
}

/**
 * Global practice pool: recent (2005+) well-known international/club matches,
 * excluding the Turkish-team collection (those live under the dedicated Türk
 * Takımları tab). Older matches are kept in the dataset for the daily puzzle
 * but filtered out of practice.
 */
export function globalMatches(): Match[] {
  return MATCHES.filter((m) => {
    if (m.tags?.includes("turkiye")) return false;
    return Number(m.date.slice(-4)) >= 2005;
  });
}
