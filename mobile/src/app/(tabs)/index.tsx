import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { dailyMatch } from "@/lib/daily";

import { Jersey } from "~/components/Jersey";
import { Icon, Page, SectionLabel, Tap } from "~/components/ui";
import { BRAND } from "~/lib/brand";
import { useI18n } from "~/lib/i18n";
import { jerseyStyle } from "~/lib/kits";
import { loadDayState, loadStats } from "~/lib/storage";
import { C, F, R, shadow, T } from "~/lib/theme";

type DailyStatus = { kind: "new" } | { kind: "playing"; solved: number } | { kind: "done"; solved: number };

const enter = (i: number) => FadeInDown.delay(60 + i * 70).springify().damping(15);

export default function Home() {
  const { t, locale } = useI18n();
  const { match, day } = useMemo(() => dailyMatch(), []);
  const [status, setStatus] = useState<DailyStatus>({ kind: "new" });
  const [streak, setStreak] = useState(0);

  // Refresh the daily card and streak whenever the tab comes back into view
  useFocusEffect(
    useCallback(() => {
      loadDayState(day).then((s) => {
        if (!s || s.matchId !== match.id) return setStatus({ kind: "new" });
        const solved = s.slots.filter((x) => x.solved).length;
        const done = s.gaveUp || s.slots.every((x) => x.solved || x.failed);
        setStatus(done ? { kind: "done", solved } : { kind: "playing", solved });
      });
      loadStats().then((s) => setStreak(s.streak));
    }, [day, match.id])
  );

  const today = new Date().toLocaleDateString(locale === "tr" ? "tr-TR" : "en-GB", { day: "numeric", month: "long", weekday: "long" });
  const cta = status.kind === "new" ? t("play") : status.kind === "playing" ? t("continueGame") : t("seeResult");
  const statusText =
    status.kind === "new" ? t("notStarted") : `${status.kind === "playing" ? t("inProgress") : t("completed")} ${status.solved}/11`;

  return (
    <Page topInset>
      <View style={styles.topRow}>
        <Text style={T.caption}>{today}</Text>
        {streak > 0 && (
          <Tap onPress={() => router.push("/istatistik")} style={styles.streak}>
            <Icon name="flame.fill" size={16} color={C.amber} fallback="🔥" />
            <Text style={styles.streakText}>{streak}</Text>
          </Tap>
        )}
      </View>
      <Text style={[T.largeTitle, { marginTop: 4 }]}>{t("appName")}</Text>
      <Text style={[T.body, { marginTop: 2 }]}>{t("homeSubtitle")}</Text>

      {/* Daily XI: a slice of pitch with today's fixture on it */}
      <Animated.View entering={enter(0)}>
        <Tap onPress={() => router.push("/eksik-11/gunluk")} style={styles.hero}>
          <View style={StyleSheet.absoluteFill}>
            {Array.from({ length: 6 }, (_, i) => (
              <View key={i} style={{ flex: 1, backgroundColor: i % 2 ? "#18A34B" : "#139A44" }} />
            ))}
          </View>
          <View pointerEvents="none" style={styles.chalkCircle} />
          <View pointerEvents="none" style={styles.chalkLine} />

          <View style={styles.heroHead}>
            <Text style={styles.heroKicker}>#{day % 1000}</Text>
            <Text style={styles.heroStatus}>{statusText}</Text>
          </View>
          <Text style={styles.heroTitle}>{t("daily")}</Text>

          <View style={styles.fixture}>
            <Jersey body={match.kit.body} sleeves={match.kit.sleeves} numberColor={match.kit.number} number={11} variant={jerseyStyle(match)} size={58} hideNumber />
            <View style={{ flex: 1 }}>
              <Text style={styles.fixtureTeams} numberOfLines={2}>
                {match.team} <Text style={{ color: "rgba(255,255,255,0.65)" }}>{match.score}</Text> {match.opponent}
              </Text>
              <Text style={styles.fixtureMeta} numberOfLines={1}>
                {match.competition[locale]}, {match.season}
              </Text>
            </View>
          </View>

          <View style={styles.cta}>
            <Icon name="play.fill" size={16} color={C.greenDark} fallback="▶" />
            <Text style={styles.ctaText}>{cta}</Text>
          </View>
        </Tap>
      </Animated.View>

      <SectionLabel>{t("homeGamesTitle")}</SectionLabel>

      <View style={styles.pair}>
        <Animated.View entering={enter(1)} style={{ flex: 1 }}>
          <GameTile image={BRAND.icon.practice} title={t("practice")} desc={t("practiceShort")} bg="#E2F3E7" onPress={() => router.push("/eksik-11/pratik")} />
        </Animated.View>
        <Animated.View entering={enter(2)} style={{ flex: 1 }}>
          <GameTile image={BRAND.icon.team} title={t("byTeam")} desc={t("teamShort")} bg="#FCE9E7" onPress={() => router.push("/eksik-11/takimlar")} />
        </Animated.View>
      </View>

      <Animated.View entering={enter(3)}>
        <WideTile
          image={BRAND.icon.race}
          title={t("onlineRace")}
          desc={t("raceShort")}
          bg={C.greenDark}
          dark
          onPress={() => router.push("/eksik-11/oda")}
        />
      </Animated.View>
      <Animated.View entering={enter(4)}>
        <WideTile image={BRAND.icon.tiki} title={t("tikiTakaName")} desc={t("tikiShort")} bg="#E4ECFD" onPress={() => router.push("/hat-trick")} />
      </Animated.View>
    </Page>
  );
}

