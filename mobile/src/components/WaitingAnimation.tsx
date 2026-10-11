import { useEffect } from "react";
import { Image, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import Svg, { Line } from "react-native-svg";

import { BRAND } from "~/lib/brand";

// Coordinates on the original 1536×1024 illustration (scripts/brand-assets.py):
// the ball is thrown from the purple phone's screen to the green one along the
// dotted arc (quadratic Bézier; passes through the arc's peak at t = 0.5).
const W = 1536;
const H = 1024;
const FROM = { x: 398, y: 560 };
const CTRL = { x: 882, y: 12 };
const TO = { x: 1190, y: 585 };
const BALL = 244;

const point = (p: number) => {
  const u = 1 - p;
  return { x: u * u * FROM.x + 2 * u * p * CTRL.x + p * p * TO.x, y: u * u * FROM.y + 2 * u * p * CTRL.y + p * p * TO.y };
};
// The ball sat on top of the dotted arc; refill the dashes it covered.
const GAP_DASHES = [0.41, 0.5, 0.59].map((p) => {
  const a = point(p - 0.012);
  const b = point(p + 0.012);
  return { a, b };
});

/** Two phones passing a football back and forth while the room waits. */
export function WaitingAnimation({ width = 260 }: { width?: number }) {
  const k = width / W;
  const size = BALL * k * 0.8;
  const t = useSharedValue(0);

  useEffect(() => {
    t.set(withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [t]);

  const ballStyle = useAnimatedStyle(() => {
    const p = t.get();
    const u = 1 - p;
    const x = u * u * FROM.x + 2 * u * p * CTRL.x + p * p * TO.x;
    const y = u * u * FROM.y + 2 * u * p * CTRL.y + p * p * TO.y;
    return {
      transform: [{ translateX: x * k - size / 2 }, { translateY: y * k - size / 2 }, { rotate: `${p * 540}deg` }],
    };
  });

  return (
    <View style={{ width, height: H * k }}>
      <Image source={BRAND.illus.waitingRoom} style={{ width, height: H * k }} />
      <Svg width={width} height={H * k} style={{ position: "absolute" }} viewBox={`0 0 ${W} ${H}`}>
        {GAP_DASHES.map(({ a, b }, i) => (
          <Line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#1FB45A" strokeWidth={34} strokeLinecap="round" />
        ))}
      </Svg>
      <Animated.Image source={BRAND.illus.waitingBall} style={[{ position: "absolute", left: 0, top: 0, width: size, height: size }, ballStyle]} />
    </View>
  );
}
