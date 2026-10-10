import { memo } from "react";
import { StyleSheet } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import Svg, { Defs, G, Line, LinearGradient, Path, Rect, Stop } from "react-native-svg";

import { NIGHT } from "./StadiumHeader";

const W = 400;
const H = 900;
const BANDS = 12;

/** Seeded short blades, so the texture is the same on every render. */
const BLADES = (() => {
  let s = 11;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: 420 }, () => {
    const x = r() * W;
    const y = r() * H;
    const lean = (r() - 0.5) * 4;
    return { d: `M${x.toFixed(1)} ${y.toFixed(1)} l${lean.toFixed(1)} ${(-4 - r() * 5).toFixed(1)}`, light: r() < 0.5 };
  });
})();

/**
 * A mown pitch under the quiz: wide stripes, a few faint blades and the halfway
 * markings, all at a few percent opacity so the cards stay the thing you read.
 */
export const GrassPattern = memo(function GrassPattern() {
  return (
    <Animated.View entering={FadeIn.duration(600)} exiting={FadeOut.duration(300)} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <Defs>
          {/* stripes fade out towards the bottom, like light falling off the pitch */}
          <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={NIGHT.grass} stopOpacity="1" />
            <Stop offset="1" stopColor={NIGHT.grass} stopOpacity="0.45" />
          </LinearGradient>
        </Defs>
        {Array.from({ length: BANDS }, (_, i) =>
          i % 2 ? <Rect key={i} x={0} y={(i * H) / BANDS} width={W} height={H / BANDS} fill="url(#fade)" opacity={0.035} /> : null
        )}
        {/* on the light pitch the blades are mid-green and fainter, or they read as scratches */}
        <G opacity={NIGHT.light ? 0.05 : 0.07}>
          {BLADES.map((b, i) => (
            <Path key={i} d={b.d} stroke={NIGHT.light ? NIGHT.grass : b.light ? "#B8F5C8" : "#03140A"} strokeWidth={1} strokeLinecap="round" />
          ))}
        </G>
        {/* halfway line and centre circle, barely there */}
        <G opacity={0.05} stroke={NIGHT.grass} strokeWidth={2} fill="none">
          <Line x1={0} y1={H * 0.62} x2={W} y2={H * 0.62} />
          <Path d={`M${W / 2 - 70} ${H * 0.62} a70 70 0 1 0 140 0 a70 70 0 1 0 -140 0`} />
        </G>
      </Svg>
    </Animated.View>
  );
});
