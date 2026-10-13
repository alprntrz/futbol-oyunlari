import { useId, useState } from "react";
import { Pressable, StyleSheet, View, type ImageSourcePropType, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { Image } from "react-native";
import Svg, { Defs, G as SvgG, LinearGradient, Path, Pattern, Rect, Stop } from "react-native-svg";

import { haptic } from "~/lib/haptics";
import { play } from "~/lib/sound";
import { F } from "~/lib/theme";

import { Text } from "./Text";

/**
 * Draft Showdown look: violet screens with big faint stars, every surface a
 * gradient with a dark outline and a light top edge, rounded chunky type.
 */
export const G = {
  bg: "#6A54D4",
  star: "#7762DE",
  ink: "#2B1D6B",
  inkSoft: "rgba(43,29,107,0.55)",
  plate: "#4E3BB8",
  plateTop: "#6550D0",
  lav1: "#D9CFFF",
  lav2: "#9B86EE",
  lavIdle1: "#B6A6F4",
  lavIdle2: "#7F68DF",
  text: "#FFFFFF",
  cream: "#FFF4D6",
  yellowText: "#FFE16A",
  orange1: "#FFC34A",
  orange2: "#F7871B",
  orangeEdge: "#C55410",
  brown: "#4A2208",
  lime1: "#D8F25A",
  lime2: "#8CC63A",
  gold1: "#FFE36B",
  gold2: "#F6B915",
  green: "#47C35B",
  peach1: "#F7D9BE",
  peach2: "#E2A77D",
  // still used by the other tabs' buttons
  blue: "#4C8DF6",
  blueEdge: "#2A5DC2",
  teal: "#22C3B0",
  tealEdge: "#0F8476",
};

/** Rounded game type, white with a hard violet drop under it. */
export const outline = (size: number, color = G.text, shadow = G.ink): TextStyle => ({
  fontFamily: F.game,
  fontSize: size,
  color,
  textShadowColor: shadow,
  textShadowOffset: { width: 0, height: Math.max(1.5, size / 13) },
  textShadowRadius: 0,
});

/** Violet background with big faint stars, like Draft Showdown's menus. */
export function GameBg() {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const star = (x: number, y: number, r: number, rot: number) => {
    const pts = Array.from({ length: 10 }, (_, i) => {
      const a = (Math.PI / 5) * i - Math.PI / 2 + (rot * Math.PI) / 180;
      const rr = i % 2 ? r * 0.48 : r;
      return `${(x + rr * Math.cos(a)).toFixed(1)},${(y + rr * Math.sin(a)).toFixed(1)}`;
    });
    return <Path key={`${x}-${y}`} d={`M${pts.join("L")}Z`} fill={G.star} stroke={G.star} strokeWidth={6} strokeLinejoin="round" />;
  };
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id={`stars${id}`} width={240} height={240} patternUnits="userSpaceOnUse">
            <Rect width={240} height={240} fill={G.bg} />
            <SvgG>
              {star(40, 46, 30, 8)}
              {star(170, 30, 18, -12)}
              {star(120, 130, 36, 20)}
              {star(210, 170, 24, -4)}
              {star(30, 200, 20, 30)}
            </SvgG>
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#stars${id})`} />
      </Svg>
    </View>
  );
}

/** A vertical gradient filling its parent (put inside a View with borderRadius + overflow hidden). */
export function Grad({ from, to, style }: { from: string; to: string; style?: StyleProp<ViewStyle> }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <Svg style={[StyleSheet.absoluteFill, style]} width="100%" height="100%" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#g${id})`} />
    </Svg>
  );
}

/** Gradient box with the dark outline and a light inner top edge. */
export function GradBox({
  from,
  to,
  radius = 16,
  children,
  style,
}: {
  from: string;
  to: string;
  radius?: number;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ borderRadius: radius, borderWidth: 2.5, borderColor: G.ink, overflow: "hidden" }, style]}>
      <Grad from={from} to={to} />
      <View style={[styles.innerTop, { borderTopLeftRadius: radius, borderTopRightRadius: radius }]} pointerEvents="none" />
      {children}
    </View>
  );
}

