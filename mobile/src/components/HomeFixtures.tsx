import { router, useFocusEffect, type Href } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Image, StyleSheet, View, type ImageSourcePropType } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { dailyMatch, dayNumber } from "@/lib/daily";

import { bingoForDay, CARD_SIZE } from "~/lib/bingo";
import { BRAND, ROZET } from "~/lib/brand";
import { useDuel } from "~/lib/duel";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { C, F, T } from "~/lib/theme";

import { Text } from "./Text";
import { loadToday, type Progress, type Today } from "./TodayPuzzles";
import { Icon, Tap } from "./ui";

type Fixture = { key: string; title: string; image: ImageSourcePropType; href: Href; p: Progress; result: string };

/**
 * Home draft B: today's dailies as a match-day fixture list. The first one not
 * finished is "next" and stands out; finished ones show their result.
 */
export function HomeFixtures() {
  const { t, locale } = useI18n();
  const day = useMemo(() => dayNumber(), []);
  const xiMatchId = useMemo(() => dailyMatch().match.id, []);
  const bingoLength = useMemo(() => bingoForDay(day).stream.length, [day]);
  const [today, setToday] = useState<Today | null>(null);
  const duel = useDuel();

  useFocusEffect(
    useCallback(() => {
      loadToday(day, xiMatchId, bingoLength).then(setToday);
    }, [day, xiMatchId, bingoLength])
  );

  const date = new Date().toLocaleDateString(locale === "tr" ? "tr-TR" : "en-GB", { day: "numeric", month: "long", weekday: "long" });
  const NEW: Progress = { state: "new", count: 0 };
  const duelP: Progress = duel.daily ? { state: "done", count: duel.daily.mine } : NEW;
  const fixtures: Fixture[] = [
    { key: "grid", title: t("homeTodayGrid"), image: BRAND.icon.tiki, href: "/hat-trick/tek", p: today?.grid ?? NEW, result: `${today?.grid.count ?? 0}/9` },
    { key: "xi", title: t("daily"), image: BRAND.icon.daily, href: "/eksik-11/gunluk", p: today?.xi ?? NEW, result: `${today?.xi.count ?? 0}/11` },
    { key: "bingo", title: t("bingoName"), image: BRAND.icon.bingo, href: "/bingo", p: today?.bingo ?? NEW, result: `${today?.bingo.count ?? 0}/${CARD_SIZE}` },
    {
      key: "duel",
      title: t("dzDaily"),
      image: ROZET.duel,
      href: duel.ready ? { pathname: "/duello/mac", params: { mode: "daily" } } : "/duello",
      p: duelP,
      result: duel.daily ? `${duel.daily.mine}–${duel.daily.theirs}` : "",
    },
  ];
  const done = fixtures.filter((f) => f.p.state === "done").length;
  const next = fixtures.findIndex((f) => f.p.state !== "done");

  return (
    <View style={{ marginTop: 14 }}>
      <View style={styles.head}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={styles.headSub}>{date}</Text>
          <Text style={styles.headSub}>{t("homeFixturesCount").replace("{n}", String(done)).replace("{m}", String(fixtures.length))}</Text>
        </View>
        <Text style={styles.headTitle}>{t("homeFixtures")}</Text>
        {/* one segment per fixture, filled when finished */}
        <View style={styles.segments}>
          {fixtures.map((f) => (
            <View key={f.key} style={[styles.segment, f.p.state === "done" && { backgroundColor: "#FACC15" }]} />
          ))}
        </View>
      </View>

      <View style={styles.list}>
        {fixtures.map((f, i) => {
          const isNext = i === next;
          const isDone = f.p.state === "done";
          return (
            <Animated.View key={f.key} entering={FadeInDown.delay(i * 50).duration(220)}>
              <Tap
                onPress={() => (haptic.tap(), router.push(f.href))}
                style={[styles.row, i > 0 && styles.divider, isNext && styles.rowNext]}
                accessibilityLabel={`${f.title}, ${isDone ? t("homeDone") : t("homeNotPlayed")}`}
              >
                <View style={styles.slot}>
                  {isDone ? (
                    <Icon name="checkmark.circle.fill" size={22} color={C.greenMid} fallback="✓" />
                  ) : isNext ? (
                    <Text style={styles.nextTag}>{t("homeNext")}</Text>
                  ) : (
                    <Text style={styles.num}>{i + 1}.</Text>
                  )}
                </View>
                <Image source={f.image} style={[styles.icon, isDone && { opacity: 0.55 }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, isDone && { color: C.text2 }]} numberOfLines={1}>
                    {f.title}
                  </Text>
                  <Text style={T.caption}>{isDone ? t("homeDone") : f.p.state === "started" ? `${t("continueGame")} · ${f.result}` : t("homeNotPlayed")}</Text>
                </View>
                {isDone ? (
                  <Text style={styles.result}>{f.result}</Text>
                ) : (
                  <View style={[styles.play, !isNext && styles.playQuiet]}>
                    <Icon name="play.fill" size={11} color={isNext ? "white" : C.greenDark} fallback="▶" />
                    <Text style={[styles.playText, !isNext && { color: C.greenDark }]}>{t(f.p.state === "started" ? "continueGame" : "play")}</Text>
                  </View>
                )}
              </Tap>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { backgroundColor: "#14532D", borderRadius: 20, padding: 16, paddingBottom: 14 },
  headSub: { color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: "600" },
  headTitle: { fontFamily: F.display, fontSize: 28, color: "white", marginTop: 4 },
  segments: { flexDirection: "row", gap: 5, marginTop: 10 },
  segment: { flex: 1, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.22)" },
  list: { marginTop: 10, backgroundColor: C.card, borderRadius: 20, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 12 },
  rowNext: { backgroundColor: "#ECFDF3" },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  slot: { width: 40, alignItems: "center" },
  nextTag: { fontFamily: F.display, fontSize: 14, color: C.greenMid },
  num: { fontFamily: F.display, fontSize: 16, color: C.text3 },
  icon: { width: 38, height: 38, resizeMode: "contain" },
  title: { fontFamily: F.display, fontSize: 18, color: C.text },
  result: { fontFamily: F.display, fontSize: 18, color: C.greenDark, fontVariant: ["tabular-nums"] },
  play: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.green, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  playQuiet: { backgroundColor: C.greenSoft },
  playText: { fontFamily: F.display, fontSize: 15, color: "white" },
});
