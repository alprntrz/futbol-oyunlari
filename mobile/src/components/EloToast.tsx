import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useI18n } from "~/lib/i18n";
import { getSocket } from "~/lib/socket";
import { C, F, shadow } from "~/lib/theme";
import { onOverlay, onRewardOpen } from "~/lib/xp";

import { Text } from "./Text";
import { Icon } from "./ui";

type Elo = { game: string; rating: number; delta: number; id: number };

/**
 * After a rated online match (signed-in players): the rating change and the new rating,
 * "+18 · Tic-Tac-Toe 1034", at the bottom for a few seconds. Waits for the victory and
 * reward screens to close. Mounted once in the root layout.
 */
export function EloToast() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [pending, setPending] = useState<Elo | null>(null);
  const [shown, setShown] = useState<Elo | null>(null);
  const [blocked, setBlocked] = useState({ overlay: false, reward: false });

  useEffect(() => {
    const socket = getSocket();
    const on = (e: Omit<Elo, "id">) => setPending({ ...e, id: Date.now() });
    socket.on("elo", on);
    const offO = onOverlay((overlay) => setBlocked((b) => ({ ...b, overlay })));
    const offR = onRewardOpen((reward) => setBlocked((b) => ({ ...b, reward })));
    return () => {
      socket.off("elo", on);
      offO();
      offR();
    };
  }, []);

  useEffect(() => {
    if (!pending || blocked.overlay || blocked.reward) return;
    const id = setTimeout(() => {
      setShown(pending);
      setPending(null);
    }, 600);
    return () => clearTimeout(id);
  }, [pending, blocked]);

  useEffect(() => {
    if (!shown) return;
    const id = setTimeout(() => setShown(null), 3500);
    return () => clearTimeout(id);
  }, [shown]);

  if (!shown) return null;
  const up = shown.delta > 0;
  const color = up ? C.greenMid : shown.delta < 0 ? C.red : C.text2;
  const names: Record<string, string> = { ht: t("boardHt"), qz: t("boardQz"), pp: t("boardPp"), dz: t("boardDz"), rd: "Rondo", wm: t("wmName") };
  return (
    <Animated.View key={shown.id} entering={FadeInDown.duration(220)} exiting={FadeOutDown.duration(200)} pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 96 }]}>
      <View style={styles.pill} accessibilityLiveRegion="polite">
        <Icon name={up ? "arrow.up.right" : "arrow.down.right"} size={16} color={color} />
        <Text style={[styles.delta, { color }]}>
          {up ? "+" : ""}
          {shown.delta}
        </Text>
        <Text style={styles.rest}>
          {names[shown.game] ?? ""} · {shown.rating} {t("eloPoints")}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16, alignItems: "center", zIndex: 60 },
  pill: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.card, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 11, borderWidth: 1, borderColor: C.border, ...shadow },
  delta: { fontFamily: F.black, fontSize: 22 },
  rest: { fontFamily: F.semi, fontSize: 16, color: C.text2 },
});
