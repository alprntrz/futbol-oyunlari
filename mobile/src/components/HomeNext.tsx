import { router, useFocusEffect, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Modal, ScrollView, StyleSheet, View, type ImageSourcePropType } from "react-native";
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { dailyMatch, dayNumber } from "@/lib/daily";

import { bingoForDay, CARD_SIZE } from "~/lib/bingo";
import { BRAND, ROZET } from "~/lib/brand";
import { useDuel } from "~/lib/duel";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { useQuests } from "~/lib/quests";
import { C, F, T } from "~/lib/theme";

import { QuestsCard } from "./DailyCards";
import { Text } from "./Text";
import { loadToday, type Progress, type Today } from "./TodayPuzzles";
import { Icon, Tap } from "./ui";

type Daily = { key: string; title: string; kind: string; image: ImageSourcePropType; href: Href; p: Progress; detail: string; result: string };

/**
 * Home, design "Sıradaki maç" (the outside designer's draft 1): today's four dailies
 * with a progress strip, the one to play next as a big card, the rest as rows; then
 * one compact "play an opponent" row (last game remembered) and the quests in one row.
 */
export function HomeNext() {
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
  const dailies: Daily[] = [
    {
      key: "grid",
      title: t("homeTodayGrid"),
      kind: t("homeKindPuzzle"),
      image: BRAND.icon.tiki,
      href: "/hat-trick/tek",
      p: today?.grid ?? NEW,
      detail: t("homeBoxesFilled").replace("{n}", String(today?.grid.count ?? 0)),
      result: `${today?.grid.count ?? 0}/9`,
    },
    {
      key: "xi",
      title: t("daily"),
      kind: t("homeKindLineup"),
      image: BRAND.icon.daily,
      href: "/eksik-11/gunluk",
      p: today?.xi ?? NEW,
      detail: t("homeXiFound").replace("{n}", String(today?.xi.count ?? 0)),
      result: `${today?.xi.count ?? 0}/11`,
    },
    {
      key: "bingo",
      title: t("bingoName"),
      kind: t("homeKindCard"),
      image: BRAND.icon.bingo,
      href: "/bingo",
      p: today?.bingo ?? NEW,
      detail: t("homeBingoFilled").replace("{n}", String(today?.bingo.count ?? 0)),
      result: `${today?.bingo.count ?? 0}/${CARD_SIZE}`,
    },
    {
      key: "duel",
      title: t("dzDaily"),
      kind: t("homeKindDuel"),
      image: ROZET.duel,
      href: duel.ready ? { pathname: "/duello/mac", params: { mode: "daily" } } : "/duello",
      p: duel.daily ? { state: "done", count: duel.daily.mine } : NEW,
      detail: "",
      result: duel.daily ? `${duel.daily.mine}–${duel.daily.theirs}` : "",
    },
  ];
  const done = dailies.filter((d) => d.p.state === "done").length;
  // the big card: something left half-way first, else the first not played
  const heroIndex = Math.max(
    dailies.findIndex((d) => d.p.state === "started"),
    -1
  );
  const hero = heroIndex >= 0 ? dailies[heroIndex] : dailies.find((d) => d.p.state === "new");
  const rest = dailies.filter((d) => d !== hero);
  const date = new Date().toLocaleDateString(locale === "tr" ? "tr-TR" : "en-GB", { day: "numeric", month: "long", weekday: "long" });
  const go = (href: Href) => {
    haptic.tap();
    router.push(href);
  };

  return (
    <View style={{ marginTop: 18 }}>
      {/* today at a glance */}
      <View style={styles.headRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>{date.toLocaleUpperCase(locale === "tr" ? "tr-TR" : "en-GB")}</Text>
          <Text style={styles.headTitle}>{t("homeYourMatches")}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.count}>
            {done}
            <Text style={styles.countOf}>/{dailies.length}</Text>
          </Text>
          <Text style={T.caption}>{t("homeCompleted")}</Text>
        </View>
      </View>
      <View style={styles.segments}>
        {dailies.map((d) => (
          <View key={d.key} style={[styles.segment, d.p.state === "done" && { backgroundColor: C.green }, d.p.state === "started" && { backgroundColor: "#FACC15" }]} />
        ))}
      </View>

      {/* the one to play now */}
      {hero ? (
        <Animated.View entering={FadeInDown.duration(240)}>
          <Tap onPress={() => go(hero.href)} style={styles.hero} accessibilityLabel={hero.title}>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={styles.eyebrow}>
                <Icon name={hero.p.state === "started" ? "clock.arrow.circlepath" : "flag.fill"} size={13} color="rgba(255,255,255,0.85)" fallback="•" />
                <Text style={styles.eyebrowText}>{`${t(hero.p.state === "started" ? "homeHalfway" : "homeNextUp")} · ${hero.kind}`.toLocaleUpperCase(locale === "tr" ? "tr-TR" : "en-GB")}</Text>
              </View>
              <Text style={styles.heroTitle} numberOfLines={1} adjustsFontSizeToFit>
                {hero.title}
              </Text>
              <Text style={styles.heroSub}>{hero.p.state === "started" ? hero.detail : t("homeNotPlayed")}</Text>
            </View>
            <Image source={hero.image} style={styles.heroArt} />
          </Tap>
          <Tap onPress={() => go(hero.href)} style={styles.heroBtnWrap} accessibilityLabel={t(hero.p.state === "started" ? "continueGame" : "homeStart")}>
            <View style={styles.heroBtn}>
              <Text style={styles.heroBtnText}>{t(hero.p.state === "started" ? "continueGame" : "homeStart")}</Text>
              <Icon name="arrow.right" size={16} color={C.greenDark} fallback="→" />
            </View>
          </Tap>
        </Animated.View>
      ) : (
        <View style={[styles.hero, { minHeight: 0 }]}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.heroTitle}>{t("homeAllDone")}</Text>
            <Text style={styles.heroSub}>{t("homeAllDoneSub")}</Text>
          </View>
          <Icon name="checkmark.seal.fill" size={44} color="#FACC15" fallback="✓" />
        </View>
      )}

      {/* the other dailies */}
      <View style={styles.list}>
        {rest.map((d, i) => {
          const isDone = d.p.state === "done";
          return (
            <Tap key={d.key} onPress={() => go(d.href)} style={[styles.row, i > 0 && styles.divider]} accessibilityLabel={d.title}>
              <View style={[styles.rowIcon, isDone && { opacity: 0.6 }]}>
                <Image source={d.image} style={{ width: 30, height: 30 }} resizeMode="contain" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.kind}>{d.kind.toLocaleUpperCase(locale === "tr" ? "tr-TR" : "en-GB")}</Text>
                <Text style={[styles.rowTitle, isDone && { color: C.text2 }]}>{d.title}</Text>
                <Text style={T.caption}>{isDone ? t("homeDoneToday") : d.p.state === "started" ? d.detail : t("homeNotPlayed")}</Text>
              </View>
              {isDone ? (
                <Text style={styles.result}>{d.result}</Text>
              ) : (
                <View style={styles.rowPlay}>
                  <Text style={styles.rowPlayText}>{t(d.p.state === "started" ? "continueGame" : "play")}</Text>
                  <Icon name="chevron.right" size={12} color={C.greenDark} fallback="›" />
                </View>
              )}
            </Tap>
          );
        })}
      </View>

      <QuestsRow />
      {/* room under the sticky "Find match" bar */}
      <View style={{ height: 84 }} />
    </View>
  );
}

