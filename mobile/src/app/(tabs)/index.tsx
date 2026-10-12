import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { dayNumber } from "@/lib/daily";
import { generateGrid, seededRandom } from "@/lib/tiki";

import { DailyRewardCard, QuestsCard } from "~/components/DailyCards";
import { CriterionBadge } from "~/components/HatTrickBoard";
import { ModeList, type Mode } from "~/components/ModeGrid";
import { QuickPlay } from "~/components/QuickPlay";
import { Text } from "~/components/Text";
import { Icon, Page, SectionLabel, Tap } from "~/components/ui";
import { BRAND } from "~/lib/brand";
import { useI18n } from "~/lib/i18n";
import { loadStats } from "~/lib/storage";
import { C, F, R, shadow, T } from "~/lib/theme";

/** Filled squares of today's solo run, or null when it hasn't been started. */
type Today = { filled: boolean[]; finished: boolean } | null;

const enter = (i: number) => FadeIn.duration(180).delay(i * 25);

/** Home: Hat-trick first. Today's solo grid up top, the versus modes right under it. */
export default function Home() {
  const { t, locale } = useI18n();
  const day = useMemo(() => dayNumber(), []);
  // same seed as the solo screen, so the preview is the grid you'll play
  const grid = useMemo(() => generateGrid(seededRandom(day * 7919 + 17)), [day]);
  const [today, setToday] = useState<Today>(null);
  const [streak, setStreak] = useState(0);

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(`hattrick-box-${day}`)
        .then((raw) => {
          if (!raw) return setToday(null);
          const run = JSON.parse(raw) as {
            cells: string[][];
            finished: boolean;
          };
          // an opened-but-empty run still reads as "not played"
          const filled = run.cells.map((c) => c.length > 0);
          setToday(run.finished || filled.some(Boolean) ? { filled, finished: run.finished } : null);
        })
        .catch(() => setToday(null));
      loadStats().then((s) => setStreak(s.streak));
    }, [day])
  );

  const filledCount = today?.filled.filter(Boolean).length ?? 0;
  const status = !today ? t("homeNotPlayed") : today.finished ? `${t("homeDone")}: ${filledCount}/9` : `${filledCount}/9 ${t("homeFilledOf")}`;
  const cta = !today ? t("play") : today.finished ? t("seeResult") : t("continueGame");
  const date = new Date().toLocaleDateString(locale === "tr" ? "tr-TR" : "en-GB", { day: "numeric", month: "long", weekday: "long" });

  const versus: Mode[] = [
    {
      icon: "person.2.fill",
      fallback: "👥",
      title: t("htFriend"),
      desc: t("htFriendDesc"),
      href: "/hat-trick/oda",
      image: BRAND.mode.friend,
      color: C.greenMid,
      soft: C.greenSoft,
    },
    {
      icon: "antenna.radiowaves.left.and.right",
      fallback: "📡",
      title: t("htRandom"),
      desc: t("htRandomDesc"),
      href: "/hat-trick/rastgele",
      image: BRAND.mode.random,
      color: C.blue,
      soft: C.blueSoft,
    },
    {
      icon: "iphone",
      fallback: "📱",
      title: t("htSame"),
      desc: t("htSameDesc"),
      href: "/hat-trick/yerel",
      image: BRAND.mode.same,
      color: C.coral,
      soft: C.coralSoft,
    },
  ];

  return (
    <Page topInset>
      <View style={styles.topRow}>
        <Text style={T.caption}>{date}</Text>
        {streak > 0 && (
          <Tap onPress={() => router.push("/istatistik")} style={styles.streak} accessibilityLabel={`${t("streak")}: ${streak}`}>
            <Icon name="flame.fill" size={16} color={C.amber} fallback="🔥" />
            <Text style={styles.streakText}>{streak}</Text>
          </Tap>
        )}
      </View>
      <Text style={[T.largeTitle, { marginTop: 4 }]}>{t("appName")}</Text>

      {/* one tap into a game against someone; then today's grid, rewards and quests */}
      <Animated.View entering={enter(0)}>
        <QuickPlay />
      </Animated.View>

      <Animated.View entering={enter(1)}>
        <Tap
          onPress={() => router.push("/hat-trick/tek")}
          style={styles.hero}
          accessibilityLabel={`${t("homeTodayGrid")}. ${status}`}
          accessibilityHint={cta}
        >
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>{t("homeTodayGrid")}</Text>
            <Text style={styles.heroStatus}>{status}</Text>
            <View style={styles.cta}>
              <Icon name="play.fill" size={13} color={HERO} fallback="▶" />
              <Text style={styles.ctaText}>{cta}</Text>
            </View>
          </View>

          {/* The real grid for today: column headers, row headers, 3×3 squares */}
          <View style={styles.board}>
            <View style={styles.boardRow}>
              <View style={styles.head} />
              {grid.cols.map((c) => (
                <View key={c.id} style={styles.head}>
                  <CriterionBadge c={c} size={26} />
                </View>
              ))}
            </View>
            {grid.rows.map((r, ri) => (
              <View key={r.id} style={styles.boardRow}>
                <View style={styles.head}>
                  <CriterionBadge c={r} size={26} />
                </View>
                {grid.cols.map((c, ci) => (
                  <View key={c.id} style={[styles.square, today?.filled[ri * 3 + ci] && styles.squareFilled]}>
                    {today?.filled[ri * 3 + ci] && <Icon name="checkmark" size={14} color="white" fallback="✓" />}
                  </View>
                ))}
              </View>
            ))}
          </View>
        </Tap>
      </Animated.View>

      {/* come back tomorrow: the reward calendar and today's quests */}
      <Animated.View entering={enter(2)}>
        <DailyRewardCard />
        <QuestsCard />
      </Animated.View>

      <SectionLabel>{t("homeVersus")}</SectionLabel>
      <Animated.View entering={enter(3)}>
        <ModeList modes={versus} />
      </Animated.View>

      <Tap onPress={() => router.push("/oyunlar")} style={styles.allGames} accessibilityLabel={t("homeAllGames")}>
        <Text style={styles.allGamesText}>{t("homeAllGames")}</Text>
        <Icon name="arrow.right" size={14} color={C.greenMid} fallback="→" />
      </Tap>
    </Page>
  );
}

