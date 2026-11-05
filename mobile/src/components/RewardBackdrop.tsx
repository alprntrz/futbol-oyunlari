import { StyleSheet, useWindowDimensions } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

/**
 * Behind the end-of-game screens: a soft glow drawn at screen resolution. The old background was
 * a 256 px bitmap tile, stretched about 3× on a phone, so it always looked blurred.
 */
export function RewardBackdrop({ color, glow }: { color: string; glow: string }) {
  const { width, height } = useWindowDimensions();
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="reward-glow" cx="50%" cy="30%" rx="80%" ry="55%">
          <Stop offset="0" stopColor={glow} />
          <Stop offset="1" stopColor={color} />
        </RadialGradient>
      </Defs>
      <Rect width={width} height={height} fill="url(#reward-glow)" />
    </Svg>
  );
}
