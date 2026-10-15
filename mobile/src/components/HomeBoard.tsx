import { router, useFocusEffect, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, View, type ImageSourcePropType } from "react-native";
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";

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

type Tile = { key: string; title: string; image: ImageSourcePropType; href: Href; p: Progress; newLine: string; progress: string; result: string };

/** "tiktako." wordmark with the ball mark, top of Home (as in the designer's draft). */
export function Wordmark() {
  return (
    <View style={styles.brand} accessibilityRole="header" accessibilityLabel="Tiktako">
      <Image source={BRAND.logo} style={styles.brandBall} />
      <Text style={styles.brandText}>
        tiktako<Text style={{ color: C.green }}>.</Text>
      </Text>
    </View>
  );
}

/**
 * Home, the outside designer's draft 3 "Bugünkü dörtlü": today's four dailies as
 * a 2×2 board of picture tiles (the one under way dark, finished ones faded),
 * then one big lime "Play someone" card.
 */
export function HomeBoard() {
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

  const NEW: Progress = { state: "new", count: 0 };
  const tiles: Tile[] = [
    { key: "grid", title: t("homeTodayGrid"), image: BRAND.icon.tiki, href: "/hat-trick/tek", p: today?.grid ?? NEW, newLine: t("boardGridNew"), progress: `${today?.grid.count ?? 0}/9`, result: `${today?.grid.count ?? 0}/9` },
    { key: "xi", title: t("daily"), image: BRAND.icon.daily, href: "/eksik-11/gunluk", p: today?.xi ?? NEW, newLine: t("boardXiNew"), progress: `${today?.xi.count ?? 0}/11`, result: `${today?.xi.count ?? 0}/11` },
    { key: "bingo", title: t("bingoName"), image: BRAND.icon.bingo, href: "/bingo", p: today?.bingo ?? NEW, newLine: t("boardBingoNew"), progress: `${today?.bingo.count ?? 0}/${CARD_SIZE}`, result: `${today?.bingo.count ?? 0}/${CARD_SIZE}` },
    {
      key: "duel",
      title: t("dzDaily"),
      image: ROZET.duel,
      href: duel.ready ? { pathname: "/duello/mac", params: { mode: "daily" } } : "/duello",
      p: duel.daily ? { state: "done", count: duel.daily.mine } : NEW,
      newLine: t("boardDuelNew"),
      progress: "",
      result: duel.daily ? `${duel.daily.mine}–${duel.daily.theirs}` : "",
    },
  ];
  const done = tiles.filter((x) => x.p.state === "done").length;
  // the eye lands on Play someone: a green outline and a soft pulse
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.set(withRepeat(withSequence(withTiming(1.03, { duration: 800 }), withTiming(1, { duration: 800 })), -1));
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.get() }] }));
  const upper = (s: string) => s.toLocaleUpperCase(locale === "tr" ? "tr-TR" : "en-GB");

  return (
    <View style={{ marginTop: 18 }}>
      <View style={styles.head}>
        <Text style={styles.title}>{t("boardTitle")}</Text>
        <Text style={styles.count}>
          <Text style={styles.countNum}>{done}/4</Text> {t("boardDone")}
        </Text>
      </View>

      <View style={styles.grid}>
        {tiles.map((x, i) => {
          const going = x.p.state === "started";
          const isDone = x.p.state === "done";
          const ink = isDone ? "white" : C.text;
          return (
            <Animated.View key={x.key} entering={FadeInDown.delay(i * 50).duration(220)} style={styles.cell}>
              <Tap onPress={() => (haptic.tap(), router.push(x.href))} style={[styles.tile, going && styles.tileGoing, isDone && styles.tileDone]} accessibilityLabel={x.title}>
                <View style={styles.tileTop}>
                  <Text style={[styles.tag, going && { color: "#713F12" }, isDone && { color: "#BBF7D0" }]}>
                    {upper(going ? t("boardGoing") : isDone ? t("boardFinished") : t("boardNew"))}
                  </Text>
                  <Icon name={isDone ? "checkmark.circle.fill" : "arrow.up.right"} size={15} color={isDone ? "#BBF7D0" : going ? "#713F12" : C.text3} fallback="↗" />
                </View>
                <View style={styles.art}>
                  <Image source={x.image} style={styles.artImage} />
                </View>
                <Text style={[styles.tileTitle, { color: ink }]} numberOfLines={1} adjustsFontSizeToFit>
                  {x.title}
                </Text>
                <View style={styles.tileFoot}>
                  <Text style={[styles.tileSub, going && { color: "#713F12" }, isDone && { color: "rgba(255,255,255,0.85)" }]} numberOfLines={1}>
                    {going ? `${t("continueGame")} · ${x.progress}` : isDone ? `${x.result} · ${t("boardSeeResult")}` : x.newLine}
                  </Text>
                  {going && <Icon name="play.circle.fill" size={20} color="#713F12" fallback="▶" />}
                </View>
              </Tap>
            </Animated.View>
          );
        })}
      </View>

      <Text style={styles.section}>{t("boardVersus")}</Text>
      <Animated.View style={pulseStyle}>
      <Tap onPress={() => (haptic.press(), router.push("/oyna"))} style={[styles.versus, styles.versusNext]} accessibilityLabel={t("playOpponent")}>
        <View style={{ flex: 1, alignItems: "flex-start" }}>
          <Text style={styles.versusTitle}>{t("playOpponent")}</Text>
          <Text style={styles.versusSub}>{t("boardVersusSub")}</Text>
        </View>
        <View style={styles.versusGo}>
          <Icon name="arrow.right" size={20} color="#D9F99D" fallback="→" />
        </View>
      </Tap>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  brandBall: { width: 34, height: 34 },
  brandText: { fontFamily: F.black, fontSize: 34, lineHeight: 38, color: C.text, letterSpacing: -0.5 },
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  title: { fontFamily: F.display, fontSize: 30, color: C.text },
  count: { fontSize: 14, color: C.text2 },
  countNum: { fontFamily: F.display, fontSize: 18, color: C.text },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  cell: { width: "48.5%" },
  tile: { backgroundColor: "#FBFAF5", borderRadius: 22, padding: 12, borderWidth: 1, borderColor: "#ECE8DC", minHeight: 196 },
  versusNext: { borderWidth: 2, borderColor: "#65A30D", shadowColor: "#65A30D", shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
  tileGoing: { backgroundColor: "#FACC15", borderColor: "#EAB308" },
  tileDone: { backgroundColor: "#14532D", borderColor: "#14532D" },
  tileTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tag: { fontSize: 11, fontWeight: "800", letterSpacing: 0.8, color: C.greenDark },
  art: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 8 },
  artImage: { width: 76, height: 76, resizeMode: "contain" },
  tileTitle: { fontFamily: F.display, fontSize: 21 },
  tileFoot: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  tileSub: { ...T.caption, flex: 1 },
  section: { fontFamily: F.display, fontSize: 22, color: C.text, marginTop: 22, marginBottom: 8 },
  versus: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#D9F99D", borderRadius: 22, paddingHorizontal: 18, paddingVertical: 20 },
  versusTitle: { fontFamily: F.black, fontSize: 30, lineHeight: 32, color: "#1A2E05" },
  versusSub: { fontSize: 14, color: "#3F6212", marginTop: 2 },
  versusGo: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#1A2E05", alignItems: "center", justifyContent: "center" },
});
