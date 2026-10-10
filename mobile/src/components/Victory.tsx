import type { SymbolViewProps } from "expo-symbols";
import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { Modal, StyleSheet, View } from "react-native";
import Animated, { Easing, FadeIn, Keyframe, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { haptic } from "~/lib/haptics";
import { F } from "~/lib/theme";

import { Confetti, useCountUp } from "./motion";
import { Text } from "./Text";
import { Button, Icon } from "./ui";

export interface Reward {
  icon: SymbolViewProps["name"];
  fallback: string;
  /** shown counting up when it's a number */
  value: number | string;
  prefix?: string;
  label: string;
}

const GOLD = "#F7C531";
const GOLD_DARK = "#B7791F";
const PITCH = "#15803D";
const PITCH_DEEP = "#0E5E2C";
const CREAM = "#FFF6DC";

/** Title stamps in: big, slight overshoot, settles. */
const STAMP = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 1.6 }] },
  60: { opacity: 1, transform: [{ scale: 0.94 }] },
  100: { opacity: 1, transform: [{ scale: 1 }] },
}).duration(420);

const CARD_IN = (i: number) =>
  new Keyframe({
    0: { opacity: 0, transform: [{ translateY: 24 }, { scale: 0.85 }] },
    70: { opacity: 1, transform: [{ translateY: -4 }, { scale: 1.04 }] },
    100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
  })
    .delay(700 + i * 160)
    .duration(360);

function Count({ value, prefix = "", delay }: { value: number | string; prefix?: string; delay: number }) {
  const [target, setTarget] = useState(0);
  useEffect(() => {
    if (typeof value !== "number") return;
    const id = setTimeout(() => setTarget(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  const shown = useCountUp(target, 600);
  return (
    <Text allowFontScaling={false} style={styles.rewardValue}>
      {typeof value === "number" ? `${prefix}${shown}` : value}
    </Text>
  );
}

/** Trophy in a laurel, with a slow glint once it has landed. */
function Laurel({ won, children }: { won: boolean; children: React.ReactNode }) {
  const glow = useSharedValue(0);
  useEffect(() => {
    glow.set(withDelay(500, withRepeat(withSequence(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 1100 })), -1)));
  }, [glow]);
  const halo = useAnimatedStyle(() => ({ opacity: 0.25 + glow.get() * 0.35, transform: [{ scale: 1 + glow.get() * 0.06 }] }));
  const colour = won ? GOLD : "#C9D3CC";
  return (
    <View style={styles.laurelWrap}>
      {won && <Animated.View style={[styles.halo, halo]} />}
      <Icon name="laurel.leading" size={92} color={colour} fallback="❦" />
      <View style={[styles.medal, { borderColor: won ? "#FFE58A" : "#E3E9E5", backgroundColor: won ? GOLD : "#AEBBB2" }]}>{children}</View>
      <Icon name="laurel.trailing" size={92} color={colour} fallback="❦" />
    </View>
  );
}

/**
 * End-of-match ceremony: stamped title, a medal in a laurel, then the match's
 * rewards popping in one by one on a cream panel, and the next step.
 */
export function Victory({
  visible,
  won,
  title,
  medal,
  panelTitle,
  rewards,
  primary,
  secondary,
}: {
  visible: boolean;
  won: boolean;
  title: string;
  /** big number on the medal (e.g. trophies won) */
  medal: number | string;
  panelTitle: string;
  rewards: Reward[];
  primary: { title: string; icon?: SymbolViewProps["name"]; onPress: () => void };
  secondary?: { title: string; onPress: () => void };
}) {
  const insets = useSafeAreaInsets();
  // confetti fires each time a won ceremony opens
  const [fire, setFire] = useState(0);
  const [prevVisible, setPrevVisible] = useState(false);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible && won) setFire((f) => f + 1);
  }
  useEffect(() => {
    if (!visible) return;
    if (won) haptic.success();
    else haptic.warning();
  }, [visible, won]);

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={secondary?.onPress ?? primary.onPress}>
      <View style={[styles.screen, { backgroundColor: won ? PITCH : "#3F5247", paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }]}>
        <StatusBar style="light" />

        <Animated.View entering={STAMP}>
          <Text allowFontScaling={false} style={styles.title} adjustsFontSizeToFit numberOfLines={1}>
            {title}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(250).duration(300)}>
          <Laurel won={won}>
            <Text allowFontScaling={false} style={styles.medalText}>
              {medal}
            </Text>
            <Icon name="trophy.fill" size={18} color={won ? GOLD_DARK : "#6C7A71"} fallback="🏆" />
          </Laurel>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(550).duration(250)} style={styles.panel}>
          <View style={styles.ribbon}>
            <Text allowFontScaling={false} style={styles.ribbonText}>
              {panelTitle}
            </Text>
          </View>
          <View style={styles.cards}>
            {rewards.map((r, i) => (
              <Animated.View key={r.label} entering={CARD_IN(i)} style={styles.card}>
                <View style={styles.cardIcon}>
                  <Icon name={r.icon} size={30} color={GOLD_DARK} fallback={r.fallback} />
                </View>
                <Count value={r.value} prefix={r.prefix} delay={800 + i * 160} />
                <Text allowFontScaling={false} style={styles.rewardLabel} numberOfLines={2}>
                  {r.label}
                </Text>
              </Animated.View>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(900 + rewards.length * 160).duration(250)} style={styles.actions}>
          <Button title={primary.title} icon={primary.icon} onPress={primary.onPress} style={{ alignSelf: "stretch" }} />
          {secondary && <Button title={secondary.title} kind="secondary" onPress={secondary.onPress} style={{ alignSelf: "stretch" }} />}
        </Animated.View>
      </View>
      <Confetti fire={fire} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", paddingHorizontal: 20, gap: 14 },
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
  laurelWrap: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 2, height: 150 },
  halo: { position: "absolute", width: 128, height: 128, borderRadius: 64, backgroundColor: "#FFE58A" },
  medal: { width: 104, height: 104, borderRadius: 52, borderWidth: 5, alignItems: "center", justifyContent: "center" },
  medalText: { fontFamily: F.black, fontSize: 42, lineHeight: 44, color: "#5B3A06" },
  panel: { alignSelf: "stretch", backgroundColor: CREAM, borderRadius: 24, paddingTop: 30, paddingBottom: 18, paddingHorizontal: 12, marginTop: 14, borderWidth: 3, borderColor: "#F3DFA2" },
  ribbon: { position: "absolute", top: -18, alignSelf: "center", backgroundColor: "#22A055", borderRadius: 10, paddingHorizontal: 26, paddingVertical: 6, borderBottomWidth: 4, borderBottomColor: PITCH_DEEP },
  ribbonText: { fontFamily: F.black, fontSize: 20, color: "white" },
  cards: { flexDirection: "row", gap: 10 },
  card: { flex: 1, alignItems: "center", backgroundColor: "#FBE7B3", borderRadius: 16, paddingVertical: 12, paddingHorizontal: 6, gap: 2 },
  cardIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#FFF8E6", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  rewardValue: { fontFamily: F.black, fontSize: 28, lineHeight: 30, color: "#5B3A06" },
  rewardLabel: { fontSize: 13, fontWeight: "700", color: "#8A6417", textAlign: "center" },
  actions: { alignSelf: "stretch", gap: 10, marginTop: "auto" },
});
