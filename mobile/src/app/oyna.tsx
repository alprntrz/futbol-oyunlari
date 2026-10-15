import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { Image, ScrollView, StyleSheet, View, type ImageSourcePropType } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
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
 * Home's "Play someone": every versus game on one screen as a big card. Tap a
 * card and the opponent search starts in that game. Nothing hidden, nothing
 * else to decide (Card Duel without a hand goes to drafting it first).
 */
export default function PlayPicker() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [level] = useQuizDifficulty();
  const duel = useDuel();
  // ?with=friend: the same cards open a room to share with a friend (Card Duel has no friend rooms yet)
  const friend = useLocalSearchParams<{ with?: string }>().with === "friend";

  const games: { id: Id; name: string; desc: string; who: string; image: ImageSourcePropType; bg: string; ink: string; href: Href; note?: string }[] = [
    { id: "ht", name: t("tikiTakaName"), desc: t("htShort"), who: t("play1v1"), image: BRAND.icon.tiki, bg: "#DBEAFE", ink: "#1E3A8A", href: "/hat-trick/rastgele" },
    {
      id: "dz",
      name: t("dzName"),
      desc: t("dzShort"),
      who: t("play1v1"),
      image: ROZET.duel,
      bg: "#FFE4E6",
      ink: "#9F1239",
      href: duel.ready ? "/duello/rastgele" : "/duello/draft",
      note: duel.ready ? undefined : t("playMakeHand"),
    },
    { id: "qz", name: t("qzName"), desc: t("qzShort"), who: t("playUpTo5"), image: BRAND.icon.quiz, bg: "#EDE9FE", ink: "#5B21B6", href: { pathname: "/bilgi/rastgele", params: { zorluk: level } } },
    { id: "pp", name: t("ppName"), desc: t("ppShort"), who: t("play1v1"), image: BRAND.icon.possession, bg: "#DCFCE7", ink: "#14532D", href: "/possession/rastgele" },
  ];

  const friendHref: Partial<Record<Id, Href>> = {
    ht: "/hat-trick/oda",
    qz: { pathname: "/bilgi/oda", params: { zorluk: level } },
    pp: "/possession/oda",
  };
  const shown = friend ? games.filter((g) => friendHref[g.id]).map((g) => ({ ...g, href: friendHref[g.id]!, note: undefined, who: g.id === "qz" ? t("playUpTo5") : t("play1v1") })) : games;
  const pick = (g: (typeof games)[number]) => {
    haptic.press();
    if (!friend) AsyncStorage.setItem(KEY, g.id).catch(() => {});
    router.replace(g.href);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <View style={styles.top}>
        <Text style={styles.title}>{t(friend ? "playFriendTitle" : "playPickTitle")}</Text>
        <Tap onPress={() => router.back()} style={styles.close} accessibilityLabel={t("close")}>
          <Icon name="xmark" size={18} color={C.text} fallback="✕" />
        </Tap>
      </View>
      <Text style={styles.sub}>{t(friend ? "playFriendSub" : "playTapToStart")}</Text>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 16, gap: 12 }}>
        {shown.map((g, i) => (
          <Animated.View key={g.id} entering={FadeInDown.delay(i * 60).duration(220)}>
            <Tap onPress={() => pick(g)} style={[styles.card, { backgroundColor: g.bg }]} accessibilityLabel={`${g.name}. ${g.desc}`}>
              <Image source={g.image} style={styles.art} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[styles.name, { color: g.ink }]} numberOfLines={1} adjustsFontSizeToFit>
                  {g.name}
                </Text>
                <Text style={styles.desc} numberOfLines={2}>
                  {g.desc}
                </Text>
                <Text style={[styles.who, { color: g.ink }]}>{g.note ?? g.who}</Text>
              </View>
              <View style={[styles.go, { backgroundColor: g.ink }]}>
                <Icon name="play.fill" size={16} color="white" fallback="▶" />
              </View>
            </Tap>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20 },
  title: { fontFamily: F.display, fontSize: 30, color: C.text },
  sub: { fontSize: 15, color: C.text2, paddingHorizontal: 20, marginTop: 2 },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#E3E8E4", alignItems: "center", justifyContent: "center" },
  card: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 24, padding: 16, minHeight: 128 },
  art: { width: 84, height: 84, resizeMode: "contain" },
  name: { fontFamily: F.black, fontSize: 28, lineHeight: 30 },
  desc: { fontSize: 15, lineHeight: 20, color: C.text2 },
  who: { fontSize: 13, fontWeight: "800" },
  go: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
