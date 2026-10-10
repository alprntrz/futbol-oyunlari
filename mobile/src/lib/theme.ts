/**
 * Light theme with one UI accent (pitch green). Other colours only carry game
 * meaning: tile feedback (green/yellow/grey), X/O players (blue/coral), the
 * streak flame and trophies (amber), mistakes (red).
 */
export const C = {
  bg: "#F1F4F1",
  card: "#FFFFFF",
  border: "#E2E7E3",
  divider: "#ECEFEC",
  text: "#0E1A14",
  text2: "#56645C",
  text3: "#5F6C64",

  green: "#16A34A",
  greenDark: "#14532D",
  greenMid: "#15803D",
  greenSoft: "#DDF5E4",
  blue: "#2563EB",
  blueSoft: "#DBEAFE",
  coral: "#F43F5E",
  coralSoft: "#FFE4E6",
  amber: "#F59E0B",
  amberSoft: "#FEF3C7",
  red: "#DC2626",
  redSoft: "#FEE2E2",

  tileCorrect: "#22A55A",
  tilePresent: "#E9B10A",
  tileAbsent: "#8D968F",
  key: "#E3E8E4",

  pitchA: "#3BA55C",
  pitchB: "#43B064",
  pitchLine: "rgba(255,255,255,0.55)",
};

/** Barlow Condensed: sporty display face for titles and every number. */
export const F = {
  display: "BarlowCondensed_800ExtraBold",
  displayItalic: "BarlowCondensed_800ExtraBold_Italic",
  black: "BarlowCondensed_900Black",
  semi: "BarlowCondensed_600SemiBold",
};

export const R = { card: 22, inner: 12, button: 14, chip: 999 };

/** Soft card shadow tinted with the green-grey of the background. */
export const shadow = {
  shadowColor: "#14532D",
  shadowOpacity: 0.07,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
} as const;

export const T = {
  largeTitle: { fontFamily: F.display, fontSize: 40, color: C.text, letterSpacing: -0.4, lineHeight: 42 },
  title: { fontFamily: F.display, fontSize: 30, color: C.text, lineHeight: 32 },
  heading: { fontFamily: F.display, fontSize: 22, color: C.text },
  headline: { fontSize: 17, fontWeight: "700", color: C.text },
  body: { fontSize: 15, fontWeight: "400", color: C.text2, lineHeight: 21 },
  caption: { fontSize: 13, fontWeight: "500", color: C.text3 },
  number: { fontFamily: F.display, fontVariant: ["tabular-nums"] },
} as const;
