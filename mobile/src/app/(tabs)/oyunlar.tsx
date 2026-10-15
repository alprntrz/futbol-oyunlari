import type { SymbolViewProps } from "expo-symbols";
import { router, type Href } from "expo-router";
import { Image, StyleSheet, View, type ImageSourcePropType } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";


import { Text } from "~/components/Text";
import { Icon, Page, Tap } from "~/components/ui";
import { BRAND, ROZET, TAKTIK } from "~/lib/brand";
import { useI18n } from "~/lib/i18n";
import { C, F, R, T } from "~/lib/theme";

/** one quiet tile behind every game's art, so the art carries the colour */
const ART_BG = "#EEF2EF";

type Game = { title: string; desc: string; href: Href; bg: string } & (
  { image: ImageSourcePropType } | { icon: SymbolViewProps["name"]; fallback: string; color: string }
);

const enter = (i: number) => FadeIn.duration(180).delay(i * 25);

/** Games tab: every game one tap away (today's puzzles live on Home). */
export default function Games() {
  const { t } = useI18n();
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
    {
      image: TAKTIK.hero,
      title: t("ttkName"),
      desc: t("ttkShort"),
      href: "/taktik",
      bg: ART_BG,
    },
    {
      image: ROZET.duel,
      title: t("dzName"),
      desc: t("dzShort"),
      href: "/duello",
      bg: ART_BG,
    },
  ];

  return (
    <Page topInset>
      <Text style={[T.largeTitle, { marginTop: 4 }]}>{t("tabGames")}</Text>

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
