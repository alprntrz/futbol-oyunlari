import type { FormationKey } from "./types";

/**
 * Normalized pitch coordinates for each formation, GK first.
 * x: 0 (viewer left) – 100 (viewer right), y: 0 (top / attack) – 100 (own goal).
 *
 * The team defends the bottom goal and attacks upward, so the team's RIGHT
 * side is the viewer's RIGHT: slot order "RB" renders at high x, "LB" at low x.
 */
export const FORMATIONS: Record<FormationKey, { x: number; y: number }[]> = {
  "4-3-3": [
    { x: 50, y: 92 },
    { x: 86, y: 74 }, { x: 62, y: 76 }, { x: 38, y: 76 }, { x: 14, y: 74 },
    { x: 74, y: 52 }, { x: 50, y: 55 }, { x: 26, y: 52 },
    { x: 82, y: 27 }, { x: 50, y: 23 }, { x: 18, y: 27 },
  ],
  "4-2-3-1": [
    { x: 50, y: 92 },
    { x: 86, y: 74 }, { x: 62, y: 76 }, { x: 38, y: 76 }, { x: 14, y: 74 },
    { x: 63, y: 58 }, { x: 37, y: 58 },
    { x: 82, y: 38 }, { x: 50, y: 40 }, { x: 18, y: 38 },
    { x: 50, y: 20 },
  ],
  "4-4-2": [
    { x: 50, y: 92 },
    { x: 86, y: 74 }, { x: 62, y: 76 }, { x: 38, y: 76 }, { x: 14, y: 74 },
    { x: 86, y: 50 }, { x: 61, y: 53 }, { x: 39, y: 53 }, { x: 14, y: 50 },
    { x: 62, y: 25 }, { x: 38, y: 25 },
  ],
  "4-3-1-2": [
    { x: 50, y: 92 },
    { x: 86, y: 74 }, { x: 62, y: 76 }, { x: 38, y: 76 }, { x: 14, y: 74 },
    { x: 74, y: 56 }, { x: 50, y: 60 }, { x: 26, y: 56 },
    { x: 50, y: 38 },
    { x: 63, y: 21 }, { x: 37, y: 21 },
  ],
  "4-4-1-1": [
    { x: 50, y: 92 },
    { x: 86, y: 74 }, { x: 62, y: 76 }, { x: 38, y: 76 }, { x: 14, y: 74 },
    { x: 86, y: 52 }, { x: 61, y: 55 }, { x: 39, y: 55 }, { x: 14, y: 52 },
    { x: 50, y: 36 },
    { x: 50, y: 19 },
  ],
  "3-4-1-2": [
    { x: 50, y: 92 },
    { x: 74, y: 76 }, { x: 50, y: 78 }, { x: 26, y: 76 },
    { x: 88, y: 54 }, { x: 61, y: 57 }, { x: 39, y: 57 }, { x: 12, y: 54 },
    { x: 50, y: 38 },
    { x: 63, y: 21 }, { x: 37, y: 21 },
  ],
  // Modern back three: wing-backs, two central midfielders, front three
  "3-4-3": [
    { x: 50, y: 92 },
    { x: 74, y: 76 }, { x: 50, y: 78 }, { x: 26, y: 76 },
    { x: 90, y: 54 }, { x: 62, y: 58 }, { x: 38, y: 58 }, { x: 10, y: 54 },
    { x: 82, y: 25 }, { x: 50, y: 21 }, { x: 18, y: 25 },
  ],
  // Ajax '95 style: three at the back, diamond midfield, wide wingers
  "3-4-3d": [
    { x: 50, y: 92 },
    { x: 74, y: 76 }, { x: 50, y: 78 }, { x: 26, y: 76 },
    { x: 50, y: 63 },
    { x: 71, y: 52 }, { x: 29, y: 52 },
    { x: 50, y: 40 },
    { x: 82, y: 25 }, { x: 50, y: 21 }, { x: 18, y: 25 },
  ],
  // Sweeper + wing-backs (BVB '97): SW behind two CBs
  "3-5-2": [
    { x: 50, y: 92 },
    { x: 50, y: 82 }, { x: 72, y: 74 }, { x: 28, y: 74 },
    { x: 90, y: 54 }, { x: 10, y: 54 },
    { x: 64, y: 58 }, { x: 36, y: 58 },
    { x: 50, y: 40 },
    { x: 63, y: 22 }, { x: 37, y: 22 },
  ],
  "3-4-2-1": [
    { x: 50, y: 92 },
    { x: 74, y: 76 }, { x: 50, y: 78 }, { x: 26, y: 76 },
    { x: 90, y: 54 }, { x: 10, y: 54 },
    { x: 62, y: 58 }, { x: 38, y: 58 },
    { x: 67, y: 37 }, { x: 33, y: 37 },
    { x: 50, y: 20 },
  ],
  // Pep's box midfield (City '23)
  "3-2-4-1": [
    { x: 50, y: 92 },
    { x: 74, y: 76 }, { x: 50, y: 78 }, { x: 26, y: 76 },
    { x: 62, y: 60 }, { x: 38, y: 60 },
    { x: 86, y: 40 }, { x: 62, y: 42 }, { x: 38, y: 42 }, { x: 14, y: 40 },
    { x: 50, y: 20 },
  ],
  "4-1-4-1": [
    { x: 50, y: 92 },
    { x: 86, y: 74 }, { x: 62, y: 76 }, { x: 38, y: 76 }, { x: 14, y: 74 },
    { x: 50, y: 62 },
    { x: 86, y: 46 }, { x: 62, y: 48 }, { x: 38, y: 48 }, { x: 14, y: 46 },
    { x: 50, y: 22 },
  ],
  // 1970 Brazil: two half-backs, wingers + two centre-forwards
  "4-2-4": [
    { x: 50, y: 92 },
    { x: 86, y: 74 }, { x: 62, y: 76 }, { x: 38, y: 76 }, { x: 14, y: 74 },
    { x: 62, y: 55 }, { x: 38, y: 55 },
    { x: 86, y: 26 }, { x: 62, y: 22 }, { x: 38, y: 22 }, { x: 14, y: 26 },
  ],
};
