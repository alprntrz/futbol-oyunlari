import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";

import { frameById, type FrameId } from "~/lib/cosmetics";

/** An avatar frame: a gradient ring drawn over the circle's edge; the Legend one turns slowly. */
export function FrameRing({ id, size }: { id: FrameId; size: number }) {
  const f = frameById(id);
  const spin = useSharedValue(0);
  const turning = id === "legend";
  useEffect(() => {
    if (turning) spin.set(withRepeat(withTiming(360, { duration: 6000, easing: Easing.linear }), -1));
  }, [turning, spin]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.get()}deg` }] }));
  if (!f || f.colors.length === 0) return null;

  const stroke = Math.max(3, size * 0.075);
  const r = size / 2 - stroke / 2;
  const gid = `frame-${id}`;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, turning && style]} pointerEvents="none">
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            {f.colors.map((c, i) => (
              <Stop key={i} offset={i / (f.colors.length - 1)} stopColor={c} />
            ))}
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={`url(#${gid})`} strokeWidth={stroke} fill="none" />
        {/* a thin light edge inside the ring, for depth */}
        <Circle cx={size / 2} cy={size / 2} r={r - stroke / 2} stroke="rgba(255,255,255,0.5)" strokeWidth={Math.max(1, stroke * 0.15)} fill="none" />
      </Svg>
    </Animated.View>
  );
}
