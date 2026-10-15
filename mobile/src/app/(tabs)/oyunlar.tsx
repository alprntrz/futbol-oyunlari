import { router, type Href } from "expo-router";
import { Image, StyleSheet, View, type ImageSourcePropType } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Text } from "~/components/Text";
import { Page, Tap } from "~/components/ui";
import { BRAND, ROZET, TAKTIK } from "~/lib/brand";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { C, F } from "~/lib/theme";

type Game = { title: string; desc: string; who: string; image: ImageSourcePropType; bg: string; ink: string; href: Href };

/**
 * Games tab, like the Play online picker: every game a big coloured card (art,
 * name, one line, who it's for), grouped into "against someone" and "on your
 * own". A tap opens the game's own screen.
 */
export default function Games() {
  const { t } = useI18n();
  const versus: Game[] = [
    { title: t("tikiTakaName"), desc: t("htShort"), who: t("play1v1"), image: BRAND.icon.tiki, bg: "#DBEAFE", ink: "#1E3A8A", href: "/hat-trick" },
    { title: t("dzName"), desc: t("dzShort"), who: t("play1v1"), image: ROZET.duel, bg: "#FFE4E6", ink: "#9F1239", href: "/duello" },
    { title: t("qzName"), desc: t("qzShort"), who: t("playUpTo5"), image: BRAND.icon.quiz, bg: "#EDE9FE", ink: "#5B21B6", href: "/bilgi" },
    { title: t("ppName"), desc: t("ppShort"), who: t("play1v1"), image: BRAND.icon.possession, bg: "#DCFCE7", ink: "#14532D", href: "/possession" },
  ];
  // Kombine (match-3, /kombine) is shelved for a later version: code and routes stay, no entry here
  const solo: Game[] = [
    { title: t("ttkName"), desc: t("ttkShort"), who: t("playSolo"), image: TAKTIK.hero, bg: "#D1FAE5", ink: "#065F46", href: "/taktik" },
    { title: t("myName"), desc: t("myShort"), who: t("playSolo"), image: BRAND.icon.mystery, bg: "#FEF3C7", ink: "#92400E", href: "/gizli" },
    { title: t("missingXI"), desc: t("xiShort"), who: t("playSolo"), image: BRAND.icon.practice, bg: "#E0F2FE", ink: "#075985", href: "/eksik-11" },
    { title: t("bingoName"), desc: t("bingoShort"), who: t("playSolo"), image: BRAND.icon.bingo, bg: "#ECFCCB", ink: "#3F6212", href: "/bingo" },
  ];

  // every game on one screen: a 2-column grid of compact tiles (art, name, who it's for)
  const card = (g: Game, i: number) => (
    <Animated.View key={g.title} entering={FadeInDown.delay(i * 30).duration(200)} style={styles.cell}>
      <Tap onPress={() => (haptic.tap(), router.push(g.href))} style={[styles.card, { backgroundColor: g.bg }]} accessibilityLabel={`${g.title}. ${g.desc}`}>
        <Image source={g.image} style={styles.art} />
        <Text style={[styles.name, { color: g.ink }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {g.title}
        </Text>
        <Text style={[styles.who, { color: g.ink }]}>{g.who}</Text>
      </Tap>
    </Animated.View>
  );

  return (
    <Page topInset>
      <Text style={styles.title}>{t("tabGames")}</Text>
      <Text style={styles.section}>{t("gamesVersus")}</Text>
      <View style={styles.list}>{versus.map(card)}</View>
      <Text style={styles.section}>{t("gamesSolo")}</Text>
      <View style={styles.list}>{solo.map((g, i) => card(g, i + versus.length))}</View>
    </Page>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: F.display, fontSize: 34, lineHeight: 36, color: C.text, marginTop: 2 },
  section: { fontFamily: F.display, fontSize: 19, color: C.text, marginTop: 12, marginBottom: 8 },
  list: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  cell: { width: "48.5%" },
  card: { alignItems: "center", justifyContent: "center", gap: 2, borderRadius: 22, paddingHorizontal: 10, paddingVertical: 12, height: 146 },
  art: { width: 64, height: 64, resizeMode: "contain", marginBottom: 4 },
  name: { fontFamily: F.black, fontSize: 21, lineHeight: 23, textAlign: "center" },
  who: { fontSize: 12, fontWeight: "800" },
});