function GameTile({ image, title, desc, bg, onPress }: { image: ImageSourcePropType; title: string; desc: string; bg: string; onPress: () => void }) {
  return (
    <Tap onPress={onPress} style={[styles.tile, { backgroundColor: bg }]}>
      <Image source={image} style={styles.tileImage} />
      <Text style={styles.tileTitle}>{title}</Text>
      <Text style={styles.tileDesc} numberOfLines={2}>
        {desc}
      </Text>
    </Tap>
  );
}

function WideTile({
  image,
  title,
  desc,
  bg,
  dark,
  onPress,
}: {
  image: ImageSourcePropType;
  title: string;
  desc: string;
  bg: string;
  dark?: boolean;
  onPress: () => void;
}) {
  return (
    <Tap onPress={onPress} style={[styles.wide, { backgroundColor: bg }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.tileTitle, dark && { color: "white" }]}>{title}</Text>
        <Text style={[styles.tileDesc, dark && { color: "rgba(255,255,255,0.75)" }]} numberOfLines={2}>
          {desc}
        </Text>
      </View>
      <Image source={image} style={styles.wideImage} />
    </Tap>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 30 },
  streak: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FFF4DC", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  streakText: { fontFamily: F.black, fontSize: 18, color: "#9A6A08" },

  hero: { marginTop: 18, borderRadius: 26, overflow: "hidden", padding: 20, ...shadow, shadowOpacity: 0.18 },
  chalkCircle: {
    position: "absolute",
    right: -60,
    top: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.22)",
  },
  chalkLine: { position: "absolute", right: 40, top: 0, bottom: 0, width: 2, backgroundColor: "rgba(255,255,255,0.16)" },
  heroHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroKicker: { fontFamily: F.display, fontSize: 18, color: "rgba(255,255,255,0.8)" },
  heroStatus: { fontSize: 13, fontWeight: "700", color: "white", backgroundColor: "rgba(0,0,0,0.18)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, overflow: "hidden" },
  heroTitle: { fontFamily: F.black, fontSize: 46, lineHeight: 48, color: "white", marginTop: 2 },
  fixture: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14, backgroundColor: "rgba(0,0,0,0.16)", borderRadius: 16, padding: 10 },
  fixtureTeams: { fontFamily: F.display, fontSize: 21, lineHeight: 23, color: "white" },
  fixtureMeta: { fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.75)", marginTop: 2 },
  cta: { marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "white", borderRadius: R.button, paddingVertical: 14 },
  ctaText: { fontFamily: F.display, fontSize: 22, color: C.greenDark },

  pair: { flexDirection: "row", gap: 12 },
  tile: { borderRadius: R.card, padding: 16, paddingTop: 12, minHeight: 168 },
  tileImage: { width: 72, height: 72, marginLeft: -6, marginBottom: 6 },
  tileTitle: { fontFamily: F.display, fontSize: 24, lineHeight: 26, color: C.text },
  tileDesc: { fontSize: 13, fontWeight: "500", color: C.text2, marginTop: 2 },
  wide: { marginTop: 12, borderRadius: R.card, padding: 18, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 104 },
  wideImage: { width: 84, height: 84, marginVertical: -10 },
});
