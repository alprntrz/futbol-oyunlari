import { router, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Modal, ScrollView, StyleSheet, useWindowDimensions, View, type ImageSourcePropType } from "react-native";
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, ZoomIn } from "react-native-reanimated";

import { BRAND, ROZET, TAKTIK } from "~/lib/brand";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { C, F } from "~/lib/theme";

import { Text } from "./Text";
import { TodayPuzzles } from "./TodayPuzzles";
import { Icon, Tap } from "./ui";

type Token = { key: string; title: string; image: ImageSourcePropType; href: Href; x: number; y: number };

/**
 * Home as a pitch seen from above (draft C): every game is a player token in a
 * formation; the glowing token on the centre spot opens today's puzzles.
 * Positions are fractions of the pitch (x from the left, y from the top).
 */
export function HomePitch() {
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const [today, setToday] = useState(false);
  const w = width - 32;
  const h = Math.round(w * 1.2);
  const size = Math.min(78, w * 0.2);

  const tokens: Token[] = [
    // attack
    { key: "ht", title: t("tikiTakaName"), image: BRAND.icon.tiki, href: "/hat-trick", x: 0.17, y: 0.09 },
    { key: "dz", title: t("dzName"), image: ROZET.duel, href: "/duello", x: 0.5, y: 0.05 },
    { key: "qz", title: t("qzName"), image: BRAND.icon.quiz, href: "/bilgi", x: 0.83, y: 0.09 },
    // midfield
    { key: "tt", title: t("ttkName"), image: TAKTIK.hero, href: "/taktik", x: 0.18, y: 0.4 },
    { key: "bingo", title: t("bingoName"), image: BRAND.icon.bingo, href: "/bingo", x: 0.82, y: 0.4 },
    // defence
    { key: "my", title: t("myName"), image: BRAND.icon.mystery, href: "/gizli", x: 0.2, y: 0.69 },
    { key: "pp", title: t("ppName"), image: BRAND.icon.possession, href: "/possession", x: 0.5, y: 0.73 },
    { key: "xi", title: t("missingXI"), image: BRAND.icon.practice, href: "/eksik-11", x: 0.8, y: 0.69 },
  ];

  const go = (href: Href) => {
    haptic.tap();
    router.push(href);
  };

  return (
    <>
      <View style={[styles.pitch, { height: h }]}>
        {/* the markings */}
        <View style={styles.stripes}>
          {Array.from({ length: 8 }, (_, i) => (
            <View key={i} style={[styles.stripe, i % 2 === 1 && { backgroundColor: "rgba(255,255,255,0.05)" }]} />
          ))}
        </View>
        <View style={[styles.line, { top: h / 2 }]} />
        <View style={[styles.circle, { width: w * 0.36, height: w * 0.36, borderRadius: w * 0.18, left: w / 2 - w * 0.18, top: h / 2 - w * 0.18 }]} />
        <View style={[styles.box, { top: -2, left: w * 0.22, width: w * 0.56, height: h * 0.13 }]} />
        <View style={[styles.box, { bottom: -2, left: w * 0.22, width: w * 0.56, height: h * 0.13 }]} />

        {tokens.map((tk, i) => (
          <Animated.View key={tk.key} entering={ZoomIn.delay(60 + i * 45).duration(200)} style={[styles.slot, { left: tk.x * w - size / 2 - 8, top: tk.y * h }]}>
            <Tap onPress={() => go(tk.href)} accessibilityLabel={tk.title} style={{ alignItems: "center" }}>
              <View style={[styles.token, { width: size, height: size, borderRadius: size / 2 }]}>
                <Image source={tk.image} style={{ width: size * 0.74, height: size * 0.74 }} resizeMode="contain" />
              </View>
              <Text style={[styles.name, { width: size + 16 }]} numberOfLines={2}>
                {tk.title}
              </Text>
            </Tap>
          </Animated.View>
        ))}

        {/* centre spot: today's puzzles */}
        <TodayToken size={size * 1.12} left={w / 2} top={h / 2} onPress={() => (haptic.tap(), setToday(true))} label={t("homeToday")} />
      </View>

      <Modal visible={today} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setToday(false)}>
        <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>{t("homeToday")}</Text>
            <Tap onPress={() => setToday(false)} style={styles.close} accessibilityLabel={t("close")}>
              <Icon name="xmark" size={16} color={C.text2} fallback="✕" />
            </Tap>
          </View>
          {/* a puzzle opened from here closes the sheet */}
          <View onTouchEnd={() => setTimeout(() => setToday(false), 250)}>
            <TodayPuzzles />
          </View>
        </ScrollView>
      </Modal>
    </>
  );
}

/** The ball on the centre spot: gently pulses until you look at today's puzzles. */
function TodayToken({ size, left, top, onPress, label }: { size: number; left: number; top: number; onPress: () => void; label: string }) {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.set(withRepeat(withSequence(withTiming(1.08, { duration: 700 }), withTiming(1, { duration: 700 })), -1));
  }, [pulse]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pulse.get() }] }));
  return (
    <Animated.View entering={FadeIn.delay(450)} style={[styles.slot, { left: left - size / 2, top: top - size / 2 }]}>
      <Tap onPress={onPress} accessibilityLabel={label} style={{ alignItems: "center" }}>
        <Animated.View style={[styles.today, { width: size, height: size, borderRadius: size / 2 }, style]}>
          <Image source={BRAND.icon.daily} style={{ width: size * 0.66, height: size * 0.66 }} resizeMode="contain" />
        </Animated.View>
        <View style={styles.todayPill}>
          <Text style={styles.todayText}>{label}</Text>
        </View>
      </Tap>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pitch: { marginTop: 14, borderRadius: 22, backgroundColor: "#1C9A4C", borderWidth: 3, borderColor: "rgba(255,255,255,0.85)", overflow: "hidden" },
  stripes: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  stripe: { flex: 1 },
  line: { position: "absolute", left: 0, right: 0, height: 2, backgroundColor: "rgba(255,255,255,0.6)" },
  circle: { position: "absolute", borderWidth: 2, borderColor: "rgba(255,255,255,0.6)" },
  box: { position: "absolute", borderWidth: 2, borderColor: "rgba(255,255,255,0.6)" },
  slot: { position: "absolute", alignItems: "center", paddingHorizontal: 8 },
  token: {
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#0E5E2C",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  name: { marginTop: 4, textAlign: "center", fontFamily: F.display, fontSize: 13, lineHeight: 15, color: "white", textShadowColor: "rgba(0,0,0,0.35)", textShadowRadius: 3 },
  today: {
    backgroundColor: "#FACC15",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "white",
    shadowColor: "#FACC15",
    shadowOpacity: 0.8,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  todayPill: { marginTop: 5, backgroundColor: "#0E5E2C", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  todayText: { fontFamily: F.display, fontSize: 14, color: "#FACC15" },
  sheetHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sheetTitle: { fontFamily: F.display, fontSize: 28, color: C.text },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#EEF2EF", alignItems: "center", justifyContent: "center" },
});
