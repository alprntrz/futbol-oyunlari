import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { cleanRondoMode, RONDO_PAIR_TARGET, RONDO_PAIR_TARGETS } from "@/lib/rondo";

import { OnlineLobby } from "~/components/OnlineLobby";
import { Text } from "~/components/Text";
import { Tap } from "~/components/ui";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { C, F, T } from "~/lib/theme";

/** Rondo with a friend: open a room (the server deals the clubs) or join by code; the two-club duel picks its length. */
export default function RondoLobby() {
  const { t } = useI18n();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode] = useState(() => cleanRondoMode(params.mode));
  const [target, setTarget] = useState<number>(RONDO_PAIR_TARGET);
  const pair = mode === "pair";
  return (
    <OnlineLobby
      game="rd"
      title={pair ? t("rdModePair") : "Rondo"}
      createPayload={() => ({ mode, target })}
      roomHref={(code) => ({ pathname: "/rondo/oda/[code]", params: { code } })}
      createOptions={
        pair ? (
          <View style={styles.row}>
            <Text style={[T.caption, { flex: 1 }]}>{t("rdBestOf")}</Text>
            {RONDO_PAIR_TARGETS.map((n) => (
              <Tap key={n} onPress={() => (haptic.tap(), setTarget(n))} style={[styles.pill, target === n && styles.pillOn]} accessibilityRole="button" accessibilityState={{ selected: target === n }} accessibilityLabel={t("rdBestOfN").replace("{n}", String(n))}>
                <Text style={[styles.pillText, target === n && { color: "white" }]}>{n * 2 - 1}</Text>
              </Tap>
            ))}
          </View>
        ) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  pill: { minWidth: 44, alignItems: "center", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  pillOn: { backgroundColor: C.greenMid, borderColor: C.greenMid },
  pillText: { fontFamily: F.display, fontSize: 16, color: C.text },
});