/**
 * The big Battle button: a stretched hexagon, orange gradient, dark outline,
 * darker underside it sinks into when pressed.
 */
export function HexButton({ title, onPress, width = 300, height = 76 }: { title: string; onPress: () => void; width?: number; height?: number }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const edge = 8;
  const h = height - edge;
  const k = h * 0.42; // how far the points stick out
  const hex = (y: number) => `M${k},${y} L${width - k},${y} L${width - 2},${y + h / 2} L${width - k},${y + h} L${k},${y + h} L2,${y + h / 2} Z`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => {
        haptic.press();
        play("tap");
        onPress();
      }}
      style={{ width, height, alignSelf: "center" }}
    >
      {({ pressed }) => (
        <>
          <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id={`h${id}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={G.orange1} />
                <Stop offset="1" stopColor={G.orange2} />
              </LinearGradient>
            </Defs>
            {/* underside */}
            <Path d={hex(edge)} fill={G.orangeEdge} stroke={G.ink} strokeWidth={3} strokeLinejoin="round" />
            {/* face */}
            <Path d={hex(pressed ? edge - 2 : 0)} fill={`url(#h${id})`} stroke={G.ink} strokeWidth={3} strokeLinejoin="round" />
            {/* shine */}
            <Path
              d={`M${k + 6},${(pressed ? edge - 2 : 0) + 7} L${width - k - 6},${(pressed ? edge - 2 : 0) + 7} L${width - k - 14},${(pressed ? edge - 2 : 0) + h * 0.38} L${k + 14},${(pressed ? edge - 2 : 0) + h * 0.38} Z`}
              fill="rgba(255,255,255,0.28)"
            />
          </Svg>
          <View style={[styles.hexLabel, { height: h, top: pressed ? edge - 2 : 0 }]} pointerEvents="none">
            <Text style={outline(Math.round(h * 0.52), G.brown, "rgba(255,255,255,0.55)")} allowFontScaling={false}>
              {title}
            </Text>
          </View>
        </>
      )}
    </Pressable>
  );
}

/** Rounded 3D button for secondary actions (gradient face on a darker edge). */
export function ChunkyButton({
  title,
  onPress,
  from = G.orange1,
  to = G.orange2,
  edge = G.orangeEdge,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  from?: string;
  to?: string;
  edge?: string;
  icon?: ImageSourcePropType;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => {
        haptic.press();
        play("tap");
        onPress();
      }}
      style={({ pressed }) => [{ borderRadius: 16, backgroundColor: edge, borderWidth: 2.5, borderColor: G.ink }, pressed ? { paddingTop: 5 } : { paddingBottom: 5 }, style]}
    >
      <View style={styles.chunkyFace}>
        <Grad from={from} to={to} />
        <View style={styles.innerTop} />
        {icon && <Image source={icon} style={{ width: 26, height: 26 }} />}
        <Text style={outline(18)} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

/** Rounded dark pill for a counter, with its 3D icon overlapping the right end. */
export function Counter({ value, icon, onPress, label, tint }: { value: React.ReactNode; icon: React.ReactNode; onPress?: () => void; label: string; tint?: string }) {
  const body = (
    <View style={styles.counterWrap} accessibilityLabel={label}>
      <View style={[styles.counter, tint ? { backgroundColor: tint } : null]}>{typeof value === "string" || typeof value === "number" ? <Text style={outline(17)}>{value}</Text> : value}</View>
      <View style={styles.counterIcon}>{icon}</View>
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ flex: 1 }}>
      {body}
    </Pressable>
  ) : (
    <View style={{ flex: 1 }}>{body}</View>
  );
}

