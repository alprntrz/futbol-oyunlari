import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, View, type ImageSourcePropType } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";

import { BRAND } from "~/lib/brand";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { useQuizDifficulty } from "~/lib/quizLevel";
import { C, F, T } from "~/lib/theme";

import { ModeList, type Mode } from "./ModeGrid";
import { Text } from "./Text";
import { Button, Tap } from "./ui";

type Game = "ht" | "qz" | "pp";
const KEY = "quick-game";

/**
 * Home's main call to action: pick a game, then Play asks how (random opponent,
 * a friend, same screen, solo), like the game's own screen. The game picker
 * remembers the last choice; the quiz uses the level picked in the quiz hub.
 */
export function QuickPlay() {
  const { t } = useI18n();
  const [game, setGame] = useState<Game>("ht");
  const [level] = useQuizDifficulty();
  const insets = useSafeAreaInsets();

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

  const games: { id: Game; name: string; image: ImageSourcePropType }[] = [
    { id: "ht", name: t("tikiTakaName"), image: BRAND.icon.tiki },
    { id: "qz", name: t("qzName"), image: BRAND.icon.quiz },
    { id: "pp", name: t("ppName"), image: BRAND.icon.possession },
  ];
  const current = games.find((g) => g.id === game) ?? games[0];
  // Play asks how: the same ways as the game's own screen
  const [asking, setAsking] = useState(false);
  const friend: Mode = { icon: "person.2.fill", fallback: "👥", title: t("htFriend"), desc: t(game === "qz" ? "qzFriendsDesc" : "htFriendDesc"), href: "/", image: BRAND.mode.friend, color: C.greenMid, soft: C.greenSoft };
  const random: Mode = { icon: "antenna.radiowaves.left.and.right", fallback: "📡", title: t("htRandom"), desc: t(game === "qz" ? "qzRandomDesc" : "htRandomDesc"), href: "/", image: BRAND.mode.random, color: C.blue, soft: C.blueSoft };
  const same: Mode = { icon: "iphone", fallback: "📱", title: t("htSame"), desc: t(game === "pp" ? "ppSameDesc" : "htSameDesc"), href: "/", image: BRAND.mode.same, color: C.coral, soft: C.coralSoft };
  const solo: Mode = { icon: "person.fill", fallback: "👤", title: t("htSolo"), desc: t("htSoloDesc"), href: "/", image: BRAND.mode.solo, color: "#B7791F", soft: C.amberSoft };
  const modes: Mode[] =
    game === "ht"
      ? [{ ...random, href: "/hat-trick/rastgele" }, { ...friend, href: "/hat-trick/oda" }, { ...same, href: "/hat-trick/yerel" }, { ...solo, href: "/hat-trick/tek" }]
      : game === "qz"
        ? [
            { ...random, href: { pathname: "/bilgi/rastgele", params: { zorluk: level } } },
            { ...friend, href: { pathname: "/bilgi/oda", params: { zorluk: level } } },
          ]
        : [{ ...random, href: "/possession/rastgele" }, { ...friend, href: "/possession/oda" }, { ...same, href: "/possession/yerel" }];
  const pick = (m: Mode) => {
    setAsking(false);
    // let the sheet slide away before the next screen comes in
    setTimeout(() => router.push(m.href), 250);
  };

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
        <Button title={`${t("qpPlay")}: ${current.name}`} kind="gold" icon="play.fill" onPress={() => setAsking(true)} />
      </Animated.View>

      <Modal statusBarTranslucent navigationBarTranslucent visible={asking} transparent animationType="slide" onRequestClose={() => setAsking(false)}>
        <Pressable style={styles.backdrop} onPress={() => setAsking(false)} accessibilityLabel={t("close")} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.grabber} />
          <View style={styles.sheetHead}>
            <Image source={current.image} style={{ width: 44, height: 44 }} />
            <View style={{ flex: 1 }}>
              <Text style={T.title}>{current.name}</Text>
              <Text style={T.caption}>{t("qpHow")}</Text>
            </View>
          </View>
          <ModeList modes={modes} onPick={pick} />
        </View>
      </Modal>
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
  backdrop: { flex: 1, backgroundColor: "rgba(11,18,32,0.35)" },
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 16, paddingTop: 8 },
  grabber: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: "#D5DAE1", marginBottom: 14 },
  sheetHead: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14, marginHorizontal: 4 },
  gameName: { fontFamily: F.display, fontSize: 15, color: "white" },
});
