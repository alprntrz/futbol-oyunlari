import { router, Stack, useFocusEffect, type Href } from "expo-router";
import { useCallback, useState } from "react";
import type { SymbolViewProps } from "expo-symbols";
import { Image, Pressable, ScrollView, StyleSheet, View, type ImageSourcePropType } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Rule } from "~/components/HowTo";
import { LevelCard, type QuizProfile } from "~/components/QuizLevel";
import { goBack, NIGHT, StadiumHeader, NightStatusBar } from "~/components/StadiumHeader";
import { Text } from "~/components/Text";
import { Icon, Tap } from "~/components/ui";
import { BRAND } from "~/lib/brand";
import { useI18n } from "~/lib/i18n";
import { loadPlayerId } from "~/lib/nick";
import { getSocket } from "~/lib/socket";
import { C, F } from "~/lib/theme";

const HEADER = 130;

/** Football Quiz hub: big coloured mode cards under the stadium, like the game screens. */
export default function QuizHome() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<QuizProfile | null>(null);

  // Fresh level every time the hub comes back into view (after a game)
  useFocusEffect(
    useCallback(() => {
      loadPlayerId().then((pid) =>
        getSocket()
          .timeout(5000)
          .emit("qz:profile", { pid }, (err: Error | null, res?: { ok: boolean; profile: QuizProfile }) => {
            if (!err && res?.ok) setProfile(res.profile);
          })
      );
    }, [])
  );
  const modes: { icon: SymbolViewProps["name"]; image: ImageSourcePropType; title: string; desc: string; href: Href; bg: string }[] = [
    { icon: "person.3.fill", title: t("htRandom"), desc: t("qzRandomDesc"), href: "/bilgi/rastgele", image: BRAND.mode.random, bg: NIGHT.light ? C.green : "#2563EB" },
    { icon: "person.2.badge.plus", title: t("htFriend"), desc: t("qzFriendsDesc"), href: "/bilgi/oda", image: BRAND.mode.friend, bg: NIGHT.light ? C.greenDark : "#F59E0B" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: NIGHT.body }}>
      <Stack.Screen options={{ headerShown: false, contentStyle: { backgroundColor: NIGHT.body } }} />
      <NightStatusBar />
      <StadiumHeader height={HEADER} />
      <Pressable onPress={() => goBack()} style={[styles.back, { top: insets.top + 6 }]} accessibilityRole="button" accessibilityLabel={t("close")} hitSlop={8}>
        <Icon name="chevron.left" size={18} color={NIGHT.ink} fallback="‹" />
      </Pressable>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + HEADER - 10, paddingHorizontal: 16, paddingBottom: insets.bottom + 24, gap: 14 }}>
        <Animated.View entering={FadeIn.duration(200)}>
          <Text style={styles.title}>{t("qzName")}</Text>
          <Text style={styles.sub}>{t("qzTagline")}</Text>
        </Animated.View>
        <Animated.View entering={FadeIn.duration(200)} style={{ gap: 10 }}>
          <LevelCard profile={profile} />
          <Tap onPress={() => router.push("/bilgi/siralama")} style={styles.standings} accessibilityLabel={t("qzStandingsTitle")}>
            <Icon name="trophy.fill" size={18} color="#FACC15" fallback="🏆" />
            <Text style={styles.standingsText}>{t("qzStandingsTitle")}</Text>
            <Icon name="chevron.right" size={14} color={NIGHT.ink3} fallback="›" />
          </Tap>
        </Animated.View>
        {modes.map((m) => (
          <Animated.View key={m.title} entering={FadeIn.duration(200)}>
            <Tap onPress={() => router.push(m.href)} style={[styles.card, { backgroundColor: m.bg }]} accessibilityLabel={`${m.title}. ${m.desc}`}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.cardTitle}>{m.title}</Text>
                <Text style={styles.cardDesc}>{m.desc}</Text>
              </View>
              <Image source={m.image} style={{ width: 72, height: 72 }} />
            </Tap>
          </Animated.View>
        ))}
        <Animated.View entering={FadeIn.duration(200)} style={styles.rules}>
          <Rule image={BRAND.how.questions} desc={t("qzRule1")} />
          <Rule image={BRAND.how.speed} desc={t("qzRule2")} />
          <Rule image={BRAND.how.players} desc={t("qzRule3")} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  back: { position: "absolute", left: 12, zIndex: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: NIGHT.raised, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: F.black, fontSize: 34, lineHeight: 38, color: NIGHT.ink },
  sub: { fontSize: 15, lineHeight: 21, color: NIGHT.ink2, marginTop: 4 },
  card: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 26, paddingHorizontal: 22, paddingVertical: 24, minHeight: 124 },
  cardTitle: { fontFamily: F.black, fontSize: 28, lineHeight: 31, color: "white" },
  cardDesc: { fontSize: 15, fontWeight: "600", lineHeight: 20, color: "rgba(255,255,255,0.9)" },
  standings: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: NIGHT.raised, borderWidth: NIGHT.light ? 1 : 0, borderColor: NIGHT.line, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 13 },
  standingsText: { flex: 1, fontFamily: F.display, fontSize: 19, color: NIGHT.ink },
  rules: { gap: 14, backgroundColor: NIGHT.light ? NIGHT.raised : NIGHT.sunk, borderWidth: NIGHT.light ? 1 : 0, borderColor: NIGHT.line, borderRadius: 20, padding: 16, marginTop: 4 },
});