/**
 * Sticky above the tab bar (the Griddy idea): one big Play. It opens a full-screen
 * page per game (app/oyna.tsx) with its own Find match button.
 */
export function PlayBar() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  // the play button breathes a little so the eye lands on it
  const breathe = useSharedValue(1);
  useEffect(() => {
    breathe.set(withRepeat(withSequence(withTiming(1.025, { duration: 900 }), withTiming(1, { duration: 900 })), -1));
  }, [breathe]);
  const breatheStyle = useAnimatedStyle(() => ({ transform: [{ scale: breathe.get() }] }));
  return (
    <Animated.View style={[styles.bar, { bottom: insets.bottom + 10 }, breatheStyle]}>
      <Tap onPress={() => (haptic.press(), router.push("/oyna"))} style={styles.findBig} accessibilityLabel={t("playOpponent")}>
        <Icon name="play.fill" size={20} color="#3B2A05" fallback="▶" />
        <Text style={styles.findBigText}>{t("playOpponent")}</Text>
      </Tap>
    </Animated.View>
  );
}

/** The day's quests in one row; tapping opens the full list. */
function QuestsRow() {
  const { t } = useI18n();
  const quests = useQuests();
  const [open, setOpen] = useState(false);
  const done = quests.filter((q) => q.progress >= q.target).length;
  return (
    <>
      <Tap onPress={() => (haptic.tap(), setOpen(true))} style={styles.quests} accessibilityLabel={t("questsTitle")}>
        <View style={styles.questsIcon}>
          <Icon name="target" size={16} color={C.greenDark} fallback="◎" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.questsTitle}>{t("questsTitle")}</Text>
          <Text style={T.caption}>{done === 0 ? t("homeQuestsNone") : done === quests.length ? t("homeQuestsAll") : t("homeQuestsSome").replace("{n}", String(done))}</Text>
        </View>
        <Text style={styles.questsCount}>
          {done}/{quests.length}
        </Text>
        <Icon name="chevron.right" size={13} color={C.text3} fallback="›" />
      </Tap>
      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
            <Tap onPress={() => setOpen(false)} style={styles.close} accessibilityLabel={t("close")}>
              <Icon name="xmark" size={16} color={C.text2} fallback="✕" />
            </Tap>
          </View>
          <Animated.View entering={FadeIn}>
            <QuestsCard />
          </Animated.View>
        </ScrollView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  kicker: { fontSize: 12, fontWeight: "800", letterSpacing: 1, color: C.text2 },
  headTitle: { fontFamily: F.display, fontSize: 32, lineHeight: 34, color: C.text, marginTop: 2 },
  count: { fontFamily: F.display, fontSize: 30, lineHeight: 30, color: C.text },
  countOf: { fontFamily: F.display, fontSize: 18, color: C.text3 },
  segments: { flexDirection: "row", gap: 6, marginTop: 10 },
  segment: { flex: 1, height: 5, borderRadius: 3, backgroundColor: "#DDE3DE" },
  hero: { marginTop: 14, backgroundColor: "#14532D", borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10, flexDirection: "row", alignItems: "center", gap: 10, minHeight: 112 },
  eyebrow: { flexDirection: "row", alignItems: "center", gap: 6 },
  eyebrowText: { fontSize: 12, fontWeight: "800", letterSpacing: 1, color: "rgba(255,255,255,0.85)" },
  heroTitle: { fontFamily: F.display, fontSize: 30, lineHeight: 32, color: "white" },
  heroSub: { fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.8)" },
  heroArt: { width: 84, height: 84, resizeMode: "contain", transform: [{ rotate: "-6deg" }] },
  heroBtnWrap: { backgroundColor: "#14532D", borderBottomLeftRadius: 22, borderBottomRightRadius: 22, paddingHorizontal: 16, paddingBottom: 16 },
  heroBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "white", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13 },
  heroBtnText: { fontFamily: F.display, fontSize: 19, color: C.greenDark },
  list: { marginTop: 10, backgroundColor: C.card, borderRadius: 20, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 11 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  rowIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: "#EEF2EF", alignItems: "center", justifyContent: "center" },
  rowTitle: { fontFamily: F.display, fontSize: 19, color: C.text },
  rowPlay: { flexDirection: "row", alignItems: "center", gap: 4 },
  rowPlayText: { fontFamily: F.display, fontSize: 16, color: C.greenDark },
  result: { fontFamily: F.display, fontSize: 18, color: C.greenDark, fontVariant: ["tabular-nums"] },
  section: { fontSize: 12, fontWeight: "800", letterSpacing: 1, color: C.text2, marginTop: 22, marginBottom: 8 },
  versus: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.card, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12 },
  versusName: { fontFamily: F.display, fontSize: 24, color: C.text, flexShrink: 1 },
  find: { backgroundColor: C.greenSoft, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
  findText: { fontFamily: F.display, fontSize: 17, color: C.greenDark },
  kind: { fontSize: 10, fontWeight: "800", letterSpacing: 0.8, color: C.greenMid },
  bar: { position: "absolute", left: 16, right: 16 },
  findBig: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, height: 58, borderRadius: 18, backgroundColor: "#FACC15", borderBottomWidth: 4, borderBottomColor: "#CA8A04", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  findBigText: { fontFamily: F.black, fontSize: 26, color: "#3B2A05" },
  quests: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12, paddingHorizontal: 6, paddingVertical: 8 },
  questsIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.greenSoft, alignItems: "center", justifyContent: "center" },
  questsTitle: { fontFamily: F.display, fontSize: 17, color: C.text },
  questsCount: { fontFamily: F.display, fontSize: 16, color: C.text2 },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#EEF2EF", alignItems: "center", justifyContent: "center" },
});
