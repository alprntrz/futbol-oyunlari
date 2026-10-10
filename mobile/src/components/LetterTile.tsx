import { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";

import type { TileMark } from "@/lib/types";

import { C, F } from "~/lib/theme";

const MARK_BG: Record<TileMark, string> = { correct: C.tileCorrect, present: C.tilePresent, absent: C.tileAbsent };

/** Per-tile flip timing (ms); the board waits for the flip before closing the sheet. */
export const FLIP_STAGGER = 110;
export const FLIP_DURATION = 360;

export function Tile({
  ch,
  mark,
  size,
  hint,
  flipIndex,
  dark,
}: {
  ch: string;
  mark?: TileMark;
  size: number;
  hint?: boolean;
  flipIndex?: number;
  /** empty tile on a dark surface (onboarding) */
  dark?: boolean;
}) {
  const flipping = mark !== undefined && flipIndex !== undefined;
  // 0 → 0.5: tile folds shut showing the typed letter; 0.5 → 1: opens again coloured
  const p = useSharedValue(flipping ? 0 : 1);
  const pop = useSharedValue(1);
  // Letter colour switches while the tile is folded shut (plain Text: Animated.Text
  // dropped narrow glyphs like "I" with the custom font)
  const [shut, setShut] = useState(flipping);

  useEffect(() => {
    if (!flipping) return;
    p.set(withDelay(flipIndex * FLIP_STAGGER, withTiming(1, { duration: FLIP_DURATION, easing: Easing.inOut(Easing.quad) })));
    const timer = setTimeout(() => setShut(false), flipIndex * FLIP_STAGGER + FLIP_DURATION / 2);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Typing a letter makes the empty tile pop
  useEffect(() => {
    if (!mark && ch && !hint) pop.set(withSequence(withTiming(1.12, { duration: 70 }), withTiming(1, { duration: 90 })));
  }, [ch, mark, hint, pop]);

  const blank = dark ? "#141516" : C.card;
  const markBg = mark ? MARK_BG[mark] : blank;
  const box = useAnimatedStyle(() => {
    const v = p.get();
    const coloured = v >= 0.5;
    return {
      backgroundColor: coloured ? markBg : blank,
      borderColor: coloured && mark ? markBg : dark ? (ch ? "#62666d" : "#34343a") : ch ? "#8F9A93" : "#D3DBD5",
      // Flip as a vertical squash (2D): 3D rotateX left tiles half-clipped on iOS
      transform: [{ scale: pop.get() }, { scaleY: Math.max(0.02, Math.abs(1 - 2 * v)) }],
    };
  });
  const color = mark && !shut ? "white" : hint ? C.text3 : dark ? "#f7f8f8" : C.text;

  return (
    <Animated.View style={[styles.tile, { width: size, height: size }, box]}>
      <Text style={{ fontFamily: F.display, fontSize: Math.round(size * 0.62), color, minWidth: 8, textAlign: "center" }}>{ch}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: { borderWidth: 2, borderRadius: 8, alignItems: "center", justifyContent: "center" },
});
