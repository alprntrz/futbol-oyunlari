import { router, Stack, useFocusEffect, type Href } from "expo-router";
import { useCallback, useState } from "react";
import type { SymbolViewProps } from "expo-symbols";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LevelCard, type QuizProfile } from "~/components/QuizLevel";
import { goBack, NIGHT, StadiumHeader, NightStatusBar } from "~/components/StadiumHeader";
import { Text } from "~/components/Text";
import { Icon, Tap } from "~/components/ui";
import { useI18n } from "~/lib/i18n";
import { loadPlayerId } from "~/lib/nick";
import { getSocket } from "~/lib/socket";
import { F } from "~/lib/theme";

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
  const modes: { icon: SymbolViewProps["name"]; title: string; desc: string; href: Href; bg: string }[] = [
    { icon: "person.3.fill", title: t("htRandom"), desc: t("qzRandomDesc"), href: "/bilgi/rastgele", bg: "#2563EB" },
    { icon: "person.2.badge.plus", title: t("htFriend"), desc: t("qzFriendsDesc"), href: "/bilgi/oda", bg: "#F59E0B" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: NIGHT.body }}>
      <Stack.Screen options={{ headerShown: false, contentStyle: { backgroundColor: NIGHT.body } }} />
      <NightStatusBar />
      <StadiumHeader height={HEADER} />
      <Pressable onPress={() => goBack()} style={[styles.back, { top: insets.top + 6 }]} accessibilityRole="button" accessibilityLabel={t("close")} hitSlop={8}>
        <Icon name="chevron.left" size={18} color="white" fallback="‹" />
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
            <Icon name="chevron.right" size={14} color="rgba(255,255,255,0.7)" fallback="›" />
          </Tap>
        </Animated.View>
        {modes.map((m) => (
          <Animated.View key={m.title} entering={FadeIn.duration(200)}>
            <Tap onPress={() => router.push(m.href)} style={[styles.card, { backgroundColor: m.bg }]} accessibilityLabel={`${m.title}. ${m.desc}`}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.cardTitle}>{m.title}</Text>
                <Text style={styles.cardDesc}>{m.desc}</Text>
              </View>
              <Icon name={m.icon} size={52} color="white" fallback="•" />
            </Tap>
          </Animated.View>
        ))}
        <Animated.View entering={FadeIn.duration(200)} style={styles.rules}>
          {[t("qzRule1"), t("qzRule2"), t("qzRule3")].map((r) => (
            <View key={r} style={{ flexDirection: "row", gap: 10 }}>
              <View style={styles.bullet} />
              <Text style={styles.rule}>{r}</Text>
            </View>
          ))}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  back: { position: "absolute", left: 12, zIndex: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
  title: { fontFamily: F.black, fontSize: 34, lineHeight: 38, color: "white" },
  sub: { fontSize: 15, lineHeight: 21, color: "rgba(255,255,255,0.78)", marginTop: 4 },
  card: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 26, paddingHorizontal: 22, paddingVertical: 24, minHeight: 124 },
  cardTitle: { fontFamily: F.black, fontSize: 28, lineHeight: 31, color: "white" },
  cardDesc: { fontSize: 15, fontWeight: "600", lineHeight: 20, color: "rgba(255,255,255,0.9)" },
  standings: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 13 },
  standingsText: { flex: 1, fontFamily: F.display, fontSize: 19, color: "white" },
  rules: { gap: 10, backgroundColor: "rgba(0,0,0,0.18)", borderRadius: 20, padding: 16, marginTop: 4 },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: NIGHT.accent, marginTop: 8 },
  rule: { flex: 1, fontSize: 15, lineHeight: 21, color: "rgba(255,255,255,0.88)" },
});
