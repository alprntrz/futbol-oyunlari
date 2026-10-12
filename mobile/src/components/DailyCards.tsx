import { useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";

import { REWARD } from "~/lib/brand";
import { CALENDAR, claimDaily, useDailyRewards } from "~/lib/dailyRewards";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { ALL_DONE_BONUS, useQuests } from "~/lib/quests";
import { C, F, T } from "~/lib/theme";

import { SmoothBar } from "./motion";
import { Text } from "./Text";
import { Card, Icon, Tap } from "./ui";

/** Seven days in a row; today's reward breathes until it's claimed. */
export function DailyRewardCard() {
  const { t } = useI18n();
  const { todayIndex, claimed } = useDailyRewards();
  const pulse = useSharedValue(1);
  const pop = useSharedValue(1);

  useEffect(() => {
    pulse.set(claimed ? 1 : withRepeat(withSequence(withTiming(1.08, { duration: 650 }), withTiming(1, { duration: 650 })), -1));
  }, [claimed, pulse]);
  const todayStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.get() * pop.get() }] }));

  const claim = () => {
    haptic.success();
    pop.set(withSequence(withTiming(1.35, { duration: 120 }), withSpring(1, { damping: 7, stiffness: 240 })));
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

/** Today's three quests with their bars; a finished one turns green with a tick. */
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
        <Text style={T.headline}>{t("questsTitle")}</Text>
        <Text style={T.caption}>{t("questsResets").replace("{h}", String(hours))}</Text>
      </View>
      {quests.map((q) => {
        const done = q.progress >= q.target;
        return (
          <View key={q.id} style={styles.quest}>
            <View style={[styles.questIcon, done && { backgroundColor: C.green }]}>
              {done ? <Icon name="checkmark" size={14} color="white" fallback="✓" /> : <Icon name="target" size={15} color={C.greenDark} fallback="◎" />}
            </View>
            <View style={{ flex: 1, gap: 5 }}>
              <View style={styles.questTop}>
                <Text style={[styles.questText, done && { color: C.text3, textDecorationLine: "line-through" }]} numberOfLines={1}>
                  {t(q.text as Parameters<typeof t>[0]).replace("{n}", String(q.target))}
                </Text>
                <Text style={styles.questReward}>+{q.reward}</Text>
              </View>
              <View style={styles.questBarRow}>
                <View style={{ flex: 1 }}>
                  <SmoothBar fraction={q.progress / q.target} color={done ? C.green : C.amber} height={8} />
                </View>
                <Text style={styles.questCount}>
                  {q.progress}/{q.target}
                </Text>
              </View>
            </View>
          </View>
        );
      })}
      <Text style={[T.caption, { marginTop: 10, textAlign: "center" }, allDone && { color: C.greenDark, fontWeight: "700" }]}>
        {allDone ? t("questAllDone") : t("questsAllBonus").replace("{n}", String(ALL_DONE_BONUS))}
      </Text>
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
  quest: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  questIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.greenSoft, alignItems: "center", justifyContent: "center" },
  questTop: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  questText: { flex: 1, fontSize: 15, fontWeight: "600", color: C.text },
  questReward: { fontFamily: F.display, fontSize: 14, color: C.amber },
  questBarRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  questCount: { fontFamily: F.display, fontSize: 13, color: C.text2, minWidth: 34, textAlign: "right" },
});
