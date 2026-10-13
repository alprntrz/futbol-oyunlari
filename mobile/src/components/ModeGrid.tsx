import type { SymbolViewProps } from "expo-symbols";
import { router, type Href } from "expo-router";
import { Image, StyleSheet, View, type ImageSourcePropType } from "react-native";
import Animated from "react-native-reanimated";

import { C, F, R } from "~/lib/theme";

import { softIn } from "./motion";
import { Text } from "./Text";
import { Icon, Tap } from "./ui";

export interface Mode {
  /** our 3D art; when given it replaces the symbol */
  image?: ImageSourcePropType;
  icon: SymbolViewProps["name"];
  fallback: string;
  title: string;
  desc: string;
  href: Href;
  color: string;
  soft: string;
}

/** Ways to play a game, as a 2-column grid of cards. */
export function ModeGrid({ modes }: { modes: Mode[] }) {
  return (
    <View style={styles.grid}>
      {modes.map((m, i) => (
        <Animated.View key={m.title} entering={softIn(i, 50)} style={styles.cell}>
          <Tap onPress={() => router.push(m.href)} style={styles.card} accessibilityLabel={`${m.title}. ${m.desc}`}>
            <View style={[styles.icon, { backgroundColor: m.image ? "#EEF2EF" : m.soft }]}>
              {m.image ? <Image source={m.image} style={styles.art} /> : <Icon name={m.icon} size={24} color={m.color} fallback={m.fallback} />}
            </View>
            <Text style={styles.title} numberOfLines={1}>
              {m.title}
            </Text>
            <Text style={styles.desc} numberOfLines={2}>
              {m.desc}
            </Text>
          </Tap>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  cell: { width: "47.9%" },
  card: {
    minHeight: 150,
    backgroundColor: C.card,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontFamily: F.display,
    fontSize: 21,
    lineHeight: 23,
    color: C.text,
    textAlign: "center",
  },
  desc: { fontSize: 13, lineHeight: 18, color: C.text2, textAlign: "center" },
  list: {
    backgroundColor: C.card,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 64,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  art: { width: 48, height: 48 },
  rowArt: { width: 40, height: 40 },
  rowTitle: {
    fontFamily: F.display,
    fontSize: 20,
    lineHeight: 22,
    color: C.text,
  },
  rowDesc: { fontSize: 14, lineHeight: 18, color: C.text2, marginTop: 1 },
});

/** Ways to play as a grouped list of rows; reads better than a grid for three or fewer. */
export function ModeList({ modes, onPick }: { modes: Mode[]; onPick?: (m: Mode) => void }) {
  return (
    <View style={styles.list}>
      {modes.map((m, i) => (
        <Animated.View key={m.title} entering={softIn(i, 50)}>
          <Tap onPress={() => (onPick ? onPick(m) : router.push(m.href))} style={[styles.row, i > 0 && styles.rowDivider]} accessibilityLabel={`${m.title}. ${m.desc}`}>
            <View style={[styles.rowIcon, { backgroundColor: m.image ? "#EEF2EF" : m.soft }]}>
              {m.image ? <Image source={m.image} style={styles.rowArt} /> : <Icon name={m.icon} size={20} color={m.color} fallback={m.fallback} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {m.title}
              </Text>
              <Text style={styles.rowDesc} numberOfLines={1}>
                {m.desc}
              </Text>
            </View>
            <Icon name="chevron.right" size={14} color={C.text3} fallback="›" />
          </Tap>
        </Animated.View>
      ))}
    </View>
  );
}
