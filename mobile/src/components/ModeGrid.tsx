import type { SymbolViewProps } from "expo-symbols";
import { router, type Href } from "expo-router";
import { StyleSheet, View } from "react-native";

import { C, F, R } from "~/lib/theme";

import { Text } from "./Text";
import { Icon, Tap } from "./ui";

export interface Mode {
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
      {modes.map((m) => (
        <Tap key={m.title} onPress={() => router.push(m.href)} style={styles.card} accessibilityLabel={`${m.title}. ${m.desc}`}>
          <View style={[styles.icon, { backgroundColor: m.soft }]}>
            <Icon name={m.icon} size={24} color={m.color} fallback={m.fallback} />
          </View>
          <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
            {m.title}
          </Text>
          <Text style={styles.desc} numberOfLines={2}>
            {m.desc}
          </Text>
        </Tap>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: {
    width: "47.9%",
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
  rowTitle: {
    fontFamily: F.display,
    fontSize: 20,
    lineHeight: 22,
    color: C.text,
  },
  rowDesc: { fontSize: 14, lineHeight: 18, color: C.text2, marginTop: 1 },
});

/** Ways to play as a grouped list of rows; reads better than a grid for three or fewer. */
export function ModeList({ modes }: { modes: Mode[] }) {
  return (
    <View style={styles.list}>
      {modes.map((m, i) => (
        <Tap key={m.title} onPress={() => router.push(m.href)} style={[styles.row, i > 0 && styles.rowDivider]} accessibilityLabel={`${m.title}. ${m.desc}`}>
          <View style={[styles.rowIcon, { backgroundColor: m.soft }]}>
            <Icon name={m.icon} size={20} color={m.color} fallback={m.fallback} />
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
      ))}
    </View>
  );
}
