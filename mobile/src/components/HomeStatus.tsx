import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";

import { useAccount } from "~/lib/account";
import { loadAvatar } from "~/lib/avatar";
import { CALENDAR, claimDaily, useDailyRewards } from "~/lib/dailyRewards";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { loadNick } from "~/lib/nick";
import { usePlayStreak } from "~/lib/playStreak";
import { C, F } from "~/lib/theme";
import { loadXp, onXpAward } from "~/lib/xp";

import { Avatar } from "./Avatar";
import { RankChip } from "./Rank";
import { Text } from "./Text";
import { Icon, Tap } from "./ui";

type Xp = Awaited<ReturnType<typeof loadXp>>;

/** Top of Home: avatar + level bar (opens Profile), play streak, daily reward gift. */
export function HomeStatus() {
  const { t } = useI18n();
  const account = useAccount();
  const [nick, setNick] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [xp, setXp] = useState<Xp | null>(null);
  const streak = usePlayStreak();
  const { todayIndex, claimed } = useDailyRewards();

  const refresh = useCallback(() => {
    loadNick().then(setNick);
    loadAvatar().then(setAvatar);
    loadXp().then(setXp);
  }, []);
  useFocusEffect(refresh);
  // XP from the gift (or a sync) shows at once
  useEffect(() => onXpAward(() => loadXp().then(setXp)), []);
  useEffect(() => {
    if (account !== undefined) refresh();
  }, [account, refresh]);

  // the gift wiggles until today's reward is taken
  const wiggle = useSharedValue(0);
  const pop = useSharedValue(1);
  useEffect(() => {
    wiggle.set(
      claimed
        ? 0
        : withRepeat(withSequence(withTiming(-8, { duration: 90 }), withTiming(8, { duration: 90 }), withTiming(-5, { duration: 80 }), withTiming(0, { duration: 80 }), withTiming(0, { duration: 1400 })), -1)
    );
  }, [claimed, wiggle]);
  const giftStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${wiggle.get()}deg` }, { scale: pop.get() }] }));

  const claim = () => {
    if (claimed) return;
    haptic.success();
    pop.set(withSequence(withTiming(1.35, { duration: 120 }), withSpring(1, { damping: 7, stiffness: 240 })));
    claimDaily();
  };

  const level = xp?.level ?? 1;
  const fraction = xp ? xp.into / xp.need : 0;

  return (
    <View style={styles.row}>
      <Tap onPress={() => router.push("/istatistik")} style={styles.me} accessibilityLabel={`${nick}, ${t("levelN").replace("{n}", String(level))}`}>
        <Avatar id={avatar} size={42} />
        <View style={{ flex: 1 }}>
          <View style={styles.nickRow}>
            <Text style={styles.nick} numberOfLines={1}>
              {nick}
            </Text>
            <RankChip level={level} compact size="sm" />
          </View>
          <View style={styles.levelRow}>
            <Text style={styles.level}>{t("levelN").replace("{n}", String(level))}</Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.max(4, fraction * 100)}%` }]} />
            </View>
          </View>
        </View>
      </Tap>

      <View style={[styles.pill, { backgroundColor: streak.count ? "#FFF4DC" : "#EEF2EF" }]} accessibilityLabel={`${t("streak")}: ${streak.count}`}>
        <Icon name="flame.fill" size={16} color={streak.count ? (streak.playedToday ? C.amber : "#E8B66A") : "#A7B0AA"} fallback="🔥" />
        <Text style={[styles.pillText, { color: streak.count ? "#7A5205" : C.text3 }]}>{streak.count}</Text>
      </View>

      <Tap onPress={claim} accessibilityRole="button" accessibilityLabel={claimed ? t("dailyTitle") : `${t("dailyClaim")} +${CALENDAR[todayIndex]} XP`}>
        <Animated.View style={[styles.pill, { backgroundColor: claimed ? "#EEF2EF" : "#FACC15" }, giftStyle]}>
          <Icon name={claimed ? "checkmark" : "gift.fill"} size={16} color={claimed ? C.text3 : "#3B2A05"} fallback="🎁" />
          {!claimed && <Text style={[styles.pillText, { color: "#3B2A05" }]}>+{CALENDAR[todayIndex]}</Text>}
        </Animated.View>
      </Tap>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  me: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  nickRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  nick: { fontFamily: F.display, fontSize: 19, color: C.text, flexShrink: 1 },
  levelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 1 },
  level: { fontSize: 12, fontWeight: "700", color: C.greenDark },
  track: { flex: 1, maxWidth: 110, height: 7, borderRadius: 4, backgroundColor: "#DDE4DF", overflow: "hidden" },
  fill: { height: 7, borderRadius: 4, backgroundColor: C.green },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, minHeight: 32 },
  pillText: { fontFamily: F.black, fontSize: 16 },
});
