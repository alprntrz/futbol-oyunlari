import { useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";

import { REWARD } from "~/lib/brand";
import { CALENDAR, claimDaily, useDailyRewards } from "~/lib/dailyRewards";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { ALL_DONE_BONUS, useQuests } from "~/lib/quests";
import { C, F, T } from "~/lib/theme";

import { Text } from "./Text";
import { Card, Icon, Tap } from "./ui";

/** Seven days in a row; today's reward breathes until it's claimed. */
export function DailyRewardCard() {
  const { t } = useI18n();
  const { todayIndex, claimed } = useDailyRewards();
  const pulse = useSharedValue(1);
  const pop = useSharedValue(1);

  useEffect(() => {
    pulse.set(claimed ? 1 : withRepeat(withSequence(withTiming(1.04, { duration: 1000 }), withTiming(1, { duration: 1000 })), -1));
  }, [claimed, pulse]);
  const todayStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.get() * pop.get() }] }));

  const claim = () => {
    haptic.success();
    pop.set(withSequence(withTiming(1.12, { duration: 120 }), withTiming(1, { duration: 180 })));
    claimDaily();
  };

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Image source={REWARD.chest} style={{ width: 34, height: 34 }} />
        <View style={{ flex: 1 }}>
          <Text style={T.headline}>{t("dailyTitle")}</Text>
          <Text style={[T.caption, { marginTop: 1 }]}>
            {claimed && todayIndex < CALENDAR.length - 1 ? t("dailyTomorrow").replace("{n}", String(CALENDAR[todayIndex + 1])) : t("calendarDesc")}
          </Text>
        </View>
      </View>
      <View style={styles.days}>
        {CALENDAR.map((xp, i) => {
          const done = i < todayIndex || (i === todayIndex && claimed);
          const today = i === todayIndex && !claimed;
          const body = (
            <View style={[styles.day, done && styles.dayDone, today && styles.dayToday, i === CALENDAR.length - 1 && !done && !today && styles.dayBig]}>
              {done ? (
                <Icon name="checkmark" size={14} color="white" fallback="✓" />
              ) : (
                <Text allowFontScaling={false} style={[styles.dayXp, today && { color: "#3B2A05" }]}>
                  {xp}
                </Text>
              )}
            </View>
          );
          return (
            <View key={i} style={styles.dayCol}>
              {today ? (
                <Tap onPress={claim} accessibilityRole="button" accessibilityLabel={`${t("dailyClaim")} +${xp} XP`}>
                  <Animated.View style={todayStyle}>{body}</Animated.View>
                </Tap>
              ) : (
                body
              )}
              <Text allowFontScaling={false} style={[styles.dayLabel, today && { color: C.text, fontWeight: "800" }]}>
                {today ? t("dailyClaim") : `${i + 1}`}
              </Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

/** Whole hours until local midnight (at least 1): when the daily things reset. */
export function hoursLeft() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.max(1, Math.ceil((midnight.getTime() - now.getTime()) / 3600000));
}

/**
 * Today's three quests, Duolingo style: the task, a thick bar with the count
 * inside it, and a chest on the right that opens when it's done. Finishing all
 * three opens the big chest (ALL_DONE_BONUS).
 */
export function QuestsCard() {
  const { t } = useI18n();
  const quests = useQuests();
  const [hours, setHours] = useState(hoursLeft);
  useEffect(() => {
    const id = setInterval(() => setHours(hoursLeft()), 60000);
    return () => clearInterval(id);
  }, []);
  const allDone = quests.every((q) => q.progress >= q.target);

  return (
    <Card style={styles.card}>
      <View style={styles.headRow}>
        <Text style={styles.qTitle}>{t("questsTitle")}</Text>
        <View style={styles.clock}>
          <Icon name="clock" size={13} color={C.text2} fallback="⏱" />
          <Text style={styles.clockText}>{t("lgHours").replace("{n}", String(hours))}</Text>
        </View>
      </View>
      {quests.map((q) => {
        const done = q.progress >= q.target;
        const frac = Math.min(1, q.progress / q.target);
        return (
          <View key={q.id} style={styles.quest}>
            <View style={{ flex: 1, gap: 7 }}>
              <Text style={[styles.questText, done && { color: C.text2 }]} numberOfLines={2}>
                {t(q.text as Parameters<typeof t>[0]).replace("{n}", String(q.target))}
              </Text>
              <View style={styles.bar}>
                <View style={[styles.barFill, { width: `${Math.max(frac * 100, frac > 0 ? 8 : 0)}%` }, done && { backgroundColor: C.green }]} />
                <Text style={styles.barText}>
                  {Math.min(q.progress, q.target)} / {q.target}
                </Text>
              </View>
            </View>
            <View style={styles.chestCol}>
              <Image source={done ? REWARD.chestOpen : REWARD.chest} style={[styles.chest, !done && { opacity: 0.95 }]} />
              <Text style={[styles.questReward, done && { color: C.greenDark }]}>{done ? "✓" : `+${q.reward}`}</Text>
            </View>
          </View>
        );
      })}
      {/* all three: the big chest */}
      <View style={[styles.bonus, allDone && { backgroundColor: C.greenSoft }]}>
        <Image source={allDone ? REWARD.chestOpen : REWARD.chest} style={styles.bonusChest} />
        <Text style={[styles.bonusText, allDone && { color: C.greenDark }]}>{allDone ? t("questAllDone") : t("questsAllBonus").replace("{n}", String(ALL_DONE_BONUS))}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, marginTop: 12 },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 },
  days: { flexDirection: "row", justifyContent: "space-between", marginTop: 14 },
  dayCol: { alignItems: "center", gap: 4 },
  day: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#EEF2EF", alignItems: "center", justifyContent: "center" },
  dayDone: { backgroundColor: C.green },
  dayToday: { backgroundColor: "#FACC15", borderWidth: 3, borderColor: "#F59E0B" },
  dayBig: { backgroundColor: "#FEF3C7" },
  dayXp: { fontFamily: F.display, fontSize: 14, color: C.text2 },
  dayLabel: { fontSize: 11, fontWeight: "600", color: C.text3 },
  quest: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 16 },
  qTitle: { fontFamily: F.display, fontSize: 22, color: C.text },
  clock: { flexDirection: "row", alignItems: "center", gap: 5 },
  clockText: { fontWeight: "700", fontSize: 13, color: C.text2 },
  bar: { height: 20, borderRadius: 10, backgroundColor: "#E3E8E4", overflow: "hidden", justifyContent: "center" },
  barFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 10, backgroundColor: "#FACC15" },
  barText: { textAlign: "center", fontFamily: F.display, fontSize: 13, color: C.text },
  chestCol: { alignItems: "center", width: 56 },
  chest: { width: 52, height: 52, resizeMode: "contain" },
  bonus: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16, backgroundColor: "#FEF3C7", borderRadius: 14, padding: 10 },
  bonusChest: { width: 40, height: 40, resizeMode: "contain" },
  bonusText: { flex: 1, fontFamily: F.display, fontSize: 15, color: "#92400E" },
  questIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.greenSoft, alignItems: "center", justifyContent: "center" },
  questTop: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  questText: { fontFamily: F.display, fontSize: 18, color: C.text },
  questReward: { fontFamily: F.display, fontSize: 13, color: "#B45309", marginTop: -2 },
  questBarRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  questCount: { fontFamily: F.display, fontSize: 13, color: C.text2, minWidth: 34, textAlign: "right" },
});
