import { memo } from "react";
import { StyleSheet } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import Svg, { Circle, G, Line, Path } from "react-native-svg";

import { NIGHT } from "./StadiumHeader";

const W = 400;
const H = 900;

/**
 * The pitch under the quiz: one plain colour (the screen's own) with the halfway
 * line, centre circle and spot drawn faintly, so the cards stay the thing you read.
 */
export const GrassPattern = memo(function GrassPattern() {
  return (
    <Animated.View entering={FadeIn.duration(600)} exiting={FadeOut.duration(300)} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <G opacity={0.08} stroke={NIGHT.grass} strokeWidth={2} fill="none">
          <Line x1={0} y1={H * 0.62} x2={W} y2={H * 0.62} />
          <Path d={`M${W / 2 - 70} ${H * 0.62} a70 70 0 1 0 140 0 a70 70 0 1 0 -140 0`} />
          <Circle cx={W / 2} cy={H * 0.62} r={3} fill={NIGHT.grass} />
        </G>
      </Svg>
    </Animated.View>
  );
});
