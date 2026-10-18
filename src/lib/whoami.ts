/**
 * Who Am I? (online "Guess Who" for footballers). One hidden player for both; the two take
 * turns asking a yes / no question from a fixed menu (club, country, league, position, honour,
 * birth decade) that the rules answer, or naming the player. Every answer is seen by both, so
 * each question helps the other side too. A wrong name costs one of 3 hearts; whoever names
 * the player first wins; out of hearts loses; nobody after WM_MAX_TURNS is a draw.
 * Pure (no React / DOM): server.js (`wm:*`, which keeps the player secret) and the phone's
 * house player use the same rules.
 */
import type { GridPlayer } from "@/data/players";

import { LEAGUES } from "./leagues";
import { bornYear, playerInfo, type PosGroup } from "./playerInfo";
import { ALL_CRITERIA, GRID_PLAYERS, matchPlayers } from "./tiki";

export const WM_HEARTS = 3;
export const WM_TURN_MS = 25_000;
export const WM_MAX_TURNS = 24;

export type WmQuestion =
  | { kind: "club"; id: string }
  | { kind: "country"; id: string }
  | { kind: "league"; id: string }
  | { kind: "pos"; id: PosGroup }
  | { kind: "honour"; id: string }
  | { kind: "born"; id: string };
export type WmKind = WmQuestion["kind"];

/** The question menu: what each kind can be asked about. */
export const WM_CLUBS = ALL_CRITERIA.filter((c) => c.kind === "club");
export const WM_COUNTRIES = ALL_CRITERIA.filter((c) => c.kind === "country");
export const WM_HONOURS = ALL_CRITERIA.filter((c) => c.kind === "badge");
export const WM_LEAGUES = LEAGUES.filter((l) => l.id !== "all" && !l.id.startsWith("sa") && l.id !== "eg");
export const WM_POSITIONS: PosGroup[] = ["G", "D", "M", "F"];
export const WM_DECADES = ["1960", "1970", "1980", "1990", "2000"];

const known = (p: GridPlayer) => playerInfo(p).pos !== null && bornYear(p) !== null && p.clubs.length >= 2;

/** Hidden players: well-known (two names, position and birth year known, 2+ clubs). */
export const WM_POOL: GridPlayer[] = GRID_PLAYERS.slice(0, 1500).filter((p) => p.name.includes(" ") && known(p)).slice(0, 400);

export function wmDeal(rand: () => number = Math.random): GridPlayer {
  return WM_POOL[Math.floor(rand() * WM_POOL.length)];
}

export const wmByName = (name: string) => WM_POOL.find((p) => p.name === name) ?? GRID_PLAYERS.find((p) => p.name === name);

/** A question as sent by a phone: null when it isn't on the menu. */
export function wmCleanQuestion(q: unknown): WmQuestion | null {
  if (!q || typeof q !== "object") return null;
  const { kind, id } = q as { kind?: unknown; id?: unknown };
  if (typeof id !== "string") return null;
  const ok =
    (kind === "club" && WM_CLUBS.some((c) => c.id === id)) ||
    (kind === "country" && WM_COUNTRIES.some((c) => c.id === id)) ||
    (kind === "league" && WM_LEAGUES.some((l) => l.id === id)) ||
    (kind === "pos" && (WM_POSITIONS as string[]).includes(id)) ||
    (kind === "honour" && WM_HONOURS.some((c) => c.id === id)) ||
    (kind === "born" && WM_DECADES.includes(id));
  return ok ? ({ kind, id } as WmQuestion) : null;
}

/** The rules' answer for a player. */
export function wmAnswer(p: GridPlayer, q: WmQuestion): boolean {
  switch (q.kind) {
    case "club":
      return p.clubs.includes(q.id);
    case "country":
      return p.country === q.id;
    case "league":
      return (LEAGUES.find((l) => l.id === q.id)?.clubs ?? []).some((c) => p.clubs.includes(c));
    case "pos":
      return playerInfo(p).pos === q.id;
    case "honour":
      return !!p.badges?.includes(q.id);
    case "born": {
      const y = bornYear(p);
      return y !== null && y >= Number(q.id) && y < Number(q.id) + 10;
    }
  }
}

/** A typed name names the hidden player (any matching form of the name). */
export function wmIsRight(guess: string, hidden: GridPlayer): boolean {
  return matchPlayers(guess).some((p) => p.name === hidden.name);
}

/** Who fits every answer so far (the house player thinks with this). */
export function wmCandidates(log: { q: WmQuestion; yes: boolean }[], wrong: string[] = []): GridPlayer[] {
  return WM_POOL.filter((p) => !wrong.includes(p.name) && log.every((e) => wmAnswer(p, e.q) === e.yes));
}

const ALL_QUESTIONS: WmQuestion[] = [
  ...WM_CLUBS.map((c) => ({ kind: "club" as const, id: c.id })),
  ...WM_COUNTRIES.map((c) => ({ kind: "country" as const, id: c.id })),
  ...WM_LEAGUES.map((l) => ({ kind: "league" as const, id: l.id })),
  ...WM_POSITIONS.map((id) => ({ kind: "pos" as const, id })),
  ...WM_HONOURS.map((c) => ({ kind: "honour" as const, id: c.id })),
  ...WM_DECADES.map((id) => ({ kind: "born" as const, id })),
];

/**
 * The house player's move: name someone once few fit (it isn't perfect: sometimes early, and
 * it picks among the fits), else ask a question that splits the fits well (with some noise).
 */
export function wmHouseMove(
  log: { q: WmQuestion; yes: boolean }[],
  wrong: string[],
  rand: () => number = Math.random
): { kind: "ask"; q: WmQuestion } | { kind: "guess"; name: string } {
  const fits = wmCandidates(log, wrong);
  if (fits.length && (fits.length <= 2 || (fits.length <= 5 && rand() < 0.3))) return { kind: "guess", name: fits[Math.floor(rand() * fits.length)].name };
  const asked = new Set(log.map((e) => `${e.q.kind}:${e.q.id}`));
  const scored = ALL_QUESTIONS.filter((q) => !asked.has(`${q.kind}:${q.id}`))
    .map((q) => {
      const yes = fits.filter((p) => wmAnswer(p, q)).length;
      return { q, score: Math.min(yes, fits.length - yes) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return fits.length ? { kind: "guess", name: fits[0].name } : { kind: "ask", q: ALL_QUESTIONS[Math.floor(rand() * ALL_QUESTIONS.length)] };
  // one of the better questions, not always the best (a person doesn't compute this)
  return { kind: "ask", q: scored[Math.floor(rand() * Math.min(scored.length, 6))].q };
}
