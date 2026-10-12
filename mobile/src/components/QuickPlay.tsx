import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { Image, StyleSheet, View, type ImageSourcePropType } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";

import { BRAND } from "~/lib/brand";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { useQuizDifficulty } from "~/lib/quizLevel";
import { C, F } from "~/lib/theme";

import { Text } from "./Text";
import { Button, Tap } from "./ui";

type Game = "ht" | "qz" | "pp";
const KEY = "quick-game";

/**
 * Home's main call to action: one tap into a random opponent. The game picker
 * remembers the last choice; the quiz uses the level picked in the quiz hub.
 */
export function QuickPlay() {
  const { t } = useI18n();
  const [game, setGame] = useState<Game>("ht");
  const [level] = useQuizDifficulty();

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => (v === "ht" || v === "qz" || v === "pp") && setGame(v))
      .catch(() => {});
  }, []);

  // the play button breathes a little so the eye lands on it
  const breathe = useSharedValue(1);
  useEffect(() => {
    breathe.set(withRepeat(withSequence(withTiming(1.03, { duration: 900 }), withTiming(1, { duration: 900 })), -1));
  }, [breathe]);
  const breatheStyle = useAnimatedStyle(() => ({ transform: [{ scale: breathe.get() }] }));

  const games: { id: Game; name: string; image: ImageSourcePropType; href: Href }[] = [
    { id: "ht", name: t("tikiTakaName"), image: BRAND.icon.tiki, href: "/hat-trick/rastgele" },
    { id: "qz", name: t("qzName"), image: BRAND.icon.quiz, href: { pathname: "/bilgi/rastgele", params: { zorluk: level } } },
    { id: "pp", name: t("ppName"), image: BRAND.icon.possession, href: "/possession/rastgele" },
  ];
  const current = games.find((g) => g.id === game) ?? games[0];

  const choose = (g: Game) => {
    haptic.tap();
    setGame(g);
    AsyncStorage.setItem(KEY, g).catch(() => {});
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t("qpTitle")}</Text>
      <Text style={styles.desc}>{t("qpDesc")}</Text>
      <View style={styles.games}>
        {games.map((g) => {
          const on = g.id === game;
          return (
            <Tap key={g.id} onPress={() => choose(g.id)} style={[styles.game, on && styles.gameOn]} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={g.name}>
              <Image source={g.image} style={{ width: 40, height: 40 }} />
              <Text style={[styles.gameName, on && { color: C.greenDark }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                {g.name}
              </Text>
            </Tap>
          );
        })}
      </View>
      <Animated.View style={[{ marginTop: 14 }, breatheStyle]}>
        <Button title={`${t("qpPlay")}: ${current.name}`} kind="gold" icon="play.fill" onPress={() => router.push(current.href)} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.greenMid, borderRadius: 24, padding: 16, marginTop: 14 },
  title: { fontFamily: F.black, fontSize: 30, lineHeight: 32, color: "white" },
  desc: { fontSize: 15, fontWeight: "600", color: "rgba(255,255,255,0.88)", marginTop: 2 },
  games: { flexDirection: "row", gap: 8, marginTop: 14 },
  game: { flex: 1, alignItems: "center", gap: 4, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.14)", borderWidth: 2, borderColor: "transparent" },
  gameOn: { backgroundColor: "white", borderColor: "#FACC15" },
  gameName: { fontFamily: F.display, fontSize: 15, color: "white" },
});
