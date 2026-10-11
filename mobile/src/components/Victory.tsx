import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Image, ImageBackground, Modal, StyleSheet, View, type ImageSourcePropType } from "react-native";
import Animated, { Easing, FadeIn, Keyframe, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { REWARD } from "~/lib/brand";
import { haptic } from "~/lib/haptics";
import { play } from "~/lib/sound";
import { C, F } from "~/lib/theme";
import { setOverlayOpen } from "~/lib/xp";

import { Confetti, useCountUp } from "./motion";
import { Text } from "./Text";
import { Button } from "./ui";

export interface Reward {
  image: ImageSourcePropType;
  /** shown counting up when it's a number */
  value: number | string;
  prefix?: string;
  label: string;
}

// the app's own greens: a win on the pitch green, anything else on the deep green
const PITCH = C.greenMid;
const PITCH_DEEP = "#0B3A1F";
const RIBBON_W = 290;
const RIBBON_H = RIBBON_W * (172 / 900);
const INK = "#5B3A06";

// the ceremony's beats, in ms from opening
const T_TITLE = 0;
const T_MEDAL = 280;
const T_PANEL = 620;
const T_CARD = 780;
const CARD_STEP = 180;

/** Title stamps in: big, slight overshoot, settles. */
const STAMP = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 1.7 }] },
  60: { opacity: 1, transform: [{ scale: 0.94 }] },
  100: { opacity: 1, transform: [{ scale: 1 }] },
}).duration(420);

const MEDAL_IN = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.4 }, { rotate: "-12deg" }] },
  65: { opacity: 1, transform: [{ scale: 1.08 }, { rotate: "3deg" }] },
  100: { opacity: 1, transform: [{ scale: 1 }, { rotate: "0deg" }] },
})
  .delay(T_MEDAL)
  .duration(480);

const CARD_IN = (i: number) =>
  new Keyframe({
    0: { opacity: 0, transform: [{ translateY: 26 }, { scale: 0.8 }] },
    70: { opacity: 1, transform: [{ translateY: -4 }, { scale: 1.05 }] },
    100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
  })
    .delay(T_CARD + i * CARD_STEP)
    .duration(360);

