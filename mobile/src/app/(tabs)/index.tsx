import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { QuestsCard } from "~/components/DailyCards";
import { HomeBoard, Wordmark } from "~/components/HomeBoard";
import { HomeFixtures } from "~/components/HomeFixtures";
import { HomeNext, PlayBar } from "~/components/HomeNext";
import { HomePitch } from "~/components/HomePitch";
import { HomeStatus } from "~/components/HomeStatus";
import { ReminderAsk } from "~/components/ReminderAsk";
import { ModeList, type Mode } from "~/components/ModeGrid";
import { QuickPlay } from "~/components/QuickPlay";
import { Text } from "~/components/Text";
import { TodayPuzzles } from "~/components/TodayPuzzles";
import { Icon, Page, SectionLabel, Tap } from "~/components/ui";
import { BRAND } from "~/lib/brand";
import { HOME_LAYOUT } from "~/lib/features";
import { useI18n } from "~/lib/i18n";
import { C, F, T } from "~/lib/theme";

const enter = (i: number) => FadeIn.duration(180).delay(i * 25);

/** Home: status strip, quick play, today's puzzles and quests, then the versus modes. */
export default function Home() {
  const { t, locale } = useI18n();
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

  if (HOME_LAYOUT === "board") {
    return (
      <Page topInset>
        <Wordmark />
        <HomeStatus />
        <ReminderAsk />
        <HomeBoard />
        <Animated.View entering={enter(2)} style={{ marginTop: 6 }}>
          <QuestsCard />
        </Animated.View>
      </Page>
    );
  }

  if (HOME_LAYOUT === "next") {
    return (
      <View style={{ flex: 1 }}>
        <Page topInset>
          <HomeStatus />
          <HomeNext />
        </Page>
        <PlayBar />
      </View>
    );
  }

  if (HOME_LAYOUT === "fixtures") {
    return (
      <Page topInset>
        <HomeStatus />
        <HomeFixtures />
        <Animated.View entering={enter(1)}>
          <QuickPlay />
        </Animated.View>
        <Animated.View entering={enter(2)}>
          <QuestsCard />
        </Animated.View>
      </Page>
    );
  }

  if (HOME_LAYOUT === "pitch") {
    return (
      <Page topInset>
        <HomeStatus />
        <HomePitch />
        <Animated.View entering={enter(2)}>
          <QuestsCard />
        </Animated.View>
      </Page>
    );
  }

  return (
    <Page topInset>
      {/* who you are and today's status: level, play streak, daily reward gift */}
      <HomeStatus />
      <Text style={[T.caption, { marginTop: 14 }]}>{date}</Text>

      {/* one tap into a game against someone; then today's puzzles and quests */}
      <Animated.View entering={enter(0)}>
        <QuickPlay />
      </Animated.View>

      <Animated.View entering={enter(1)}>
        <TodayPuzzles />
      </Animated.View>

      {/* today's quests (the reward gift sits in the status strip) */}
      <Animated.View entering={enter(2)}>
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

const styles = StyleSheet.create({
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
