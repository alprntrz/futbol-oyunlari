import { StyleSheet, View } from "react-native";

import type { GridPlayer } from "@/data/players";
import { playerInfo } from "@/lib/playerInfo";

import { useI18n } from "~/lib/i18n";
import { C, T } from "~/lib/theme";

import { Text } from "./Text";
import { Icon } from "./ui";

/** shirt colour per position group: keeper amber, defence blue, midfield green, attack coral */
const POS_COLOR = { G: "#F59E0B", D: "#2563EB", M: "#16A34A", F: "#F43F5E" } as const;

export function initials(name: string) {
  const t = name.trim().split(/\s+/);
  return ((t[0]?.[0] ?? "") + (t.length > 1 ? t[t.length - 1][0] : "")).toUpperCase();
}
export function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360}, 45%, 48%)`;
}

/**
 * A search result's badge: a little shirt in the colour of the player's position with their
 * initials on it. No flag or club: those would give a grid square (or a mystery clue) away.
 */
export function PlayerToken({ p }: { p: GridPlayer }) {
  const { pos } = playerInfo(p);
  const color = pos ? POS_COLOR[pos] : avatarColor(p.name);
  return (
    <View style={styles.token}>
      <Icon name="tshirt.fill" size={34} color={color} fallback="👕" />
      <Text allowFontScaling={false} style={styles.tokenText}>
        {initials(p.name)}
      </Text>
    </View>
  );
}

/** The name, and under it "Midfielder · 34" (or "1960–2020" for a player who has died), so namesakes tell apart. */
export function PlayerLine({ p }: { p: GridPlayer }) {
  const { t } = useI18n();
  const { pos, age, life } = playerInfo(p);
  const bits = [pos ? t(`posName_${pos}`) : null, age ? t("ageYears").replace("{n}", String(age)) : life ? `${life[0]}–${life[1]}` : null].filter(Boolean);
  return (
    <View style={{ flex: 1 }}>
      <Text style={[T.headline, { fontSize: 15 }]} numberOfLines={1}>
        {p.name}
      </Text>
      {bits.length > 0 && <Text style={styles.sub}>{bits.join(" · ")}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  token: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  tokenText: { position: "absolute", top: 12, color: "white", fontWeight: "900", fontSize: 11 },
  sub: { fontSize: 13, color: C.text2, marginTop: 1 },
});
