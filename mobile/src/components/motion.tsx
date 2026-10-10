import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View, type StyleProp, type TextStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { C } from "~/lib/theme";

const CONFETTI_COLORS = [C.green, "#4ADE80", C.amber, "#FDE047", "#FFFFFF", C.blue, C.coral];

function Piece({ seed, width, height }: { seed: number; width: number; height: number }) {
  const rnd = (n: number) => {
    const x = Math.sin(seed * 9301 + n * 49297) * 233280;
    return x - Math.floor(x);
  };
  const startX = rnd(1) * width;
  const drift = (rnd(2) - 0.5) * 120;
  const spin = (rnd(3) - 0.5) * 1440;
  const w = 6 + rnd(4) * 6;
  const h = 10 + rnd(5) * 8;
  const color = CONFETTI_COLORS[Math.floor(rnd(6) * CONFETTI_COLORS.length)];
  const p = useSharedValue(0);

  useEffect(() => {
    p.set(withDelay(rnd(7) * 350, withTiming(1, { duration: 1700 + rnd(8) * 1100, easing: Easing.out(Easing.quad) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => {
    const v = p.get();
    return {
      opacity: v < 0.85 ? 1 : (1 - v) / 0.15,
      transform: [
        { translateX: startX + drift * v + Math.sin(v * 12 + seed) * 14 },
        { translateY: -30 + (height + 60) * v },
        { rotate: `${spin * v}deg` },
        { rotateX: `${v * 720}deg` },
      ],
    };
  });

  return <Animated.View style={[styles.piece, { width: w, height: h, backgroundColor: color }, style]} />;
}

/** One burst of falling confetti over the whole screen; re-fires when `fire` changes. */
export function Confetti({ fire }: { fire: number }) {
  const { width, height } = useWindowDimensions();
  // A burst lives ~3 s; `finished` remembers which burst already ended
  const [finished, setFinished] = useState(0);

  useEffect(() => {
    if (!fire) return;
    const timer = setTimeout(() => setFinished(fire), 3200);
    return () => clearTimeout(timer);
  }, [fire]);

  const active = fire && finished !== fire ? fire : null;
  if (!active) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 10 }]}>
      {Array.from({ length: 70 }, (_, i) => (
        <Piece key={`${active}-${i}`} seed={i + active} width={width} height={height} />
      ))}
    </View>
  );
}

/** Counts up from 0 (or the previous value) to `value`. */
export function useCountUp(value: number, duration = 700) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const start = Date.now();
    const a = from.current;
    let raf = 0;
    const tick = () => {
      const k = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(a + (value - a) * eased));
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return shown;
}

/** Number that pops (scale bounce) whenever it changes. */
export function PopNumber({ value, style }: { value: number | string; style?: StyleProp<TextStyle> }) {
  const scale = useSharedValue(1);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    scale.set(withSequence(withTiming(1.35, { duration: 120 }), withSpring(1, { damping: 7, stiffness: 220 })));
  }, [value, scale]);

  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <Animated.View style={anim}>
      <Text style={style}>{value}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  piece: { position: "absolute", left: 0, top: 0, borderRadius: 2 },
});