function Count({ value, prefix = "", delay }: { value: number | string; prefix?: string; delay: number }) {
  const [target, setTarget] = useState(0);
  useEffect(() => {
    if (typeof value !== "number") return;
    const id = setTimeout(() => setTarget(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  const shown = useCountUp(target, 650);
  return (
    <Text allowFontScaling={false} style={styles.rewardValue}>
      {typeof value === "number" ? `${prefix}${shown}` : value}
    </Text>
  );
}

/** The medal in its laurel, with a slow glint behind once it has landed. */
function Medal({ won, kind, value }: { won: boolean; kind: "trophy" | "level"; value: number | string }) {
  const glow = useSharedValue(0);
  useEffect(() => {
    glow.set(withDelay(T_MEDAL + 500, withRepeat(withSequence(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 1200 })), -1)));
  }, [glow]);
  const halo = useAnimatedStyle(() => ({ opacity: 0.18 + glow.get() * 0.3, transform: [{ scale: 1 + glow.get() * 0.08 }] }));

  return (
    <Animated.View entering={MEDAL_IN} style={styles.medalWrap}>
      {won && <Animated.View style={[styles.halo, halo]} />}
      <Image source={won ? REWARD.laurelGold : REWARD.laurelSilver} style={styles.laurel} resizeMode="contain" />
      <View style={styles.medal}>
        <Image source={kind === "level" ? REWARD.levelBadge : REWARD.medal} style={styles.medalImage} resizeMode="contain" />
        <Text allowFontScaling={false} style={[styles.medalText, kind === "level" && { marginTop: 10 }]}>
          {value}
        </Text>
        {kind === "trophy" && <Image source={REWARD.trophy} style={styles.medalTrophy} resizeMode="contain" />}
      </View>
    </Animated.View>
  );
}

/**
 * End-of-match ceremony: stamped title, a medal in a laurel, then the match's
 * rewards popping in one by one on a cream panel, with sounds on each beat.
 */
export function Victory({
  visible,
  won,
  title,
  subtitle,
  medal,
  medalKind = "trophy",
  panelTitle,
  rewards,
  primary,
  secondary,
}: {
  visible: boolean;
  won: boolean;
  title: string;
  /** small line under the title (e.g. "Level up") */
  subtitle?: string;
  /** big number on the medal (trophies won, or the level) */
  medal: number | string;
  medalKind?: "trophy" | "level";
  panelTitle: string;
  rewards: Reward[];
  primary: { title: string; icon?: Parameters<typeof Button>[0]["icon"]; onPress: () => void };
  secondary?: { title: string; onPress: () => void };
}) {
  const insets = useSafeAreaInsets();

  // the "+XP" toast waits under this modal until it closes
  useEffect(() => {
    setOverlayOpen(visible);
    return () => setOverlayOpen(false);
  }, [visible]);

  // confetti fires each time a won ceremony opens
  const [fire, setFire] = useState(0);
  const [prevVisible, setPrevVisible] = useState(false);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible && won) setFire((f) => f + 1);
  }

  // the sound track follows the animation's beats
  useEffect(() => {
    if (!visible) return;
    const at = (ms: number, fn: () => void) => setTimeout(fn, ms);
    const timers = [
      at(T_TITLE + 120, () => play("stamp")),
      at(T_MEDAL + 150, () => {
        play(won ? "victory" : "lose");
        if (won) haptic.success();
        else haptic.warning();
      }),
      at(T_PANEL, () => play("whoosh")),
      ...rewards.map((_, i) => at(T_CARD + i * CARD_STEP + 120, () => play("pop"))),
      at(T_CARD + rewards.length * CARD_STEP + 250, () => play("coin")),
    ];
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={secondary?.onPress ?? primary.onPress}>
      <ImageBackground
        source={REWARD.stars}
        resizeMode="repeat"
        imageStyle={{ opacity: won ? 1 : 0.6 }}
        style={[styles.screen, { backgroundColor: won ? PITCH : C.greenDark, paddingTop: insets.top + 18, paddingBottom: insets.bottom + 20 }]}
      >
        <StatusBar style="light" />

        <Animated.View entering={STAMP} style={{ alignItems: "center" }}>
          <Text allowFontScaling={false} style={styles.title} adjustsFontSizeToFit numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </Animated.View>

        <Medal won={won} kind={medalKind} value={medal} />

        <Animated.View entering={FadeIn.delay(T_PANEL).duration(260)} style={styles.panelWrap}>
          <ImageBackground source={REWARD.panel} resizeMode="stretch" capInsets={{ top: 60, left: 60, bottom: 60, right: 60 }} style={styles.panel}>
            <View style={styles.cards}>
              {rewards.map((r, i) => (
                <Animated.View key={r.label} entering={CARD_IN(i)} style={styles.card}>
                  <Image source={r.image} style={styles.cardImage} resizeMode="contain" />
                  <Count value={r.value} prefix={r.prefix} delay={T_CARD + 100 + i * CARD_STEP} />
                  <Text allowFontScaling={false} style={styles.rewardLabel} numberOfLines={2}>
                    {r.label}
                  </Text>
                </Animated.View>
              ))}
            </View>
          </ImageBackground>
          {/* ribbon over the panel's top edge */}
          <View style={styles.ribbon}>
            <Image source={REWARD.ribbon} style={styles.ribbonImage} resizeMode="stretch" />
            {/* the art's band covers the top 68% of the image (its tails hang below) */}
            <View style={styles.ribbonBand}>
              <Text allowFontScaling={false} style={styles.ribbonText} numberOfLines={1} adjustsFontSizeToFit>
                {panelTitle}
              </Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(T_CARD + rewards.length * CARD_STEP + 200).duration(250)} style={styles.actions}>
          <Button title={primary.title} icon={primary.icon} onPress={primary.onPress} style={{ alignSelf: "stretch" }} />
          {secondary && <Button title={secondary.title} kind="secondary" onPress={secondary.onPress} style={{ alignSelf: "stretch" }} />}
        </Animated.View>
      </ImageBackground>
      <Confetti fire={fire} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", paddingHorizontal: 20, gap: 6 },
  title: {
    fontFamily: F.black,
    fontSize: 58,
    lineHeight: 64,
    color: "white",
    textAlign: "center",
    textShadowColor: PITCH_DEEP,
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 0,
    marginTop: 8,
  },
  subtitle: { fontFamily: F.display, fontSize: 20, color: "#FDE68A", marginTop: -2 },
  medalWrap: { width: 250, height: 228, alignItems: "center", justifyContent: "center" },
  halo: { position: "absolute", width: 150, height: 150, borderRadius: 75, backgroundColor: "#FFE58A" },
  laurel: { position: "absolute", top: 0, left: 0, width: 250, height: 228 },
  medal: { width: 116, height: 116, alignItems: "center", justifyContent: "center", marginTop: -8 },
  medalImage: { position: "absolute", top: 0, left: 0, width: 116, height: 116 },
  medalText: { fontFamily: F.black, fontSize: 40, lineHeight: 44, color: INK, marginTop: -10 },
  medalTrophy: { position: "absolute", bottom: 14, width: 26, height: 26 },
  panelWrap: { alignSelf: "stretch", marginTop: 30 },
  panel: { paddingTop: 40, paddingBottom: 22, paddingHorizontal: 18 },
  ribbon: { position: "absolute", top: -RIBBON_H * 0.42, alignSelf: "center", width: RIBBON_W, height: RIBBON_H },
  ribbonImage: { position: "absolute", top: 0, left: 0, width: RIBBON_W, height: RIBBON_H },
  ribbonBand: { position: "absolute", top: 0, left: RIBBON_W * 0.2, right: RIBBON_W * 0.2, height: RIBBON_H * 0.68, alignItems: "center", justifyContent: "center" },
  ribbonText: { fontFamily: F.black, fontSize: 20, lineHeight: 23, color: "white", textShadowColor: PITCH_DEEP, textShadowOffset: { width: 0, height: 1.5 }, textShadowRadius: 0 },
  cards: { flexDirection: "row", gap: 8 },
  card: { flex: 1, alignItems: "center", backgroundColor: "#FBE7B3", borderRadius: 16, paddingVertical: 10, paddingHorizontal: 4, gap: 1 },
  cardImage: { width: 54, height: 54, marginBottom: 2 },
  rewardValue: { fontFamily: F.black, fontSize: 26, lineHeight: 28, color: INK },
  rewardLabel: { fontSize: 12, fontWeight: "700", color: "#8A6417", textAlign: "center" },
  actions: { alignSelf: "stretch", gap: 10, marginTop: "auto" },
});
