import type { SymbolViewProps } from "expo-symbols";
import { router, useFocusEffect, type Href } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Image, StyleSheet, View, type ImageSourcePropType } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { dailyMatch } from "@/lib/daily";

import { Jersey } from "~/components/Jersey";
import { Text } from "~/components/Text";
import { Icon, Page, Tap } from "~/components/ui";
import { BRAND } from "~/lib/brand";
import { useI18n } from "~/lib/i18n";
import { jerseyStyle } from "~/lib/kits";
import { loadDayState } from "~/lib/storage";
import { C, F, R, shadow, T } from "~/lib/theme";

type DailyStatus = { kind: "new" } | { kind: "playing"; solved: number } | { kind: "done"; solved: number };

/** one quiet tile behind every game's art, so the art carries the colour */
const ART_BG = "#EEF2EF";

type Game = { title: string; desc: string; href: Href; bg: string } & (
  { image: ImageSourcePropType } | { icon: SymbolViewProps["name"]; fallback: string; color: string }
);

const enter = (i: number) => FadeIn.duration(180).delay(i * 25);

/** Games tab: today's Missing XI on top, every other game one tap below. */
export default function Games() {
  const { t, locale } = useI18n();
  const { match, day } = useMemo(() => dailyMatch(), []);
  const [status, setStatus] = useState<DailyStatus>({ kind: "new" });

  // Refresh the daily card whenever the tab comes back into view
  useFocusEffect(
    useCallback(() => {
      loadDayState(day).then((s) => {
        if (!s || s.matchId !== match.id) return setStatus({ kind: "new" });
        const solved = s.slots.filter((x) => x.solved).length;
        const done = s.gaveUp || s.slots.every((x) => x.solved || x.failed);
        setStatus(done ? { kind: "done", solved } : { kind: "playing", solved });
      });
    }, [day, match.id])
  );

  const cta = status.kind === "new" ? t("play") : status.kind === "playing" ? t("continueGame") : t("seeResult");
  const statusText = status.kind === "new" ? t("notStarted") : `${status.kind === "playing" ? t("inProgress") : t("completed")} ${status.solved}/11`;

  const games: Game[] = [
    {
      image: BRAND.icon.tiki,
      title: t("tikiTakaName"),
      desc: t("htShort"),
      href: "/hat-trick",
      bg: ART_BG,
    },
    {
      image: BRAND.icon.quiz,
      title: t("qzName"),
      desc: t("qzShort"),
      href: "/bilgi",
      bg: ART_BG,
    },
    // Kombine (match-3, /kombine) is shelved for a later version: code and routes stay, no entry here
    {
      image: BRAND.icon.mystery,
      title: t("myName"),
      desc: t("myShort"),
      href: "/gizli",
      bg: ART_BG,
    },
    {
      image: BRAND.icon.practice,
      title: t("missingXI"),
      desc: t("xiShort"),
      href: "/eksik-11",
      bg: ART_BG,
    },
    {
      image: BRAND.icon.bingo,
      title: t("bingoName"),
      desc: t("bingoShort"),
      href: "/bingo",
      bg: ART_BG,
    },
    {
      image: BRAND.icon.possession,
      title: t("ppName"),
      desc: t("ppShort"),
      href: "/possession",
      bg: ART_BG,
    },
  ];

  return (
    <Page topInset>
      <Text style={[T.largeTitle, { marginTop: 4 }]}>{t("tabGames")}</Text>

      {/* Daily XI: a slice of pitch with today's fixture on it */}
      <Animated.View entering={enter(0)}>
        <Tap
          onPress={() => router.push("/eksik-11/gunluk")}
          style={styles.hero}
          accessibilityLabel={`${t("daily")}. ${match.team} ${match.score} ${match.opponent}. ${statusText}`}
          accessibilityHint={cta}
        >
          <View style={StyleSheet.absoluteFill}>
            {Array.from({ length: 6 }, (_, i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  backgroundColor: i % 2 ? "#13803B" : "#0F7A37",
                }}
              />
            ))}
          </View>
          <View pointerEvents="none" style={styles.chalkCircle} />
          <View pointerEvents="none" style={styles.chalkLine} />

          <View style={styles.heroHead}>
            <Text style={styles.heroTitle}>{t("daily")}</Text>
            <Text style={styles.heroStatus}>{statusText}</Text>
          </View>

          <View style={styles.fixture}>
            <Jersey
              body={match.kit.body}
              sleeves={match.kit.sleeves}
              numberColor={match.kit.number}
              number={11}
              variant={jerseyStyle(match)}
              size={46}
              hideNumber
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.fixtureTeams} numberOfLines={2}>
                {match.team} <Text style={{ color: "#BFE6CB" }}>{match.score}</Text> {match.opponent}
              </Text>
              <Text style={styles.fixtureMeta} numberOfLines={2}>
                {match.competition[locale]}, {match.season}
              </Text>
            </View>
            <View style={styles.go}>
              <Icon name="chevron.right" size={14} color={C.greenDark} fallback="›" />
            </View>
          </View>

        </Tap>
      </Animated.View>

      <View style={styles.list}>
        {games.map((g, i) => (
          <Animated.View key={g.title} entering={enter(i + 1)}>
            <Tap onPress={() => router.push(g.href)} style={[styles.row, i > 0 && styles.rowDivider]} accessibilityLabel={`${g.title}. ${g.desc}`}>
              <View style={[styles.rowIcon, { backgroundColor: g.bg }]}>
                {"image" in g ? (
                  <Image source={g.image} style={styles.rowImage} accessible={false} />
                ) : (
                  <Icon name={g.icon} size={26} color={g.color} fallback={g.fallback} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {g.title}
                </Text>
                <Text style={styles.rowDesc} numberOfLines={1}>
                  {g.desc}
                </Text>
              </View>
              <Icon name="chevron.right" size={14} color={C.text3} fallback="›" />
            </Tap>
          </Animated.View>
        ))}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginTop: 8,
    borderRadius: 24,
    overflow: "hidden",
    padding: 16,
    ...shadow,
    shadowOpacity: 0.18,
  },
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
  chalkLine: {
    position: "absolute",
    right: 40,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  heroHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroStatus: {
    fontSize: 13,
    fontWeight: "700",
    color: "white",
    backgroundColor: "#0C622C",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    overflow: "hidden",
  },
  heroTitle: {
    fontFamily: F.black,
    fontSize: 30,
    lineHeight: 32,
    color: "white",
  },
  fixture: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 10,
    backgroundColor: "#0C622C",
    borderRadius: 16,
    padding: 10,
  },
  fixtureTeams: {
    fontFamily: F.display,
    fontSize: 21,
    lineHeight: 23,
    color: "white",
  },
  fixtureMeta: {
    fontSize: 14,
    fontWeight: "600",
    color: "#E3F2E8",
    marginTop: 2,
  },
  go: { width: 30, height: 30, borderRadius: 15, backgroundColor: "white", alignItems: "center", justifyContent: "center" },

  list: {
    marginTop: 16,
    backgroundColor: C.card,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minHeight: 54,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  rowImage: { width: 44, height: 44 },
  rowTitle: {
    fontFamily: F.display,
    fontSize: 21,
    lineHeight: 23,
    color: C.text,
  },
  rowDesc: { fontSize: 14, lineHeight: 18, color: C.text2, marginTop: 1 },
});
