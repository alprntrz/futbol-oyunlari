import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";

import { ALL_CRITERIA } from "@/lib/tiki";

import { ClubShirt } from "~/components/HatTrickBoard";
import { TileFace } from "~/components/kombine/Board";
import { Text } from "~/components/Text";
import { Card, Icon, Page, SectionLabel, Tap } from "~/components/ui";
import { useI18n } from "~/lib/i18n";
import { SEASON } from "~/lib/kombine/levels";
import { loadStars, unlocked } from "~/lib/kombine/progress";
import { C, F, T } from "~/lib/theme";

/** Kombine season: one matchday per level, winding down the page like a fixture list. */
export default function KombineSeason() {
  const { t, locale } = useI18n();
  const [stars, setStars] = useState<number[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadStars().then(setStars);
    }, [])
  );

  const open = unlocked(stars);
  const total = stars.reduce((n, s) => n + (s ?? 0), 0);

  return (
    <Page>
      <Stack.Screen options={{ title: t("kbName") }} />
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={T.title}>{t("kbName")}</Text>
          <Text style={[T.body, { marginTop: 4 }]}>{t("kbIntro")}</Text>
        </View>
        <View style={styles.total}>
          <Icon name="star.fill" size={16} color="#E0A100" fallback="★" />
          <Text style={styles.totalText}>
            {total}/{SEASON.length * 3}
          </Text>
        </View>
      </View>

      <Card style={styles.specials}>
        {(
          [
            [{ id: 0, color: 0, special: "row" }, t("kbTipRow")],
            [{ id: 0, color: 2, special: "bomb" }, t("kbTipBomb")],
            [{ id: 0, color: -1, special: "color" }, t("kbTipColor")],
            [{ id: 0, color: -1, ball: true }, t("kbTipBall")],
          ] as const
        ).map(([tile, text], i) => (
          <View key={i} style={styles.tip}>
            <TileFace tile={tile} size={30} />
            <Text style={[T.body, { flex: 1, fontSize: 14, lineHeight: 19 }]}>{text}</Text>
          </View>
        ))}
      </Card>

      <SectionLabel>{t("kbSeasonTitle")}</SectionLabel>
      <View style={{ gap: 8 }}>
        {SEASON.map((lv, i) => {
          const rival = ALL_CRITERIA.find((c) => c.kind === "club" && c.id === lv.rival);
          const locked = i > open;
          const current = i === open;
          const s = stars[i] ?? 0;
          return (
            <Tap
              key={i}
              disabled={locked}
              onPress={() => router.push({ pathname: "/kombine/[level]", params: { level: String(i) } })}
              style={[styles.day, current && styles.dayCurrent, locked && { opacity: 0.45 }]}
              accessibilityLabel={`${t("kbWeek")} ${i + 1}, ${rival ? (locale === "tr" ? rival.tr : rival.en) : ""}${s ? `, ${s} ★` : ""}`}
            >
              <Text style={[styles.week, current && { color: "white" }]}>{i + 1}</Text>
              {rival && <ClubShirt c={rival} size={26} />}
              <View style={{ flex: 1 }}>
                <Text style={[T.headline, current && { color: "white" }]} numberOfLines={1}>
                  {rival ? (locale === "tr" ? rival.tr : rival.en) : ""}
                </Text>
                <Text style={[T.caption, current && { color: "#DDEFE3" }]}>
                  {t("kbWeek")} {i + 1}
                </Text>
              </View>
              {locked ? (
                <Icon name="lock.fill" size={16} color={C.text3} fallback="🔒" />
              ) : current ? (
                <View style={styles.play}>
                  <Icon name="play.fill" size={14} color={C.greenDark} fallback="▶" />
                </View>
              ) : (
                <View style={{ flexDirection: "row", gap: 1 }}>
                  {[0, 1, 2].map((k) => (
                    <Icon key={k} name="star.fill" size={15} color={k < s ? "#E0A100" : C.border} fallback="★" />
                  ))}
                </View>
              )}
            </Tap>
          );
        })}
      </View>
      {open >= SEASON.length && <Text style={[T.headline, { textAlign: "center", marginTop: 16 }]}>{t("kbSeasonDone")}</Text>}
    </Page>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  total: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FFF4DC", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginTop: 4 },
  totalText: { fontFamily: F.display, fontSize: 17, color: "#7A5205" },
  specials: { marginTop: 16, gap: 10 },
  tip: { flexDirection: "row", alignItems: "center", gap: 12 },
  day: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 10 },
  dayCurrent: { backgroundColor: C.greenMid, borderColor: C.greenMid },
  week: { fontFamily: F.black, fontSize: 22, width: 26, textAlign: "center", color: C.text2 },
  play: { width: 30, height: 30, borderRadius: 15, backgroundColor: "white", alignItems: "center", justifyContent: "center" },
});
