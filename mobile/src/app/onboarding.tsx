import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DemoBoard } from "~/components/HowTo";
import { Jersey } from "~/components/Jersey";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";

export const ONBOARDED_KEY = "onboarded-v1";

/**
 * Onboarding in Linear's design language (.claude/skills/design-md-library/
 * designs/linear.app.md): near-black canvas, four-step surface ladder with 1px
 * hairlines instead of shadows, one lavender accent kept for the primary CTA
 * and the active page indicator, SF Pro (system) with negative display tracking,
 * 8px button / 12-16px panel radii. Each page leads with a live piece of the
 * real product UI, framed like Linear's product screenshots.
 */
const L = {
  canvas: "#010102",
  surface1: "#0f1011",
  surface2: "#141516",
  surface3: "#18191a",
  hairline: "#23252a",
  hairlineStrong: "#34343a",
  ink: "#f7f8f8",
  inkMuted: "#d0d6e0",
  inkSubtle: "#8a8f98",
  primary: "#5e6ad2",
  primaryPressed: "#5e69d1",
  success: "#27a644",
};

export default function Onboarding() {
  const { t, locale, setLocale } = useI18n();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scroller = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  const pages = [
    { title: t("ob1Title"), body: t("ob1Body"), panel: <PitchPanel /> },
    { title: t("ob2Title"), body: t("ob2Body"), panel: <DemoBoard dark /> },
    { title: t("ob3Title"), body: t("ob3Body"), panel: <VersusPanel /> },
  ];
  const last = page === pages.length - 1;

  const finish = async () => {
    haptic.success();
    await AsyncStorage.setItem(ONBOARDED_KEY, "1");
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  const next = () => {
    if (last) return finish();
    haptic.tap();
    scroller.current?.scrollTo({ x: (page + 1) * width, animated: true });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <StatusBar style="light" />

      {/* Top bar: language pill toggle (Linear's pricing tabs) + skip */}
      <View style={styles.topBar}>
        <View style={styles.tabs}>
          {(["tr", "en"] as const).map((l) => (
            <Pressable
              key={l}
              onPress={() => setLocale(l)}
              accessibilityRole="button"
              accessibilityState={{ selected: locale === l }}
              style={[styles.tab, locale === l && styles.tabSelected]}
            >
              <Text style={[styles.tabText, locale === l && { color: L.ink }]}>{l.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
        {!last && (
          <Pressable onPress={finish} hitSlop={12} accessibilityRole="button" style={styles.skip}>
            <Text style={styles.skipText}>{t("obSkip")}</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={{ flex: 1 }}
      >
        {pages.map((p, i) => (
          <View key={i} style={[styles.page, { width }]}>
            <View style={styles.panel}>
              <View style={styles.panelEdge} />
              {p.panel}
            </View>
            <View style={styles.copy}>
              <Text style={styles.title} accessibilityRole="header">
                {p.title}
              </Text>
              <Text style={styles.body}>{p.body}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots} accessibilityLabel={`${page + 1} / ${pages.length}`}>
          {pages.map((_, i) => (
            <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
          ))}
        </View>
        <Pressable
          onPress={next}
          accessibilityRole="button"
          style={({ pressed }) => [styles.cta, pressed && { backgroundColor: L.primaryPressed, opacity: 0.9 }]}
        >
          <Text style={styles.ctaText}>{last ? t("obStart") : t("obNext")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Page 1: a slice of the real pitch with shirts and hidden-name blanks. */
function PitchPanel() {
  const shirts = [
    { x: 22, y: 30, n: 9 },
    { x: 78, y: 30, n: 10 },
    { x: 50, y: 58, n: 8 },
    { x: 22, y: 84, n: 3 },
    { x: 78, y: 84, n: 4 },
  ];
  return (
    <View style={styles.pitch}>
      {Array.from({ length: 4 }, (_, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: i % 2 ? "#2f8a4c" : "#2a7d45" }} />
      ))}
      <View style={styles.pitchCircle} />
      {shirts.map((s, i) => (
        <Animated.View
          key={i}
          entering={FadeInDown.delay(150 + i * 90).springify().damping(13)}
          style={[styles.pitchSlot, { left: `${s.x}%`, top: `${s.y}%` }]}
        >
          <Jersey body="#f7f8f8" sleeves="#f7f8f8" numberColor="#141516" number={s.n} size={46} />
          <View style={styles.blank} />
        </Animated.View>
      ))}
    </View>
  );
}

/** Page 3: race card with a room code and two players, in the surface ladder. */
function VersusPanel() {
  const rows = [
    { name: "Deniz", solved: 7, mine: true },
    { name: "Mert", solved: 5, mine: false },
  ];
  return (
    <Animated.View entering={FadeIn.duration(400)} style={{ gap: 12 }}>
      <View style={styles.codeRow}>
        {"K7M2X".split("").map((ch, i) => (
          <View key={i} style={styles.codeCell}>
            <Text style={styles.codeText}>{ch}</Text>
          </View>
        ))}
      </View>
      {rows.map((r) => (
        <View key={r.name} style={styles.playerRow}>
          <View style={[styles.avatar, r.mine && { borderColor: L.primary }]}>
            <Text style={styles.avatarText}>{r.name[0]}</Text>
          </View>
          <Text style={styles.playerName}>{r.name}</Text>
          <View style={styles.track}>
            <View style={[styles.trackFill, { width: `${(r.solved / 11) * 100}%`, backgroundColor: r.mine ? L.primary : L.hairlineStrong }]} />
          </View>
          <Text style={styles.playerScore}>{r.solved}/11</Text>
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: L.canvas },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, height: 44 },
  tabs: { flexDirection: "row", backgroundColor: L.surface1, borderRadius: 999, borderWidth: 1, borderColor: L.hairline, padding: 2 },
  tab: { minWidth: 44, height: 32, borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  tabSelected: { backgroundColor: L.surface3 },
  tabText: { color: L.inkSubtle, fontSize: 13, fontWeight: "500" },
  skip: { minHeight: 44, justifyContent: "center", paddingHorizontal: 4 },
  skipText: { color: L.inkSubtle, fontSize: 15, fontWeight: "500" },

  page: { paddingHorizontal: 20, paddingTop: 16 },
  panel: {
    backgroundColor: L.surface1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: L.hairline,
    padding: 20,
    minHeight: 300,
    justifyContent: "center",
    overflow: "hidden",
  },
  // Linear's faint white highlight on the top edge of lifted panels
  panelEdge: { position: "absolute", top: 0, left: 24, right: 24, height: 1, backgroundColor: "rgba(255,255,255,0.08)" },
  copy: { marginTop: 32, gap: 12 },
  title: { color: L.ink, fontSize: 36, fontWeight: "600", letterSpacing: -1.0, lineHeight: 41 },
  body: { color: L.inkMuted, fontSize: 17, lineHeight: 25, letterSpacing: -0.1, maxWidth: 360 },

  footer: { paddingHorizontal: 20, gap: 20 },
  dots: { flexDirection: "row", gap: 6, alignItems: "center" },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: L.hairlineStrong },
  dotActive: { width: 20, backgroundColor: L.primary },
  cta: { height: 48, borderRadius: 8, backgroundColor: L.primary, alignItems: "center", justifyContent: "center" },
  ctaText: { color: "#ffffff", fontSize: 16, fontWeight: "500" },

  pitch: { height: 260, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: L.hairline },
  pitchCircle: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 90,
    height: 90,
    marginLeft: -45,
    marginTop: -45,
    borderRadius: 45,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  pitchSlot: { position: "absolute", width: 70, marginLeft: -35, marginTop: -30, alignItems: "center", gap: 4 },
  blank: { width: 44, height: 6, borderRadius: 3, backgroundColor: "rgba(247,248,248,0.85)" },

  codeRow: { flexDirection: "row", gap: 8, justifyContent: "center", marginBottom: 8 },
  codeCell: { width: 44, height: 52, borderRadius: 8, backgroundColor: L.surface2, borderWidth: 1, borderColor: L.hairlineStrong, alignItems: "center", justifyContent: "center" },
  codeText: { color: L.ink, fontSize: 24, fontWeight: "600", letterSpacing: -0.4 },
  playerRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: L.surface2, borderRadius: 12, borderWidth: 1, borderColor: L.hairline, padding: 12 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: L.surface3, borderWidth: 1.5, borderColor: L.hairlineStrong, alignItems: "center", justifyContent: "center" },
  avatarText: { color: L.ink, fontSize: 14, fontWeight: "600" },
  playerName: { color: L.ink, fontSize: 15, fontWeight: "500", width: 56 },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: L.surface3, overflow: "hidden" },
  trackFill: { height: "100%", borderRadius: 3 },
  playerScore: { color: L.inkMuted, fontSize: 13, fontWeight: "500", fontVariant: ["tabular-nums"] },
});
