import type { Level } from "./engine";

/** A level is a matchday against a club (criterion id from tiki.ts, for its kit). */
export interface Matchday extends Level {
  rival: string;
}

const MUD_MIDDLE = ["........", "........", "........", "..####..", "..####..", "........", "........", "........"];
const MUD_BAND = ["........", "........", "........", "........", "########", "########", "........", "........"];
const MUD_CORNERS = ["##....##", "##....##", "........", "........", "........", "........", "##....##", "##....##"];
const MUD_BOTTOM = ["........", "........", "........", "........", "########", "########", "########", "########"];

/**
 * The first season. Difficulty is tuned with scripts/kombine-sim.mts
 * (a greedy bot plays each level many times; see the target win rates there).
 */
export const SEASON: Matchday[] = [
  { rival: "besiktas", moves: 15, colors: 4, goals: [{ kind: "color", color: 0, count: 20 }] },
  { rival: "porto", moves: 16, colors: 4, goals: [{ kind: "color", color: 1, count: 22 }, { kind: "color", color: 2, count: 22 }] },
  { rival: "ajax", moves: 14, colors: 5, balls: 2, goals: [{ kind: "ball", count: 2 }] },
  { rival: "sevilla", moves: 14, colors: 5, mud: MUD_MIDDLE, goals: [{ kind: "mud" }] },
  { rival: "napoli", moves: 15, colors: 5, balls: 2, goals: [{ kind: "ball", count: 2 }, { kind: "color", color: 3, count: 22 }] },
  { rival: "dortmund", moves: 17, colors: 5, mud: MUD_BAND, goals: [{ kind: "mud" }] },
  { rival: "inter", moves: 20, colors: 5, goals: [{ kind: "score", count: 9000 }] },
  { rival: "atletico", moves: 12, colors: 5, balls: 3, goals: [{ kind: "ball", count: 3 }] },
  { rival: "chelsea", moves: 26, colors: 5, mud: MUD_CORNERS, goals: [{ kind: "mud" }, { kind: "color", color: 4, count: 24 }] },
  { rival: "juventus", moves: 15, colors: 5, balls: 2, mud: MUD_MIDDLE, goals: [{ kind: "ball", count: 3 }, { kind: "mud" }] },
  { rival: "bayern", moves: 22, colors: 5, mud: MUD_BOTTOM, goals: [{ kind: "mud" }] },
  { rival: "realmadrid", moves: 19, colors: 5, balls: 3, goals: [{ kind: "ball", count: 4 }, { kind: "color", color: 0, count: 25 }] },
];
