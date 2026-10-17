import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, Stack } from "expo-router";
import { Image, StyleSheet, View, type ImageSourcePropType } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "~/components/Text";
import { Button, Segmented } from "~/components/ui";
import { BRAND, KOSU, ROZET, TAKTIK } from "~/lib/brand";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { C, F, GAME } from "~/lib/theme";

export const ONBOARDED_KEY = "onboarded-v1";

/**
 * First launch, one screen: what the app is (a few of the games as tiles), the language, and one
 * clear way in, today's Tic-Tac-Toe grid. "Look around" goes Home. Shown only to new installs
 * (root layout: no XP yet), and again from Settings.
 */
export default function Onboarding() {
  const { t, locale, setLocale } = useI18n();
  const insets = useSafeAreaInsets();

  const tiles: { image: ImageSourcePropType; bg: string }[] = [
    { image: BRAND.icon.tiki, bg: GAME.ht.bg },
    { image: ROZET.duel, bg: GAME.dz.bg },
    { image: BRAND.icon.quiz, bg: GAME.qz.bg },
    { image: KOSU.hero, bg: GAME.rush.bg },
    { image: BRAND.icon.bingo, bg: GAME.bingo.bg },
    { image: TAKTIK.hero, bg: GAME.tt.bg },
  ];

  const done = async (then?: "/hat-trick/tek") => {
    haptic.success();
    await AsyncStorage.setItem(ONBOARDED_KEY, "1");
    if (router.canGoBack()) router.back();
    else router.replace("/");
    if (then) setTimeout(() => router.push(then), 250);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />

      <View style={styles.top}>
        <Image source={BRAND.wordmark} style={styles.logo} resizeMode="contain" />
        <View style={{ width: 120 }}>
          <Segmented
            value={locale}
            onChange={setLocale}
            options={[
              { value: "tr", label: "TR" },
              { value: "en", label: "EN" },
            ]}
          />
        </View>
      </View>

      <View style={styles.middle}>
        <View style={styles.tiles}>
          {tiles.map((g, i) => (
            <Animated.View key={i} entering={FadeIn.delay(80 + i * 60).duration(260)} style={[styles.tile, { backgroundColor: g.bg }]}>
              <Image source={g.image} style={styles.tileArt} resizeMode="contain" />
            </Animated.View>
          ))}
        </View>
        <Animated.View entering={FadeInDown.delay(300).duration(260)}>
          <Text style={styles.title} accessibilityRole="header">
            {t("obTitle")}
          </Text>
          <Text style={styles.body}>{t("obBody")}</Text>
        </Animated.View>
      </View>

      <Animated.View entering={FadeInDown.delay(420).duration(260)} style={styles.footer}>
        <Button title={t("obFirst")} icon="play.fill" onPress={() => done("/hat-trick/tek")} />
        <Text style={styles.sub}>{t("obFirstSub")}</Text>
        <Button title={t("obExplore")} kind="secondary" onPress={() => done()} style={{ marginTop: 6 }} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 20 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  logo: { width: 128, height: 34 },
  middle: { flex: 1, justifyContent: "center", gap: 28 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
  tile: { width: "30%", aspectRatio: 1, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  tileArt: { width: "70%", height: "70%" },
  title: { fontFamily: F.display, fontSize: 40, lineHeight: 42, color: C.text, textAlign: "center" },
  body: { fontSize: 17, lineHeight: 24, color: C.text2, textAlign: "center", marginTop: 8 },
  footer: { gap: 6 },
  sub: { fontSize: 13, color: C.text3, textAlign: "center" },
});
