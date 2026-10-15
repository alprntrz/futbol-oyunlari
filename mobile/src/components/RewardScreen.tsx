import { useEffect, useState } from "react";
import { Image, Modal, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  Keyframe,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { rankOf } from "@/lib/levels";

import { REWARD } from "~/lib/brand";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { play } from "~/lib/sound";
import { C, F } from "~/lib/theme";
import { onOverlay, onXpAward, setRewardOpen, type XpAward, type XpStat } from "~/lib/xp";

import { Confetti, useCountUp } from "./motion";
import { LevelBadge } from "./QuizLevel";
import { useRankName } from "./Rank";
import { Text } from "./Text";
import { Button } from "./ui";

const TONE: Record<NonNullable<XpStat["tone"]>, string> = { green: "#22C55E", amber: "#F59E0B", blue: "#38BDF8", coral: "#FB7185" };

const SLAM = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 1.8 }, { rotate: "-8deg" }] },
  55: { opacity: 1, transform: [{ scale: 0.92 }, { rotate: "2deg" }] },
  100: { opacity: 1, transform: [{ scale: 1 }, { rotate: "0deg" }] },
}).duration(460);

const tileIn = (i: number) =>
  new Keyframe({
    0: { opacity: 0, transform: [{ translateY: 30 }, { scale: 0.7 }] },
    65: { opacity: 1, transform: [{ translateY: -4 }, { scale: 1.06 }] },
    100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
  })
    .delay(650 + i * 160)
    .duration(380);

/**
 * End-of-game reward moment (awards that carry stats): the trophy and title slam
 * in, the stat tiles pop in one by one, then "Claim XP" counts the
 * XP up and fills the level bar (a level-up gets its own beat). Mounted once in the
 * root layout; waits while a Victory ceremony is open.
 */
export function RewardScreen() {
  const [queue, setQueue] = useState<XpAward[]>([]);
  const [overlay, setOverlay] = useState(false);
  const award = overlay ? null : (queue[0] ?? null);

  useEffect(() => onXpAward((a) => a.stats && setQueue((q) => [...q, a])), []);
  useEffect(() => onOverlay(setOverlay), []);

  if (!award) return null;
  return <RewardModal key={award.key} award={award} onDone={() => setQueue((q) => q.slice(1))} />;
}

