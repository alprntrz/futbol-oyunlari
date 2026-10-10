import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, FadeInLeft } from "react-native-reanimated";

import { dayNumber } from "@/lib/daily";

import { Text } from "~/components/Text";
import { useCountUp } from "~/components/motion";
import { Card, Icon, Page, SectionLabel } from "~/components/ui";
import { BRAND } from "~/lib/brand";
import { useI18n } from "~/lib/i18n";
import { loadStats, type GameStats } from "~/lib/storage";
import { C, F, T } from "~/lib/theme";

const BUCKETS: { label: string; test: (n: number) => boolean }[] = [
  { label: "11", test: (n) => n === 11 },
  { label: "10", test: (n) => n === 10 },
  { label: "9", test: (n) => n === 9 },
  { label: "8", test: (n) => n === 8 },
  { label: "7", test: (n) => n === 7 },
  { label: "≤6", test: (n) => n <= 6 },
];

const WEEKS = 5;

/** Square colour for a day by how many players were found. */
const dayColor = (found: number | undefined) =>
  found === undefined ? "#E3E8E4" : found === 11 ? C.green : found >= 8 ? "#7BCB95" : found >= 5 ? "#BFE6CB" : "#F2C9C9";

export default function StatsTab() {
  const { t, locale } = useI18n();
  const [s, setS] = useState<GameStats | null>(null);
  const [calW, setCalW] = useState(0);
  const cell = calW ? (calW - 6 * 6) / 7 : 0;

  useFocusEffect(
    useCallback(() => {
      loadStats().then(setS);
    }, [])
  );

  const streak = useCountUp(s?.streak ?? 0);
  const played = useCountUp(s?.played ?? 0);
  const winRate = useCountUp(s && s.played ? Math.round((s.won / s.played) * 100) : 0);

  const history = Object.values(s?.history ?? {});
  const counts = BUCKETS.map((b) => history.filter(b.test).length);
  const maxCount = Math.max(1, ...counts);
  const today = dayNumber();
  // Calendar ends on today; rows are weeks, oldest first
  const days = Array.from({ length: WEEKS * 7 }, (_, i) => today - (WEEKS * 7 - 1 - i));

  return (
    <Page topInset>
      <Text style={T.largeTitle}>{t("tabStats")}</Text>

      {s && s.played === 0 ? (
        <Card style={{ alignItems: "center", paddingVertical: 32, gap: 12, marginTop: 20 }}>
          <Image source={BRAND.illus.emptyStats} style={{ width: 220, height: 120 }} resizeMode="contain" />
          <Text style={[T.body, { textAlign: "center" }]}>{t("noStatsYet")}</Text>
        </Card>
      ) : (
        <>
          <Animated.View entering={FadeInDown.springify().damping(14)}>
            <View style={styles.streakCard}>
              <Icon name="flame.fill" size={54} color={C.amber} fallback="🔥" />
              <View style={{ flex: 1 }}>
                <Text style={styles.streakValue}>{streak}</Text>
                <Text style={styles.streakLabel}>{t("streak")}</Text>
              </View>
              <View style={styles.side}>
                <Text style={styles.sideValue}>{s?.bestStreak ?? 0}</Text>
                <Text style={styles.sideLabel}>{t("bestStreak")}</Text>
                <Text style={[styles.sideValue, { marginTop: 8 }]}>{played}</Text>
                <Text style={styles.sideLabel}>{t("played")}</Text>
                <Text style={[styles.sideValue, { marginTop: 8 }]}>{locale === "tr" ? `%${winRate}` : `${winRate}%`}</Text>
                <Text style={styles.sideLabel}>{t("winRate")}</Text>
              </View>
            </View>
          </Animated.View>

          <SectionLabel>{t("statsDist")}</SectionLabel>
          <Card style={{ gap: 8 }}>
            {BUCKETS.map((b, i) => (
              <View key={b.label} style={styles.distRow}>
                <Text style={styles.distLabel}>{b.label}</Text>
                <View style={{ flex: 1 }}>
                  <Animated.View
                    entering={FadeInLeft.delay(i * 70).springify().damping(16)}
                    style={[
                      styles.distBar,
                      { width: `${Math.max(8, (counts[i] / maxCount) * 100)}%`, backgroundColor: counts[i] ? (i === 0 ? C.green : i < 3 ? "#4FB874" : "#8FD3A6") : "#E3E8E4" },
                    ]}
                  >
                    <Text style={[styles.distCount, !counts[i] && { color: C.text3 }]}>{counts[i]}</Text>
                  </Animated.View>
                </View>
              </View>
            ))}
          </Card>

          <SectionLabel>{t("statsCalendar")}</SectionLabel>
          <Card>
            <View style={styles.calendar} onLayout={(e) => setCalW(e.nativeEvent.layout.width)}>
              {days.map((d) => (
                <View
                  key={d}
                  style={[styles.day, { width: cell, height: cell, backgroundColor: dayColor(s?.history?.[d]) }, d === today && styles.today]}
                >
                  {s?.history?.[d] !== undefined && <Text style={styles.dayText}>{s.history[d]}</Text>}
                </View>
              ))}
            </View>
          </Card>
        </>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  streakCard: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 20,
    borderRadius: 24,
    backgroundColor: "#FFF4DC",
  },
  streakValue: { fontFamily: F.black, fontSize: 72, lineHeight: 74, color: C.text },
  streakLabel: { fontFamily: F.semi, fontSize: 18, color: "#7A5205", marginTop: -4 },
  side: { alignItems: "flex-end" },
  sideValue: { fontFamily: F.display, fontSize: 24, lineHeight: 26, color: C.text },
  sideLabel: { fontSize: 12, fontWeight: "600", color: "#7A5205" },
  distRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  distLabel: { width: 26, fontFamily: F.display, fontSize: 18, color: C.text2, textAlign: "right" },
  distBar: { height: 26, borderRadius: 7, justifyContent: "center", alignItems: "flex-end", paddingHorizontal: 8 },
  distCount: { fontFamily: F.display, fontSize: 16, color: "white" },
  calendar: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  day: { borderRadius: 8, alignItems: "center", justifyContent: "center" },
  today: { borderWidth: 2.5, borderColor: C.text },
  dayText: { fontFamily: F.display, fontSize: 15, color: C.text },
});
