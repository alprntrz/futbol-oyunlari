import { Pressable, StyleSheet, Text, View } from "react-native";

import type { TileMark } from "@/lib/types";

import { useI18n } from "~/lib/i18n";
import { haptic } from "~/lib/haptics";
import { C, F } from "~/lib/theme";

const ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

const KEY_BG: Record<TileMark | "none", string> = {
  correct: C.tileCorrect,
  present: C.tilePresent,
  absent: C.tileAbsent,
  none: "#71717a",
};

/** On-screen letter keyboard; letters, "ENTER" or "DELETE". */
export function Keyboard({ onKey, marks }: { onKey: (key: string) => void; marks: Record<string, TileMark> }) {
  const { t } = useI18n();

  const key = (label: string, value: string, bg: string, color = "white", wide = false) => (
    <Pressable
      key={value}
      onPress={() => {
        haptic.tap();
        onKey(value);
      }}
      style={({ pressed }) => [
        styles.key,
        wide ? styles.wide : styles.letter,
        { backgroundColor: bg },
        pressed && { opacity: 0.7, transform: [{ scale: 0.94 }] },
      ]}
    >
      <Text style={[styles.label, { color, fontSize: value === "DELETE" ? 20 : wide ? 12 : 16 }]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ gap: 7 }}>
      {ROWS.map((row, ri) => (
        <View key={row} style={styles.row}>
          {ri === 2 && key(t("keyboardEnter"), "ENTER", C.indigo, "white", true)}
          {row.split("").map((ch) => {
            const m = marks[ch];
            return key(ch, ch, KEY_BG[m ?? "none"], m === "present" ? "black" : m === "absent" ? C.textDim : "white");
          })}
          {ri === 2 && key("⌫", "DELETE", "#52525b", "white", true)}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "center", gap: 5 },
  key: { height: 50, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  letter: { flex: 1, maxWidth: 38 },
  wide: { flex: 1.6, maxWidth: 62 },
  label: { fontFamily: F.black },
});
