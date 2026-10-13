import { StyleSheet, View } from "react-native";

import { rankOf, RANKS, type Medal } from "@/lib/levels";

import { useI18n } from "~/lib/i18n";
import { F } from "~/lib/theme";

import { Text } from "./Text";
import { Icon } from "./ui";

/** Medal colours: shield fill, chip background, text. Legend has its own. */
export const MEDAL: Record<Medal | "legend", { color: string; soft: string; text: string }> = {
  bronze: { color: "#C27A3A", soft: "#F8E9DC", text: "#7A4515" },
  silver: { color: "#8E9AA6", soft: "#EDF0F3", text: "#47525C" },
  gold: { color: "#E0A800", soft: "#FFF4CC", text: "#6E5200" },
  legend: { color: "#7C3AED", soft: "#EFE7FD", text: "#4C1D95" },
};

/** "Academy · Silver" (no medal on the top rank). */
export function useRankName() {
  const { t } = useI18n();
  return (level: number) => {
    const r = rankOf(level);
    const name = t(`rank_${r.id}` as Parameters<typeof t>[0]);
    return r.medal ? `${name} · ${t(`medal_${r.medal}` as Parameters<typeof t>[0])}` : name;
  };
}

/** Shield in the medal colour plus the rank name. `compact` drops the medal word. */
export function RankChip({ level, compact = false, size = "md" }: { level: number; compact?: boolean; size?: "sm" | "md" }) {
  const { t } = useI18n();
  const r = rankOf(level);
  const m = MEDAL[r.medal ?? "legend"];
  const name = t(`rank_${r.id}` as Parameters<typeof t>[0]);
  const full = r.medal && !compact ? `${name} · ${t(`medal_${r.medal}` as Parameters<typeof t>[0])}` : name;
  const sm = size === "sm";
  return (
    <View style={[styles.chip, { backgroundColor: m.soft }, sm && styles.chipSm]} accessibilityLabel={full}>
      <Icon name="shield.fill" size={sm ? 11 : 14} color={m.color} fallback="🛡" />
      <Text style={[styles.text, { color: m.text }, sm && { fontSize: 12 }]} numberOfLines={1}>
        {full}
      </Text>
    </View>
  );
}

/** Same chip from a tier only (rank, no medal): what the server knows about an opponent. */
export function TierChip({ tier }: { tier: number }) {
  const r = RANKS[Math.max(0, Math.min(RANKS.length - 1, tier))];
  return <RankChip level={r.from} compact size="sm" />;
}

const styles = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  chipSm: { paddingHorizontal: 6, paddingVertical: 2 },
  text: { fontFamily: F.display, fontSize: 14 },
});
