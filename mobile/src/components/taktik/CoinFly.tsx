import { useEffect } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";

import { TAKTIK } from "~/lib/brand";
import { haptic } from "~/lib/haptics";
import { play } from "~/lib/sound";

const SIZE = 34;
/** each coin: pops in the middle, waits a beat, then glides to the gold counter */
const POP_MS = 220;
const HOLD_MS = 380;
const FLY_MS = 620;
const GAP_MS = 110;
/** how long the whole flight takes for `n` coins */
export const coinFlyMs = (n: number) => POP_MS + HOLD_MS + FLY_MS + GAP_MS * Math.max(0, n - 1);

/**
 * Gold just won, shown as coins: they appear in the middle of the screen side by
 * side and fly one after another into the gold counter at `to` (window coordinates).
 * `onLand(i)` fires as each one arrives.
 */
export function CoinFly({ count, to, onLand }: { count: number; to: { x: number; y: number }; onLand: (i: number) => void }) {
  const { width, height } = useWindowDimensions();
  const n = Math.min(count, 8);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: n }, (_, i) => (
        <Coin key={i} i={i} from={{ x: width / 2 + (i - (n - 1) / 2) * (SIZE * 0.9), y: height * 0.46 }} to={to} onLand={() => onLand(i)} />
      ))}
    </View>
  );
}

function Coin({ i, from, to, onLand }: { i: number; from: { x: number; y: number }; to: { x: number; y: number }; onLand: () => void }) {
  const x = useSharedValue(from.x);
  const y = useSharedValue(from.y);
  const s = useSharedValue(0);
  const o = useSharedValue(1);

  useEffect(() => {
    const start = POP_MS + HOLD_MS + i * GAP_MS;
    const ease = Easing.inOut(Easing.cubic);
    s.set(withSequence(withDelay(i * 40, withTiming(1, { duration: POP_MS, easing: Easing.out(Easing.quad) })), withDelay(start - POP_MS - i * 40, withTiming(0.6, { duration: FLY_MS, easing: ease }))));
    x.set(withDelay(start, withTiming(to.x, { duration: FLY_MS, easing: ease })));
    y.set(withDelay(start, withTiming(to.y, { duration: FLY_MS, easing: ease })));
    o.set(withDelay(start + FLY_MS - 60, withTiming(0, { duration: 80 })));
    if (i === 0) play("coin");
    const id = setTimeout(() => {
      haptic.tap();
      onLand();
    }, start + FLY_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: o.get(), transform: [{ translateX: x.get() - SIZE / 2 }, { translateY: y.get() - SIZE / 2 }, { scale: s.get() }] }));
  return <Animated.Image source={TAKTIK.ui.coin} style={[styles.coin, style]} />;
}

const styles = StyleSheet.create({
  coin: { position: "absolute", left: 0, top: 0, width: SIZE, height: SIZE },
});
