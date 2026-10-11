import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";

import type { TileMark } from "@/lib/types";

import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { C, F } from "~/lib/theme";

import { Text } from "./Text";
import { Icon } from "./ui";

const GAP = 5;
const ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
const MARK_BG: Record<TileMark, string> = { correct: C.tileCorrect, present: C.tilePresent, absent: C.tileAbsent };

/** Light on-screen keyboard; emits a letter, "ENTER" or "DELETE". */
export function Keyboard({ onKey, marks }: { onKey: (key: string) => void; marks: Record<string, TileMark> }) {
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  // Explicit widths: flex:1 keys collapsed to zero in the bottom row on some layouts.
  // The sheet has 12 pt side padding; the top row (10 keys, 9 gaps) sets the key size.
  const rowW = width - 24;
  const keyW = Math.min(38, (rowW - 9 * GAP) / 10);
  // Guess and delete share what the 7 letters and 8 gaps of the bottom row leave
  const sideW = Math.min(90, (rowW - 7 * keyW - 8 * GAP) / 2);

  const press = (value: string) => {
    haptic.tap();
    onKey(value);
  };

  return (
    <View style={{ gap: 8 }}>
      {ROWS.map((row, ri) => (
        <View key={row} style={styles.row}>
          {ri === 2 && (
            <Pressable onPress={() => press("ENTER")} style={({ pressed }) => [styles.key, { width: sideW, paddingHorizontal: 4, backgroundColor: C.green }, pressed && styles.pressed]}>
              <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[styles.label, { color: "white", fontSize: 15 }]}>{t("guess")}</Text>
            </Pressable>
          )}
          {row.split("").map((ch) => {
            const m = marks[ch];
            return (
              <Pressable
                key={ch}
                onPress={() => press(ch)}
                style={({ pressed }) => [styles.key, { width: keyW, backgroundColor: m ? MARK_BG[m] : C.key }, pressed && styles.pressed]}
              >
                <Text allowFontScaling={false} style={[styles.label, { color: m ? "white" : C.text }]}>{ch}</Text>
              </Pressable>
            );
          })}
          {ri === 2 && (
            <Pressable onPress={() => press("DELETE")} style={({ pressed }) => [styles.key, { width: sideW }, pressed && styles.pressed]}>
              <Icon name="delete.left" size={20} color={C.text} fallback="⌫" />
            </Pressable>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "center", gap: GAP },
  key: { height: 50, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: C.key },
  label: { fontFamily: F.display, fontSize: 22 },
  pressed: { opacity: 0.6, transform: [{ scale: 0.94 }] },
});
