import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";

import { haptic } from "~/lib/haptics";
import type { Mark } from "~/lib/hattrick";
import { useI18n } from "~/lib/i18n";
import { C, F, T } from "~/lib/theme";

import { MARK } from "./HatTrickBoard";
import { Text } from "./Text";

export interface Side {
  name: string;
  mark: Mark;
}

const COUNT = 3;

/** "Match found": both players facing off and a 3-2-1 before the board opens. */
export function MatchIntro({ me, opponent, onDone }: { me: Side; opponent: Side; onDone: () => void }) {
  const { t } = useI18n();
  const [n, setN] = useState(COUNT);

  useEffect(() => {
    haptic.success();
    const id = setInterval(() => setN((x) => x - 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (n > 0) haptic.tap();
    else onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  // X always on the left, like on the board
  const [left, right] = me.mark === "X" ? [me, opponent] : [opponent, me];

  return (
    <View style={styles.wrap}>
      <Animated.View entering={FadeIn.duration(200)}>
        <Text style={[T.caption, styles.kicker]}>{t("htMatchFound")}</Text>
      </Animated.View>
      <View style={styles.row}>
        <Player side={left} you={left === me} />
        <Text style={styles.vs}>VS</Text>
        <Player side={right} you={right === me} />
      </View>
      <View style={styles.countSlot}>
        {n > 0 && (
          // plain Text inside: Animated.Text can drop narrow glyphs like "1"
          <Animated.View key={n} entering={ZoomIn.duration(220)}>
            <Text style={styles.count}>{n}</Text>
          </Animated.View>
        )}
      </View>
      <Text style={[T.body, { textAlign: "center" }]}>{t(me.mark === "X" ? "htYouStart" : "htTheyStart")}</Text>
    </View>
  );
}

function Player({ side, you }: { side: Side; you: boolean }) {
  const { t } = useI18n();
  const m = MARK[side.mark];
  return (
    <Animated.View entering={FadeIn.duration(250).delay(side.mark === "X" ? 0 : 120)} style={styles.player}>
      <View style={[styles.disc, { backgroundColor: m.soft, borderColor: m.color }]}>
        <Text style={[styles.mark, { color: m.color }]}>{side.mark}</Text>
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {you ? t("you") : side.name}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingTop: 40, gap: 8 },
  kicker: { textTransform: "uppercase", letterSpacing: 1, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "flex-start", justifyContent: "center", gap: 18, marginTop: 24 },
  player: { width: 120, alignItems: "center", gap: 8 },
  disc: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  mark: { fontFamily: F.black, fontSize: 52, lineHeight: 58 },
  name: { fontFamily: F.display, fontSize: 22, color: C.text, maxWidth: 120 },
  vs: { fontFamily: F.black, fontSize: 30, color: C.text3, marginTop: 30 },
  countSlot: { height: 110, justifyContent: "center", marginTop: 20 },
  count: { fontFamily: F.black, fontSize: 88, lineHeight: 96, color: C.text },
});
