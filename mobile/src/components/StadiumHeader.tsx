import { useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { memo, useCallback, useEffect, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";

import { F } from "~/lib/theme";

import { Text } from "./Text";

/**
 * Light status bar while a night screen is in front. A mounted <StatusBar> wins over
 * the app's dark one, so it's only rendered while focused (screens behind stay mounted).
 */
export function NightStatusBar() {
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, [])
  );
  return focused ? <StatusBar style="light" /> : null;
}

/** Night-match palette shared by the immersive game screens. */
export const NIGHT = {
  sky: "#04190E",
  skyLow: "#0A3420",
  stand: "#0E4A2B",
  standLine: "rgba(255,255,255,0.07)",
  body: "#0F5132",
  bodyLow: "#0A3A24",
  track: "#FFFFFF",
  accent: "#22D3EE",
  /** kit for figures drawn on the green: white shirt, navy shorts */
  kit: { shirt: "#FFFFFF", shorts: "#1E3A8A" },
};

const VB_W = 400;
const VB_H = 170;

/** Seeded dots for the crowd so the silhouette doesn't change between renders. */
const CROWD = (() => {
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const dots: { x: number; y: number; o: number }[] = [];
  for (let i = 0; i < 260; i++) {
    const x = r() * VB_W;
    const y = 58 + r() * 70;
    if (y < standTop(x) + 4) continue;
    dots.push({ x, y, o: 0.05 + r() * 0.12 });
  }
  return dots;
})();

/** Top edge of the stands: a shallow bowl, higher at the corners like the far end of a ground. */
function standTop(x: number) {
  const t = x / VB_W - 0.5;
  return 62 + 30 * (1 - 4 * t * t) * 0.6;
}

/**
 * The race line across the header: low on the left, a dip, then climbing to the
 * right. t in 0..1 → point in viewBox units. Also used by the avatars (worklet).
 */
export function trackPoint(t: number) {
  "worklet";
  const x = t * VB_W;
  const y = 128 + 14 * Math.sin(Math.PI * t * 1.4) - 78 * t * t;
  return { x, y };
}

const TRACK_D = (() => {
  const pts = Array.from({ length: 48 }, (_, i) => trackPoint(i / 47));
  return pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
})();

/** Floodlight mast with a lit panel and a soft glow. */
function Floodlight({ x }: { x: number }) {
  return (
    <G>
      <Circle cx={x} cy={18} r={46} fill="url(#glow)" />
      <Line x1={x} y1={22} x2={x} y2={90} stroke="#0B3A22" strokeWidth={3} />
      <Rect x={x - 13} y={10} width={26} height={13} rx={2} fill="#F7FBE8" opacity={0.92} />
      {[0, 1, 2].map((i) => (
        <Line key={i} x1={x - 13 + 6.5 * (i + 1)} y1={10} x2={x - 13 + 6.5 * (i + 1)} y2={23} stroke="#C8D9C0" strokeWidth={0.8} />
      ))}
    </G>
  );
}