function RewardModal({ award, onDone }: { award: XpAward; onDone: () => void }) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [claimed, setClaimed] = useState(false);
  const [confetti, setConfetti] = useState(0);
  const levelled = award.after.level > award.before.level;
  const rankedUp = rankOf(award.after.level).index > rankOf(award.before.level).index;
  const rankName = useRankName();
  const stats = award.stats ?? [];

  useEffect(() => {
    haptic.success();
    play("victory");
    const ids = stats.map((_, i) => setTimeout(() => play("pop"), 650 + i * 160));
    return () => ids.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // claim: the number counts up, the bar fills (to the end and over on a level-up)
  const xpShown = useCountUp(claimed ? award.gained : 0, 900);
  const bar = useSharedValue(award.before.into / award.before.need);
  const badge = useSharedValue(1);
  const claim = () => {
    setClaimed(true);
    setConfetti(Date.now());
    haptic.success();
    play("coin");
    const end = award.after.into / award.after.need;
    if (levelled) {
      bar.set(withSequence(withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) }), withTiming(0, { duration: 0 }), withTiming(end, { duration: 450 })));
      badge.set(withDelay(650, withSequence(withTiming(1.15, { duration: 200 }), withTiming(1, { duration: 180 }))));
      setTimeout(() => (haptic.success(), play("levelup")), 650);
    } else {
      bar.set(withTiming(end, { duration: 900, easing: Easing.out(Easing.cubic) }));
      setTimeout(() => play("coin"), 450);
    }
  };
  const barStyle = useAnimatedStyle(() => ({ width: `${Math.max(3, bar.get() * 100)}%` }));
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: badge.get() }] }));

  useEffect(() => {
    setRewardOpen(true);
    return () => setRewardOpen(false);
  }, []);

  return (
    <Modal visible animationType="fade" transparent statusBarTranslucent onRequestClose={onDone}>
      <View style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }]}>
        {/* explicit size: absoluteFill on an Image misrenders in RN */}
        <Image source={REWARD.stars} style={{ position: "absolute", top: 0, left: 0, width, height, opacity: 0.6 }} resizeMode="cover" />
        <View style={{ flex: 1 }} />

        <View style={styles.hero}>
          <Animated.Image entering={SLAM} source={REWARD.trophy} style={styles.trophy} resizeMode="contain" />
        </View>

        <Animated.View entering={SLAM.delay(180)}>
          <Text style={styles.title}>{award.title ?? t("rwDone")}</Text>
        </Animated.View>

        <View style={styles.tiles}>
          {stats.map((s, i) => (
            <Animated.View key={s.label} entering={tileIn(i)} style={[styles.tile, { borderColor: TONE[s.tone ?? "green"] }]}>
              <View style={[styles.tileHead, { backgroundColor: TONE[s.tone ?? "green"] }]}>
                <Text allowFontScaling={false} style={styles.tileLabel} numberOfLines={1}>
                  {s.label}
                </Text>
              </View>
              <Text allowFontScaling={false} style={[styles.tileValue, { color: TONE[s.tone ?? "green"] }]} numberOfLines={1} adjustsFontSizeToFit>
                {s.value}
              </Text>
            </Animated.View>
          ))}
        </View>

        <View style={styles.levelRow}>
          <Animated.View style={badgeStyle}>
            <LevelBadge level={claimed ? award.after.level : award.before.level} size={44} />
          </Animated.View>
          <View style={{ flex: 1 }}>
            <View style={styles.track}>
              <Animated.View style={[styles.fill, barStyle]} />
            </View>
            {claimed && levelled && <Text style={styles.levelUp}>{t("levelUpTo").replace("{n}", String(award.after.level))}</Text>}
            {claimed && rankedUp && (
              <Animated.View entering={SLAM.delay(700)}>
                <Text style={styles.rankUp}>{t("rankUp").replace("{rank}", rankName(award.after.level))}</Text>
              </Animated.View>
            )}
          </View>
          <Text style={styles.xp}>+{claimed ? xpShown : award.gained} XP</Text>
        </View>

        <View style={{ flex: 1 }} />
        <View style={{ alignSelf: "stretch" }}>
          {claimed ? (
            <Button title={t("vcContinue")} onPress={onDone} />
          ) : (
            <Animated.View entering={tileIn(stats.length)}>
              <Button title={t("rwClaim")} kind="gold" icon="star.fill" onPress={claim} />
            </Animated.View>
          )}
        </View>
        <Confetti fire={confetti} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.greenDark, alignItems: "center", paddingHorizontal: 20 },
  hero: { width: 240, height: 220, alignItems: "center", justifyContent: "center", marginTop: 20 },
  trophy: { width: 190, height: 190 },
  title: { fontFamily: F.black, fontSize: 40, color: "white", textAlign: "center", marginTop: 8 },
  tiles: { flexDirection: "row", gap: 10, marginTop: 24, alignSelf: "stretch", justifyContent: "center" },
  tile: { flex: 1, maxWidth: 120, borderWidth: 2.5, borderRadius: 16, overflow: "hidden", backgroundColor: "rgba(0,0,0,0.25)", alignItems: "center" },
  tileHead: { alignSelf: "stretch", paddingVertical: 4, alignItems: "center" },
  tileLabel: { fontFamily: F.display, fontSize: 13, color: "white", letterSpacing: 0.5 },
  tileValue: { fontFamily: F.black, fontSize: 28, paddingVertical: 10, paddingHorizontal: 6 },
  levelRow: { flexDirection: "row", alignItems: "center", gap: 12, alignSelf: "stretch", marginTop: 28 },
  track: { height: 14, borderRadius: 7, backgroundColor: "rgba(255,255,255,0.18)", overflow: "hidden" },
  fill: { height: 14, borderRadius: 7, backgroundColor: "#FACC15" },
  rankUp: { fontFamily: F.black, fontSize: 18, color: "white", marginTop: 2 },
  levelUp: { fontFamily: F.display, fontSize: 16, color: "#FACC15", marginTop: 4 },
  xp: { fontFamily: F.black, fontSize: 26, color: "#FACC15", minWidth: 90, textAlign: "right" },
});
