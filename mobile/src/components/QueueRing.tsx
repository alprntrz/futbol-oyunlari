import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import { F } from "~/lib/theme";

import { Text } from "./Text";

const ACircle = Animated.createAnimatedComponent(Circle);

export interface RingSeat {
  key: string;
  /** the avatar (or an empty seat) to place around the ring */
  node: React.ReactNode;
}

/**
 * Matchmaking ring, after the reference game's "match found" screen: the seconds
 * spent searching count up in the middle while the arc fills towards the start,
 * "3/5" under it, and the seats spread around the ring. `endsAt` is a local time
 * (ms) when the room starts anyway; null = no clock.
 */
export function QueueRing({
  endsAt,
  totalMs,
  filled,
  max,
  seats,
  size = 300,
  color,
  track,
  ink,
}: {
  endsAt: number | null;
  totalMs: number;
  filled: number;
  max: number;
  seats: RingSeat[];
  size?: number;
  color: string;
  track: string;
  ink: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endsAt]);

  const ring = size * 0.48;
  const stroke = 10;
  const r = (ring - stroke) / 2;
  const len = 2 * Math.PI * r;
  const left = endsAt ? Math.max(0, endsAt - now) : 0;

  // the arc fills smoothly until the start time
  const frac = useSharedValue(endsAt ? 1 - left / totalMs : 0);
  useEffect(() => {
    if (!endsAt) return;
    const ms = Math.max(0, endsAt - Date.now());
    frac.set(Math.max(0, 1 - ms / totalMs));
    frac.set(withTiming(1, { duration: ms, easing: Easing.linear }));
  }, [endsAt, totalMs, frac]);
  const arc = useAnimatedProps(() => ({ strokeDashoffset: len * (1 - frac.get()) }));

  // seats on a circle around the ring, starting at the top
  const orbit = size / 2 - 40;
  return (
    <View style={{ width: size, height: size + 24 }}>
      <View style={[styles.center, { left: (size - ring) / 2, top: (size - ring) / 2, width: ring, height: ring }]}>
        <Svg width={ring} height={ring} style={StyleSheet.absoluteFill}>
          <Circle cx={ring / 2} cy={ring / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
          <ACircle
            cx={ring / 2}
            cy={ring / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${len} ${len}`}
            animatedProps={arc}
            transform={`rotate(-90 ${ring / 2} ${ring / 2})`}
          />
        </Svg>
        <Text allowFontScaling={false} style={[styles.count, { color: ink, fontSize: ring * 0.3 }]}>
          {endsAt ? Math.min(Math.round(totalMs / 1000), Math.floor((totalMs - left) / 1000)) : "…"}
        </Text>
        <Text allowFontScaling={false} style={[styles.filled, { color: ink }]}>
          {filled}/{max}
        </Text>
      </View>
      {seats.map((s, i) => {
        const a = -Math.PI / 2 + (i / seats.length) * Math.PI * 2;
        return (
          <View key={s.key} style={[styles.seat, { left: size / 2 + Math.cos(a) * orbit - 31, top: size / 2 + Math.sin(a) * orbit - 31 }]}>
            {s.node}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { position: "absolute", alignItems: "center", justifyContent: "center" },
  count: { fontFamily: F.black, lineHeight: undefined },
  filled: { fontFamily: F.display, fontSize: 16, marginTop: -4, opacity: 0.8 },
  seat: { position: "absolute", width: 62, height: 62, alignItems: "center", justifyContent: "center" },
});