const SQUARE = 34;
const HERO = "#1F3B8C";

const styles = StyleSheet.create({
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 30,
  },
  streak: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFF4DC",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  streakText: { fontFamily: F.black, fontSize: 18, color: "#7A5205" },

  hero: { marginTop: 16, borderRadius: 24, padding: 16, backgroundColor: HERO, flexDirection: "row", gap: 12, ...shadow, shadowOpacity: 0.18 },
  heroText: { flex: 1, justifyContent: "space-between" },
  heroTitle: { fontFamily: F.black, fontSize: 28, lineHeight: 29, color: "white" },
  heroStatus: { fontSize: 13, fontWeight: "600", color: "#DCE5FD", marginTop: 6 },

  board: { gap: 4, alignSelf: "center" },
  boardRow: { flexDirection: "row", gap: 4 },
  head: { width: SQUARE, height: SQUARE, alignItems: "center", justifyContent: "center" },
  square: { width: SQUARE, height: SQUARE, borderRadius: 9, backgroundColor: "#2A4AA6", alignItems: "center", justifyContent: "center" },
  squareFilled: { backgroundColor: C.greenMid },

  cta: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "white",
    borderRadius: R.button,
    paddingVertical: 10,
  },
  ctaText: { fontFamily: F.display, fontSize: 19, color: HERO },

  allGames: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 14,
    paddingVertical: 10,
  },
  allGamesText: { fontFamily: F.display, fontSize: 19, color: C.greenMid },
});
