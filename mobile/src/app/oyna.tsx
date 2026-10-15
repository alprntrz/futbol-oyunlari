import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, type Href } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Image, ScrollView, StyleSheet, useWindowDimensions, View, type ImageSourcePropType } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "~/components/Text";
import { Icon, Tap } from "~/components/ui";
import { BRAND, ROZET } from "~/lib/brand";
import { useDuel } from "~/lib/duel";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { useQuizDifficulty } from "~/lib/quizLevel";
import { C, F } from "~/lib/theme";

const KEY = "quick-game";
type Id = "ht" | "dz" | "qz" | "pp";

/**
 * Home's Play: one game per full page, swipe left/right, one big button at the
 * bottom that finds an opponent in the game on screen. Opens on the last game
 * played. Nothing else to decide.
 */
export default function PlayPicker() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [level] = useQuizDifficulty();
  const duel = useDuel();
  const scroller = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  const games: { id: Id; name: string; desc: string; who: string; image: ImageSourcePropType; bg: string; href: Href }[] = [
    { id: "ht", name: t("tikiTakaName"), desc: t("htShort"), who: t("play1v1"), image: BRAND.icon.tiki, bg: "#DBEAFE", href: "/hat-trick/rastgele" },
    {
      id: "dz",
      name: t("dzName"),
      desc: t("dzShort"),
      who: t("play1v1"),
      image: ROZET.duel,
      bg: "#FFE4E6",
      href: duel.ready ? "/duello/rastgele" : "/duello/draft",
    },
    { id: "qz", name: t("qzName"), desc: t("qzShort"), who: t("playUpTo5"), image: BRAND.icon.quiz, bg: "#EDE9FE", href: { pathname: "/bilgi/rastgele", params: { zorluk: level } } },
    { id: "pp", name: t("ppName"), desc: t("ppShort"), who: t("play1v1"), image: BRAND.icon.possession, bg: "#DCFCE7", href: "/possession/rastgele" },
  ];

  // open on the last game played
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        const i = games.findIndex((g) => g.id === v);
        if (i > 0) {
          setPage(i);
          setTimeout(() => scroller.current?.scrollTo({ x: i * width, animated: false }), 0);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = games[page];
  const needsHand = current.id === "dz" && !duel.ready;
  const go = (i: number) => {
    haptic.tap();
    scroller.current?.scrollTo({ x: i * width, animated: true });
  };
  const play = () => {
    haptic.press();
    AsyncStorage.setItem(KEY, current.id).catch(() => {});
    router.replace(current.href);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.top}>
        <Text style={styles.title}>{t("playPickTitle")}</Text>
        <Tap onPress={() => router.back()} style={styles.close} accessibilityLabel={t("close")}>
          <Icon name="xmark" size={18} color={C.text} fallback="✕" />
        </Tap>
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / width);
          if (i !== page) haptic.tap();
          setPage(i);
        }}
        style={{ flex: 1 }}
      >
        {games.map((g, i) => (
          <View key={g.id} style={[styles.page, { width }]}>
            <View style={[styles.art, { backgroundColor: g.bg }]}>
              {i === page ? (
                <Animated.Image key={`a${page}`} entering={ZoomIn.springify().damping(12)} source={g.image} style={styles.artImage} />
              ) : (
                <Image source={g.image} style={styles.artImage} />
              )}
            </View>
            <Text style={styles.name}>{g.name}</Text>
            <Text style={styles.desc}>{g.desc}</Text>
            <View style={styles.who}>
              <Icon name="person.2.fill" size={14} color={C.greenDark} fallback="👥" />
              <Text style={styles.whoText}>{g.who}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* where you are: tap a dot to jump */}
      <View style={styles.dots}>
        {games.map((g, i) => (
          <Tap key={g.id} onPress={() => go(i)} accessibilityLabel={g.name} style={{ padding: 6 }}>
            <View style={[styles.dot, i === page && styles.dotOn]} />
          </Tap>
        ))}
      </View>
      <Text style={styles.swipe}>{t("playSwipe")}</Text>

      <Animated.View key={current.id} entering={FadeIn.duration(150)} style={{ paddingHorizontal: 20 }}>
        <Tap onPress={play} style={styles.button} accessibilityLabel={needsHand ? t("playMakeHand") : `${t("playFind")}: ${current.name}`}>
          <Icon name={needsHand ? "square.stack.fill" : "play.fill"} size={18} color="#3B2A05" fallback="▶" />
          <Text style={styles.buttonText} numberOfLines={1} adjustsFontSizeToFit>
            {needsHand ? t("playMakeHand") : t("playFind")}
          </Text>
        </Tap>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20 },
  title: { fontFamily: F.display, fontSize: 28, color: C.text },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#E3E8E4", alignItems: "center", justifyContent: "center" },
  page: { alignItems: "center", justifyContent: "center", paddingHorizontal: 28, gap: 10 },
  art: { width: 240, height: 240, borderRadius: 60, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  artImage: { width: 180, height: 180, resizeMode: "contain" },
  name: { fontFamily: F.black, fontSize: 40, lineHeight: 42, color: C.text, textAlign: "center" },
  desc: { fontSize: 18, lineHeight: 24, color: C.text2, textAlign: "center", maxWidth: 320 },
  who: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.greenSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginTop: 4 },
  whoText: { fontWeight: "700", fontSize: 14, color: C.greenDark },
  dots: { flexDirection: "row", justifyContent: "center", gap: 4 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#CBD5C8" },
  dotOn: { width: 26, backgroundColor: C.green },
  swipe: { textAlign: "center", fontSize: 13, color: C.text3, marginTop: 2, marginBottom: 12 },
  button: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, height: 64, borderRadius: 20, backgroundColor: "#FACC15", borderBottomWidth: 5, borderBottomColor: "#CA8A04" },
  buttonText: { fontFamily: F.black, fontSize: 26, color: "#3B2A05" },
});
