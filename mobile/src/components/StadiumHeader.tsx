import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { memo, useCallback, useEffect, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";

import { C, F } from "~/lib/theme";

import { Avatar } from "./Avatar";
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
  return focused ? <StatusBar style={NIGHT.light ? "dark" : "light"} /> : null;
}

/**
 * Back for the headerless night screens. Opened from a link or a notification there
 * may be nothing to go back to: land on the Games tab instead of doing nothing.
 */
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/oyunlar");
}

/** The quiz's stadium in the dark: night match, floodlights on. */
const DARK = {
  light: false,
  sky: "#04190E",
  skyLow: "#0A3420",
  stand: "#0E4A2B",
  standLine: "rgba(255,255,255,0.07)",
  crowd: "#FFFFFF",
  roof: "#0C3D24",
  pole: "#0B3A22",
  glow: "#F4FFD8",
  body: "#0F5132",
  bodyLow: "#0A3A24",
  track: "#FFFFFF",
  accent: "#22D3EE",
  accentSoft: "rgba(34,211,238,0.18)",
  ink: "#FFFFFF",
  ink2: "rgba(255,255,255,0.78)",
  ink3: "rgba(255,255,255,0.58)",
  raised: "rgba(255,255,255,0.12)",
  sunk: "rgba(0,0,0,0.22)",
  line: "rgba(255,255,255,0.35)",
  gold: "#FDE047",
  warn: "#FDE68A",
  label: "#BFF6FF",
  grass: "#FFFFFF",
  /** filled button: white on the dark pitch */
  primary: "#FFFFFF",
  primaryInk: "#0A3A24",
  /** kit for figures drawn on the green: white shirt, black shorts */
  kit: { shirt: "#FFFFFF", shorts: "#111111" },
};

/** The same stadium in the app's own light colours: a day match. */
const DAY: typeof DARK = {
  light: true,
  sky: "#E6F1E9",
  skyLow: "#D6E9DC",
  stand: "#C5DECD",
  standLine: "rgba(20,83,45,0.10)",
  crowd: "#14532D",
  roof: "#A5C8B1",
  pole: "#B3CDBC",
  glow: "#FFFFFF",
  body: C.bg,
  bodyLow: C.bg,
  track: C.greenMid,
  accent: C.green,
  accentSoft: C.greenSoft,
  ink: C.text,
  ink2: C.text2,
  ink3: C.text3,
  raised: C.card,
  sunk: "#E4EBE6",
  line: C.border,
  gold: "#B45309",
  warn: "#B45309",
  label: C.greenDark,
  grass: C.greenMid,
  primary: C.green,
  primaryInk: "#FFFFFF",
  kit: { shirt: "#16A34A", shorts: "#FFFFFF" },
};

/**
 * Palette for the quiz screens (named NIGHT from when it was only the dark one).
 * Swap DAY for DARK to bring the night match back.
 */
export const NIGHT: typeof DARK = DAY;
/** kept for switching back */
export const NIGHT_DARK = DARK;

const VB_W = 400;
const VB_H = 170;

/** Seeded dots for the crowd so the silhouette doesn't change between renders. */
const CROWD = (() => {
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const dots: { x: number; y: number; o: number }[] = [];
  // far away: a dense speckle of small heads rather than a few big ones
  for (let i = 0; i < 520; i++) {
    const x = r() * VB_W;
    const y = 96 + r() * 62;
    if (y < standTop(x) + 3) continue;
    dots.push({ x, y, o: 0.05 + r() * 0.1 });
  }
  return dots;
})();

/** Top edge of the stands, seen from across the ground: low and nearly flat, rising a touch at the corners. */
function standTop(x: number) {
  const t = x / VB_W - 0.5;
  return 98 - 10 * (4 * t * t);
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

/** Floodlight mast in the distance: thin pole, small lit panel, soft glow. */
function Floodlight({ x }: { x: number }) {
  return (
    <G>
      <Circle cx={x} cy={52} r={24} fill="url(#glow)" />
      <Line x1={x} y1={56} x2={x} y2={standTop(x) - 6} stroke={NIGHT.pole} strokeWidth={1.6} />
      <Rect x={x - 7} y={48} width={14} height={7} rx={1} fill="#F7FBE8" opacity={0.92} />
    </G>
  );
}

/** Inside-the-ground silhouette: night sky, floodlights, roof, tiers of stands and crowd. */
const Silhouette = memo(function Silhouette({ track }: { track: boolean }) {
  const roof = Array.from({ length: 41 }, (_, i) => {
    const x = (i / 40) * VB_W;
    return `${i ? "L" : "M"}${x.toFixed(1)} ${(standTop(x) - 7).toFixed(1)}`;
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
          <Stop offset="0" stopColor={NIGHT.glow} stopOpacity="0.55" />
          <Stop offset="1" stopColor={NIGHT.glow} stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id="melt" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={NIGHT.body} stopOpacity="0" />
          <Stop offset="1" stopColor={NIGHT.body} stopOpacity="1" />
        </LinearGradient>
        <LinearGradient id="below" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={NIGHT.body} />
          <Stop offset="1" stopColor={NIGHT.body} />
        </LinearGradient>
      </Defs>
      <Rect width={VB_W} height={VB_H} fill="url(#sky)" />
      <Floodlight x={34} />
      <Floodlight x={148} />
      <Floodlight x={252} />
      <Floodlight x={366} />
      {/* roof edge with its supports */}
      <Path d={roof} stroke={NIGHT.roof} strokeWidth={2.2} fill="none" />
      {Array.from({ length: 17 }, (_, i) => {
        const x = 12 + i * 24;
        return <Line key={i} x1={x} y1={standTop(x) - 7} x2={x} y2={standTop(x)} stroke={NIGHT.roof} strokeWidth={0.8} />;
      })}
      {/* stands */}
      <Path d={`M0 ${VB_H} ${tierTop} L${VB_W} ${VB_H} Z`} fill={NIGHT.stand} />
      {[9, 18, 27, 36, 45].map((dy) => (
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
        <Circle key={i} cx={d.x} cy={d.y} r={0.8} fill={NIGHT.crowd} opacity={d.o} />
      ))}
      {/* the stands melt into the page instead of ending on a hard edge */}
      {!track && <Rect x={0} y={VB_H - 34} width={VB_W} height={34} fill="url(#melt)" />}
      {/* under the race line the screen's own colour takes over */}
      {track && (
        <>
          <Path d={`${TRACK_D} L${VB_W} ${VB_H} L0 ${VB_H} Z`} fill="url(#below)" />
          <Path d={TRACK_D} stroke={NIGHT.track} strokeWidth={4} strokeLinecap="round" fill="none" />
        </>
      )}
      {/* last row in the page colour: the sky would otherwise bleed through the anti-aliased edge */}
      <Rect x={0} y={VB_H - 1.5} width={VB_W} height={2} fill={NIGHT.body} />
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
  return 0.1 + p * 0.84;
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
      {runner.me ? (
        // you race as your own avatar (photo / preset)
        <Avatar id={null} me size={DOT} ring={NIGHT.accent} />
      ) : (
        <View style={[styles.dot, { backgroundColor: runner.color }]}>
          <Text allowFontScaling={false} style={styles.dotText}>
            {(runner.name.trim()[0] ?? "?").toUpperCase()}
          </Text>
        </View>
      )}
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
  dotText: { color: "white", fontWeight: "800", fontSize: 13 },
  label: { marginTop: 1, fontFamily: F.display, fontSize: 13, color: NIGHT.label, textShadowColor: NIGHT.light ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.6)", textShadowRadius: 3 },
});