/** Inside-the-ground silhouette: night sky, floodlights, roof, tiers of stands and crowd. */
const Silhouette = memo(function Silhouette({ track }: { track: boolean }) {
  const roof = Array.from({ length: 41 }, (_, i) => {
    const x = (i / 40) * VB_W;
    return `${i ? "L" : "M"}${x.toFixed(1)} ${(standTop(x) - 16).toFixed(1)}`;
  }).join(" ");
  const tierTop = Array.from({ length: 41 }, (_, i) => {
    const x = (i / 40) * VB_W;
    return `L${x.toFixed(1)} ${standTop(x).toFixed(1)}`;
  }).join(" ");

  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`}>
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={NIGHT.sky} />
          <Stop offset="1" stopColor={NIGHT.skyLow} />
        </LinearGradient>
        <RadialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#F4FFD8" stopOpacity="0.55" />
          <Stop offset="1" stopColor="#F4FFD8" stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id="below" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={NIGHT.body} />
          <Stop offset="1" stopColor={NIGHT.body} />
        </LinearGradient>
      </Defs>
      <Rect width={VB_W} height={VB_H} fill="url(#sky)" />
      <Floodlight x={46} />
      <Floodlight x={354} />
      {/* roof edge with its supports */}
      <Path d={roof} stroke="#0C3D24" strokeWidth={4} fill="none" />
      {Array.from({ length: 9 }, (_, i) => {
        const x = 20 + i * 45;
        return <Line key={i} x1={x} y1={standTop(x) - 16} x2={x} y2={standTop(x)} stroke="#0C3D24" strokeWidth={1.5} />;
      })}
      {/* stands */}
      <Path d={`M0 ${VB_H} ${tierTop} L${VB_W} ${VB_H} Z`} fill={NIGHT.stand} />
      {[14, 28, 42].map((dy) => (
        <Path
          key={dy}
          d={Array.from({ length: 41 }, (_, i) => {
            const x = (i / 40) * VB_W;
            return `${i ? "L" : "M"}${x.toFixed(1)} ${(standTop(x) + dy).toFixed(1)}`;
          }).join(" ")}
          stroke={NIGHT.standLine}
          strokeWidth={1.2}
          fill="none"
        />
      ))}
      {CROWD.map((d, i) => (
        <Circle key={i} cx={d.x} cy={d.y} r={1.3} fill="#FFFFFF" opacity={d.o} />
      ))}
      {/* under the race line the screen's own colour takes over */}
      {track && (
        <>
          <Path d={`${TRACK_D} L${VB_W} ${VB_H} L0 ${VB_H} Z`} fill="url(#below)" />
          <Path d={TRACK_D} stroke={NIGHT.track} strokeWidth={4} strokeLinecap="round" fill="none" />
        </>
      )}
    </Svg>
  );
});

export interface Runner {
  id: string;
  name: string;
  color: string;
  /** 0..1 along the track */
  progress: number;
  label?: string;
  me?: boolean;
}

/**
 * The header band: stadium silhouette, plus (when given runners) the race line
 * with each player's avatar riding it by score.
 */
export function StadiumHeader({ runners, height = 170 }: { runners?: Runner[]; height?: number }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const h = height + insets.top;
  // the drawing spans the full width and sits on the bottom edge; sky fills what's above
  const scale = width / VB_W;
  const offX = 0;
  const offY = h - VB_H * scale;

  return (
    <View style={[styles.wrap, { height: h, backgroundColor: NIGHT.sky }]} pointerEvents="none">
      <View style={{ position: "absolute", left: 0, right: 0, top: offY, height: VB_H * scale }}>
        <Silhouette track={!!runners} />
      </View>
      {runners?.map((r, i) => (
        <RunnerDot
          key={r.id}
          runner={r}
          scale={scale}
          offX={offX}
          offY={offY}
          stack={runners.filter((o, k) => k < i && Math.abs(o.progress - r.progress) < 0.04).length}
          // in a pile only the top face carries the score
          covered={runners.some((o, k) => k > i && Math.abs(o.progress - r.progress) < 0.04)}
        />
      ))}
    </View>
  );
}

const DOT = 30;

/** Keep the faces clear of the screen edges. */
const along = (p: number) => {
  "worklet";
  return 0.05 + p * 0.88;
};

function RunnerDot({ runner, scale, offX, offY, stack, covered }: { runner: Runner; scale: number; offX: number; offY: number; stack: number; covered: boolean }) {
  const t = useSharedValue(runner.progress);
  useEffect(() => {
    t.set(withTiming(runner.progress, { duration: 900, easing: Easing.inOut(Easing.cubic) }));
  }, [runner.progress, t]);

  const style = useAnimatedStyle(() => {
    const p = trackPoint(along(t.get()));
    // players on the same spot fan out a little so every face shows
    return { transform: [{ translateX: offX + p.x * scale - DOT / 2 + stack * 9 }, { translateY: offY + p.y * scale - DOT + 4 - stack * 3 }] };
  });

  return (
    <Animated.View style={[styles.runner, style, runner.me && { zIndex: 5 }]}>
      <View style={[styles.dot, { backgroundColor: runner.color }, runner.me && styles.dotMe]}>
        <Text allowFontScaling={false} style={styles.dotText}>
          {(runner.name.trim()[0] ?? "?").toUpperCase()}
        </Text>
      </View>
      {runner.label && !covered ? (
        <Text allowFontScaling={false} style={styles.label}>
          {runner.label}
        </Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", top: 0, left: 0, right: 0, overflow: "hidden" },
  runner: { position: "absolute", left: 0, top: 0, width: DOT, alignItems: "center" },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, borderWidth: 2, borderColor: "white", alignItems: "center", justifyContent: "center" },
  dotMe: { borderColor: NIGHT.accent, borderWidth: 3 },
  dotText: { color: "white", fontWeight: "800", fontSize: 13 },
  label: { marginTop: 1, fontFamily: F.display, fontSize: 13, color: "#BFF6FF", textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 3 },
});
