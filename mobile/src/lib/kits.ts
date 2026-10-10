import type { Match } from "@/lib/types";

import type { JerseyStyle } from "./brand";

const rgb = (hex: string) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
};
const dist = (a: string, b: string) => {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
};
const luminance = (hex: string) => {
  const [r, g, b] = rgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

/** Collar style: classic polo for pre-2000 matches, otherwise V-neck or crew per team. */
export function jerseyStyle(match: Match): JerseyStyle {
  if (Number(match.date.slice(-4)) < 2000) return "polo";
  let h = 0;
  for (const ch of match.team) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 2 ? "crew" : "vneck";
}

// The data has no goalkeeper kits; pick a colour that stands out from both
// the outfield shirt and the pitch.
const KEEPER_COLOURS = ["#F59E0B", "#0EA5E9", "#111827", "#A855F7", "#F472B6"];
const PITCH = "#3BA55C";

export function keeperKit(kit: Match["kit"]) {
  const body = KEEPER_COLOURS.reduce((best, c) =>
    Math.min(dist(c, kit.body), dist(c, PITCH)) > Math.min(dist(best, kit.body), dist(best, PITCH)) ? c : best
  );
  return { body, sleeves: body, number: luminance(body) > 0.6 ? "#0B1220" : "#FFFFFF" };
}
