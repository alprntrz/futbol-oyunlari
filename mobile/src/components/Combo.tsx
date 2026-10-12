import { useEffect, useRef, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { questEvent } from "~/lib/quests";
import { play } from "~/lib/sound";
import { F } from "~/lib/theme";

import { Text } from "./Text";

/** Combo colour: green, then amber, blue and purple as the run grows. */
export function comboColor(n: number) {
  return n >= 8 ? "#7C3AED" : n >= 5 ? "#0EA5E9" : n >= 3 ? "#F59E0B" : "#16A34A";
}

/** Milestones that get the full-screen burst. */
const BURSTS = [3, 5, 8, 12, 16, 20];

/**
 * Consecutive right answers. `attempts` and `hits` only ever grow during a game:
 * a new attempt with a new hit extends the run, a new attempt without one ends it.
 * State is adjusted during render (no effect), so a reopened game starts quiet.
 */
export function useCombo(attempts: number, hits: number) {
  const [seen, setSeen] = useState({ attempts, hits });
  const [combo, setCombo] = useState(0);
  const [best, setBest] = useState(0);
  if (attempts !== seen.attempts || hits !== seen.hits) {
    const gotIt = hits > seen.hits;
    const next = gotIt ? combo + (hits - seen.hits) : attempts > seen.attempts ? 0 : combo;
    setSeen({ attempts, hits });
    setCombo(next);
    if (next > best) setBest(next);
  }
  useEffect(() => {
    if (combo >= 2) questEvent("combo", combo);
  }, [combo]);
  return { combo, best };
}

/** "COMBO x4" chip that pops on every step and takes the combo colour. */
export function ComboChip({ combo }: { combo: number }) {
  const { t } = useI18n();
  const scale = useSharedValue(1);
  useEffect(() => {
    if (combo < 2) return;
    scale.set(withSequence(withTiming(1.25, { duration: 110 }), withSpring(1, { damping: 9, stiffness: 260 })));
  }, [combo, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }], opacity: combo >= 2 ? 1 : 0 }));
  return (
    <Animated.View style={[styles.chip, { backgroundColor: comboColor(combo) }, style]}>
      <Text allowFontScaling={false} style={styles.chipText}>
        {t("comboLabel")} x{Math.max(combo, 2)}
      </Text>
    </Animated.View>
  );
}

/**
 * Full-screen flash at combo milestones: two light streaks slash across, the
 * number slams in and fades. Never blocks touches.
 */
/** `hold`: something covers the screen (a sheet); the burst waits for it to go. */
export function ComboBurst({ combo, hold = false }: { combo: number; hold?: boolean }) {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const [shown, setShown] = useState<number | null>(null);
  const last = useRef(0);

  const streak = useSharedValue(0);
  const text = useSharedValue(0);

  useEffect(() => {
    if (combo < last.current) last.current = 0;
    if (hold || !BURSTS.includes(combo) || combo === last.current) return;
    last.current = combo;
    setShown(combo);
    haptic.success();
    play("whoosh");
    streak.set(0);
    streak.set(withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));
    text.set(0);
    text.set(withSequence(withSpring(1, { damping: 8, stiffness: 220 }), withDelay(520, withTiming(2, { duration: 260 }))));
    const id = setTimeout(() => setShown(null), 1150);
    return () => clearTimeout(id);
  }, [combo, hold, streak, text]);

  const color = comboColor(shown ?? 0);
  const streakA = useAnimatedStyle(() => ({
    opacity: 1 - streak.get(),
    transform: [{ translateX: -width + streak.get() * width * 2 }, { rotate: "-24deg" }],
  }));
  const streakB = useAnimatedStyle(() => ({
    opacity: 1 - streak.get(),
    transform: [{ translateX: width - streak.get() * width * 2 }, { rotate: "-24deg" }],
  }));
  const label = useAnimatedStyle(() => {
    const v = text.get();
    const s = v <= 1 ? 0.4 + v * 0.6 : 1 + (v - 1) * 0.15;
    return { opacity: v <= 1 ? Math.min(1, v * 1.5) : 2 - v, transform: [{ scale: s }, { rotate: "-6deg" }] };
  });

  if (shown === null || reduce) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.burst]}>
      <Animated.View style={[styles.streak, { top: height * 0.32, width: width * 1.6, backgroundColor: color }, streakA]} />
      <Animated.View style={[styles.streak, { top: height * 0.46, width: width * 1.6, height: 26, backgroundColor: color }, streakB]} />
      <Animated.View style={[styles.labelWrap, label]}>
        <Text allowFontScaling={false} style={[styles.big, { color, textShadowColor: "rgba(0,0,0,0.25)" }]}>
          {t("comboLabel")} x{shown}!
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  chipText: { fontFamily: F.display, fontSize: 14, color: "white", letterSpacing: 0.5 },
  burst: { zIndex: 50, alignItems: "center", justifyContent: "center" },
  streak: { position: "absolute", left: 0, height: 54, borderRadius: 27 },
  labelWrap: { position: "absolute" },
  big: { fontFamily: F.black, fontSize: 64, textShadowRadius: 8, textShadowOffset: { width: 0, height: 4 } },
});
