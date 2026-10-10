import type { SymbolViewProps } from "expo-symbols";

/** How each tile colour looks: kit items, each with its own colour and shape. */
export const TILE_LOOK: { name: { tr: string; en: string }; icon: SymbolViewProps["name"]; fallback: string; top: string; bottom: string }[] = [
  { name: { tr: "Forma", en: "Shirts" }, icon: "tshirt.fill", fallback: "👕", top: "#F25F64", bottom: "#C9252B" },
  { name: { tr: "Eldiven", en: "Gloves" }, icon: "hand.raised.fill", fallback: "🧤", top: "#5C9BFF", bottom: "#2563EB" },
  { name: { tr: "Köşe bayrağı", en: "Corner flags" }, icon: "flag.fill", fallback: "🚩", top: "#3CCB7A", bottom: "#15924A" },
  { name: { tr: "Kupa", en: "Trophies" }, icon: "trophy.fill", fallback: "🏆", top: "#FFD34D", bottom: "#E0A100" },
  { name: { tr: "Krampon", en: "Boots" }, icon: "shoe.fill", fallback: "👟", top: "#A98BFF", bottom: "#7044E8" },
  { name: { tr: "Kronometre", en: "Stopwatches" }, icon: "stopwatch.fill", fallback: "⏱", top: "#FF9A4D", bottom: "#E86A10" },
];
