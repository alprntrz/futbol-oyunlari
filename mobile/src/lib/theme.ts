/**
 * Light, calm design system: white cards on a soft grey background, one green
 * accent (the pitch), plain system font. Colour carries meaning only for
 * game feedback (green/yellow/grey tiles, blue X / coral O).
 */
export const C = {
  bg: "#F2F4F7",
  card: "#FFFFFF",
  border: "#E4E7EC",
  divider: "#EEF0F3",
  text: "#0B1220",
  text2: "#5B6474",
  text3: "#98A1B0",

  green: "#16A34A",
  greenDark: "#15803D",
  greenSoft: "#DCFCE7",
  blue: "#2563EB",
  blueSoft: "#DBEAFE",
  coral: "#F43F5E",
  coralSoft: "#FFE4E6",
  amber: "#F59E0B",
  amberSoft: "#FEF3C7",
  violet: "#7C3AED",
  violetSoft: "#EDE9FE",
  red: "#DC2626",
  redSoft: "#FEE2E2",

  tileCorrect: "#22A55A",
  tilePresent: "#E9B10A",
  tileAbsent: "#8D96A5",
  key: "#E4E7EC",

  pitchA: "#3BA55C",
  pitchB: "#43B064",
  pitchLine: "rgba(255,255,255,0.55)",
};

export const R = { card: 20, button: 14, chip: 999 };

/** Soft card shadow (iOS) / elevation (Android). */
export const shadow = {
  shadowColor: "#0B1220",
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
} as const;

export const T = {
  largeTitle: { fontSize: 32, fontWeight: "800", color: C.text, letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: "800", color: C.text, letterSpacing: -0.3 },
  headline: { fontSize: 17, fontWeight: "700", color: C.text },
  body: { fontSize: 15, fontWeight: "400", color: C.text2, lineHeight: 21 },
  caption: { fontSize: 13, fontWeight: "500", color: C.text3 },
  label: { fontSize: 13, fontWeight: "700", color: C.text3, letterSpacing: 0.6, textTransform: "uppercase" },
} as const;
