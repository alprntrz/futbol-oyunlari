import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming, ZoomIn } from "react-native-reanimated";

import { useI18n } from "~/lib/i18n";
import { F } from "~/lib/theme";

import { NIGHT } from "./StadiumHeader";
import { Text } from "./Text";

export interface QuizProfile {
  level: number;
  /** XP into the current level, and what the level needs */
  into: number;
  need: number;
  xp: number;
  points: number;
  games: number;
  wins: number;
}

/** Level shield: the number on a gold badge. */
export function LevelBadge({ level, size = 44 }: { level: number; size?: number }) {
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size * 0.32 }]}>
      <Text allowFontScaling={false} style={[styles.badgeText, { fontSize: size * 0.48 }]}>
        {level}
      </Text>
    </View>
  );
}

function Bar({ fraction }: { fraction: number }) {
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.max(0, Math.min(1, fraction)) * 100}%` }]} />
    </View>
  );
}

/** Level, XP towards the next one and a few totals: the top of the quiz hub. */
export function LevelCard({ profile }: { profile: QuizProfile | null }) {
  const { t } = useI18n();
  const p = profile ?? { level: 1, into: 0, need: 100, xp: 0, points: 0, games: 0, wins: 0 };
  return (
    <View style={styles.card}>
      <LevelBadge level={p.level} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={styles.row}>
          <Text style={styles.level}>
            {t("qzLevel")} {p.level}
          </Text>
          <Text style={styles.xp}>
            {p.into}/{p.need} XP
          </Text>
        </View>
        <Bar fraction={p.into / p.need} />
        <Text style={styles.totals}>
          {p.games} {t("qzGames")}, {p.wins} {t("qzWins")}, {p.points} {t("qzPoints")}
        </Text>
      </View>
    </View>
  );
}

/**
 * End of a game: "+48 XP" and the bar filling from where you were. Crossing a
 * level runs the bar to the end, resets it and shows the new level.
 */
export function LevelProgress({ gained, before, after }: { gained: number; before: QuizProfile; after: QuizProfile }) {
  const { t } = useI18n();
  const levelled = after.level > before.level;
  const w = useSharedValue(before.into / before.need);

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);
    const end = after.into / after.need;
    w.set(
      levelled
        ? withDelay(500, withSequence(withTiming(1, { duration: 600, easing: ease }), withTiming(0, { duration: 0 }), withTiming(end, { duration: 500, easing: ease })))
        : withDelay(500, withTiming(end, { duration: 800, easing: ease }))
    );
  }, [w, levelled, after.into, after.need]);

  const fill = useAnimatedStyle(() => ({ width: `${w.get() * 100}%` }));

  return (
    <Animated.View entering={FadeIn.delay(350).duration(250)} style={styles.card}>
      <LevelBadge level={after.level} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={styles.row}>
          <Text style={styles.level}>{levelled ? t("qzLevelUp") : `${t("qzLevel")} ${after.level}`}</Text>
          <Animated.View entering={ZoomIn.delay(450).duration(220)}>
            <Text style={styles.gained}>+{gained} XP</Text>
          </Animated.View>
        </View>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, fill]} />
        </View>
        <Text style={styles.totals}>
          {after.into}/{after.need} XP
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: NIGHT.light ? NIGHT.raised : NIGHT.sunk, borderWidth: NIGHT.light ? 1 : 0, borderColor: NIGHT.line, borderRadius: 20, padding: 14 },
  badge: { backgroundColor: "#FACC15", borderWidth: 3, borderColor: "#FEF08A", alignItems: "center", justifyContent: "center" },
  badgeText: { fontFamily: F.black, color: "#422006" },
  row: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  level: { fontFamily: F.display, fontSize: 20, color: NIGHT.ink },
  xp: { fontSize: 13, fontWeight: "700", color: NIGHT.ink3 },
  gained: { fontFamily: F.black, fontSize: 20, color: NIGHT.gold },
  track: { height: 8, borderRadius: 4, backgroundColor: NIGHT.light ? NIGHT.sunk : "rgba(255,255,255,0.16)", overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4, backgroundColor: NIGHT.accent },
  totals: { fontSize: 13, color: NIGHT.ink2, fontWeight: "600" },
});