/** Thick progress bar: violet frame, orange gradient fill, yellow numbers, an icon on the left. */
export function FatBar({ fraction, text, icon, height = 34 }: { fraction: number; text: string; icon?: React.ReactNode; height?: number }) {
  const f = Math.max(0.04, Math.min(1, fraction));
  return (
    <View style={[styles.fatOuter, { height: height + 8, borderRadius: (height + 8) / 2 }]}>
      <View style={[styles.fatInner, { height, borderRadius: height / 2 }]}>
        <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${f * 100}%`, borderRadius: height / 2, overflow: "hidden" }}>
          <Grad from={G.orange1} to={G.orange2} />
          <View style={styles.fillShine} />
        </View>
        <Text style={[outline(height * 0.6, G.yellowText), { textAlign: "center" }]} allowFontScaling={false}>
          {text}
        </Text>
      </View>
      {icon && <View style={[styles.fatIcon, { width: height + 10, height: height + 10, borderRadius: (height + 10) / 2, top: -1 }]}>{icon}</View>}
    </View>
  );
}

/** Green diamond with a "!" (something new / something to collect). */
export function Bang({ size = 22, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ width: size, height: size, alignItems: "center", justifyContent: "center" }, style]} pointerEvents="none">
      <View style={[styles.bang, { width: size * 0.78, height: size * 0.78, borderRadius: size * 0.18 }]} />
      <Text style={[outline(size * 0.62), { lineHeight: size * 0.8 }]} allowFontScaling={false}>
        !
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  innerTop: { position: "absolute", top: 0, left: 0, right: 0, height: 3, backgroundColor: "rgba(255,255,255,0.45)" },
  hexLabel: { position: "absolute", left: 0, right: 0, alignItems: "center", justifyContent: "center" },
  chunkyFace: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 13, paddingVertical: 9, paddingHorizontal: 14, overflow: "hidden" },
  counterWrap: { height: 40, justifyContent: "center" },
  counter: {
    height: 32,
    marginRight: 18,
    borderRadius: 16,
    backgroundColor: "rgba(43,29,107,0.55)",
    alignItems: "flex-end",
    justifyContent: "center",
    paddingLeft: 12,
    paddingRight: 24,
  },
  counterIcon: { position: "absolute", right: 0, top: 0, bottom: 0, width: 40, alignItems: "center", justifyContent: "center" },
  fatOuter: { backgroundColor: "#8F7AEB", borderWidth: 2.5, borderColor: G.ink, padding: 2, justifyContent: "center" },
  fatInner: { backgroundColor: "#3A2A90", overflow: "hidden", justifyContent: "center" },
  fillShine: { position: "absolute", top: 3, left: 8, right: 8, height: "30%", borderRadius: 8, backgroundColor: "rgba(255,255,255,0.35)" },
  fatIcon: { position: "absolute", left: -6, alignItems: "center", justifyContent: "center" },
  bang: { position: "absolute", backgroundColor: G.green, borderWidth: 2, borderColor: G.ink, transform: [{ rotate: "45deg" }] },
});

/**
 * Slanted card (a parallelogram): gradient face, dark outline and a light top
 * edge, drawn as one SVG shape so the gradient always fills it.
 */
export function SlantCard({ from, to, children, style, slant = 0.2 }: { from: string; to: string; children?: React.ReactNode; style?: StyleProp<ViewStyle>; slant?: number }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [size, setSize] = useState({ w: 0, h: 0 });
  const { w, h } = size;
  const s = h * slant;
  const sw = 2.5;
  const shape = `M${s + sw},${sw} L${w - sw},${sw} L${w - s - sw},${h - sw} L${sw},${h - sw} Z`;
  return (
    <View style={style} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {w > 0 && (
        <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={`s${id}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={from} />
              <Stop offset="1" stopColor={to} />
            </LinearGradient>
          </Defs>
          <Path d={shape} fill={`url(#s${id})`} stroke={G.ink} strokeWidth={sw * 2} strokeLinejoin="round" />
          <Path d={`M${s + 8},${sw + 3} L${w - 10},${sw + 3}`} stroke="rgba(255,255,255,0.55)" strokeWidth={3} strokeLinecap="round" />
        </Svg>
      )}
      {children}
    </View>
  );
}
