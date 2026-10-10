import { Pressable, StyleSheet, Text, View } from "react-native";

import type { TileMark } from "@/lib/types";

import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { C, F } from "~/lib/theme";

import { Icon } from "./ui";

const ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
const MARK_BG: Record<TileMark, string> = { correct: C.tileCorrect, present: C.tilePresent, absent: C.tileAbsent };

/** Light on-screen keyboard; emits a letter, "ENTER" or "DELETE". */
export function Keyboard({ onKey, marks }: { onKey: (key: string) => void; marks: Record<string, TileMark> }) {
  const { t } = useI18n();

  const press = (value: string) => {
    haptic.tap();
    onKey(value);
  };

  return (
    <View style={{ gap: 8 }}>
      {ROWS.map((row, ri) => (
        <View key={row} style={styles.row}>
          {ri === 2 && (
            <Pressable onPress={() => press("ENTER")} style={({ pressed }) => [styles.key, styles.wide, { backgroundColor: C.green }, pressed && styles.pressed]}>
              <Text style={[styles.label, { color: "white", fontSize: 18 }]}>{t("guess")}</Text>
            </Pressable>
          )}
          {row.split("").map((ch) => {
            const m = marks[ch];
            return (
              <Pressable
                key={ch}
                onPress={() => press(ch)}
                style={({ pressed }) => [styles.key, styles.letter, { backgroundColor: m ? MARK_BG[m] : C.key }, pressed && styles.pressed]}
              >
                <Text style={[styles.label, { color: m ? "white" : C.text }]}>{ch}</Text>
              </Pressable>
            );
          })}
          {ri === 2 && (
            <Pressable onPress={() => press("DELETE")} style={({ pressed }) => [styles.key, styles.wide, pressed && styles.pressed]}>
              <Icon name="delete.left" size={20} color={C.text} fallback="⌫" />
            </Pressable>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "center", gap: 5 },
  key: { height: 50, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: C.key },
  letter: { flex: 1, maxWidth: 38 },
  wide: { flex: 1.7, maxWidth: 66 },
  label: { fontFamily: F.display, fontSize: 22 },
  pressed: { opacity: 0.6, transform: [{ scale: 0.94 }] },
});
