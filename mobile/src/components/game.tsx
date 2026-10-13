import { useId, useState } from "react";
import { Pressable, StyleSheet, View, type ImageSourcePropType, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { Image } from "react-native";
import Svg, { Defs, G as SvgG, LinearGradient, Path, Pattern, RadialGradient, Rect, Stop } from "react-native-svg";

import { haptic } from "~/lib/haptics";
import { play } from "~/lib/sound";
import { F } from "~/lib/theme";

import { Text } from "./Text";

/**
 * Draft Showdown look: violet screens with big faint stars, every surface a
 * gradient with a dark outline and a light top edge, rounded chunky type.
 */
const VIOLET = {
  bg: "#6A54D4",
  star: "#7762DE",
  ink: "#2B1D6B",
  glass: "rgba(43,29,107,0.55)",
  plate: "#4E3BB8",
  arrow: "#A994F7",
  arrowInk: "#3B2A8F",
  tab1: "#D9CFFF",
  tab2: "#9B86EE",
  tabIdle1: "#B6A6F4",
  tabIdle2: "#7F68DF",
  tabRim: "rgba(255,255,255,0.7)",
  text: "#FFFFFF",
  yellowText: "#FFE16A",
  cta1: "#FFC34A",
  cta2: "#F7871B",
  ctaEdge: "#C55410",
  ctaText: "#4A2208",
  ctaTextShadow: "rgba(255,255,255,0.55)",
  bar1: "#FFC34A",
  bar2: "#F7871B",
  barFrame: "#8F7AEB",
  barInner: "#3A2A90",
  me1: "#D8F25A",
  me2: "#8CC63A",
  quest1: "#FFE36B",
  quest2: "#F6B915",
  questText: "#4A2208",
  pill: "#5A45C8",
  track: "#3A2A90",
  trackFill: "#8E63F2",
  dot: "#3D8BEA",
  avatarBg: "#7EB6FF",
  slot1: "#F7D9BE",
  slot2: "#E2A77D",
  slotDone: "#4A36A8",
  green: "#47C35B",
  font: F.game,
  upper: false,
  /** text drawn straight on the background (and its drop), tab labels, status bar */
  onBg: "#FFFFFF",
  onBgShadow: "#2B1D6B",
  tabText: "#FFFFFF",
  statusBar: "light" as "light" | "dark",
  // still used by the other tabs' buttons
  blue: "#4C8DF6",
  blueEdge: "#2A5DC2",
  teal: "#22C3B0",
  tealEdge: "#0F8476",
};

/** Night stadium: navy sky over a floodlit pitch, gold for what matters (FUT-card feel). */
const STADIUM: typeof VIOLET = {
  bg: "#0B1F3D",
  star: "#123056",
  ink: "#040D1C",
  glass: "rgba(4,13,28,0.55)",
  plate: "#14305A",
  arrow: "#2C5A9C",
  arrowInk: "#E8F0FF",
  tab1: "#2E5B97",
  tab2: "#132C52",
  tabIdle1: "#1B3A66",
  tabIdle2: "#0D2142",
  tabRim: "#F5C94A",
  text: "#FFFFFF",
  yellowText: "#FFFFFF",
  cta1: "#5BE38A",
  cta2: "#17A34A",
  ctaEdge: "#0B6B2F",
  ctaText: "#FFFFFF",
  ctaTextShadow: "#063D1B",
  bar1: "#FFE27A",
  bar2: "#E2A40C",
  barFrame: "#2B4F86",
  barInner: "#081A33",
  me1: "#FBE7A1",
  me2: "#C9962A",
  quest1: "#1F4F8C",
  quest2: "#10305C",
  questText: "#FFFFFF",
  pill: "#0E2547",
  track: "#081A33",
  trackFill: "#2FC46A",
  dot: "#F5C94A",
  avatarBg: "#DCE8F7",
  slot1: "#3BAA5C",
  slot2: "#1F7A3D",
  slotDone: "#0E2547",
  green: "#2FC46A",
  font: F.displayItalic,
  upper: true,
  onBg: "#FFFFFF",
  onBgShadow: "#040D1C",
  tabText: "#FFFFFF",
  statusBar: "light",
  blue: "#2C6FD6",
  blueEdge: "#17448C",
  teal: "#1FA98F",
  tealEdge: "#0D6656",
};

/** Champions League night: deep navy, white and silver, starry sky, electric blue for Play. */
const UCL: typeof VIOLET = {
  bg: "#061A55",
  star: "#0E2A73",
  ink: "#020B2E",
  glass: "rgba(2,11,46,0.55)",
  plate: "#0B2468",
  arrow: "#1E43A8",
  arrowInk: "#FFFFFF",
  tab1: "#2A4FB8",
  tab2: "#0A1D5E",
  tabIdle1: "#16318A",
  tabIdle2: "#06154A",
  tabRim: "#DCE6FF",
  text: "#FFFFFF",
  yellowText: "#FFFFFF",
  cta1: "#4FD3FF",
  cta2: "#1167E0",
  ctaEdge: "#073A8C",
  ctaText: "#FFFFFF",
  ctaTextShadow: "#02205C",
  bar1: "#F4F7FF",
  bar2: "#9DB2DD",
  barFrame: "#2A4DA8",
  barInner: "#031444",
  me1: "#3E6FE6",
  me2: "#16389F",
  quest1: "#E9EEF9",
  quest2: "#A8B8DA",
  questText: "#0A1D5E",
  pill: "#0A1D5E",
  track: "#031444",
  trackFill: "#3FB8FF",
  dot: "#3FB8FF",
  avatarBg: "#DCE6FF",
  slot1: "#2A57D0",
  slot2: "#0F2F8C",
  slotDone: "#031444",
  green: "#2FC46A",
  font: F.display,
  upper: true,
  onBg: "#FFFFFF",
  onBgShadow: "#020B2E",
  tabText: "#FFFFFF",
  statusBar: "light",
  blue: "#2C6FD6",
  blueEdge: "#17448C",
  teal: "#1FA98F",
  tealEdge: "#0D6656",
};

/** Middle way: our old light look (pale green-grey, white surfaces, pitch green, Barlow) with the new layout and depth. */
const LIGHT: typeof VIOLET = {
  bg: "#EEF3EF",
  star: "#E1EAE3",
  ink: "#0F3D24",
  glass: "rgba(15,61,36,0.88)",
  plate: "#15803D",
  arrow: "#22A55A",
  arrowInk: "#FFFFFF",
  tab1: "#FFFFFF",
  tab2: "#DDF5E4",
  tabIdle1: "#FBFDFB",
  tabIdle2: "#E2E9E4",
  tabRim: "#16A34A",
  text: "#FFFFFF",
  yellowText: "#FFFFFF",
  cta1: "#3BD872",
  cta2: "#15803D",
  ctaEdge: "#0E5B2C",
  ctaText: "#FFFFFF",
  ctaTextShadow: "#0B3D1F",
  bar1: "#FFD64D",
  bar2: "#F2A50C",
  barFrame: "#CFE0D4",
  barInner: "#0F3D24",
  me1: "#34C46A",
  me2: "#15803D",
  quest1: "#FFE27A",
  quest2: "#F5B70F",
  questText: "#3B2A05",
  pill: "#0F5F2E",
  track: "#0F3D24",
  trackFill: "#22C55E",
  dot: "#2563EB",
  avatarBg: "#DDF5E4",
  slot1: "#FFFFFF",
  slot2: "#E3EAE5",
  slotDone: "#15803D",
  green: "#16A34A",
  font: F.display,
  upper: false,
  onBg: "#0F3D24",
  onBgShadow: "transparent",
  tabText: "#14532D",
  statusBar: "dark",
  blue: "#2C6FD6",
  blueEdge: "#17448C",
  teal: "#1FA98F",
  tealEdge: "#0D6656",
};

/** Which look the game screens use ("violet" = Draft Showdown copy, "stadium" = our football take). */
export const LOOK = "light" as "violet" | "stadium" | "ucl" | "light";
export const G = LOOK === "stadium" ? STADIUM : LOOK === "ucl" ? UCL : LOOK === "light" ? LIGHT : VIOLET;

/** Rounded game type, white with a hard violet drop under it. */
export const outline = (size: number, color = G.text, shadow = G.ink): TextStyle => ({
  fontFamily: G.font,
  fontSize: LOOK === "violet" ? size : size * 1.12,
  color,
  textShadowColor: shadow,
  textShadowOffset: { width: 0, height: Math.max(1.5, size / 13) },
  textShadowRadius: 0,
  textTransform: G.upper ? "uppercase" : "none",
});

export function GameBg() {
  return LOOK === "stadium" ? <StadiumBg /> : LOOK === "ucl" ? <UclBg /> : LOOK === "light" ? <LightBg /> : <VioletBg />;
}

/** Light: the old pale background with a faint pitch drawn on it. */
function LightBg() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 400 860" preserveAspectRatio="xMidYMid slice">
        <Rect width={400} height={860} fill={G.bg} />
        <SvgG stroke="#15803D" strokeOpacity={0.07} strokeWidth={3} fill="none">
          <Path d="M20,40 L380,40 L380,820 L20,820 Z" />
          <Path d="M20,430 L380,430" />
          <Path d="M200,430 m-75,0 a75,75 0 1,0 150,0 a75,75 0 1,0 -150,0" />
          <Path d="M110,40 L110,150 L290,150 L290,40" />
          <Path d="M110,820 L110,710 L290,710 L290,820" />
        </SvgG>
      </Svg>
    </View>
  );
}

/** Champions League night: navy glow from the top, a sky of white stars, one soft light arc. */
function UclBg() {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  // fixed scatter so the sky never jumps between renders
  const stars: [number, number, number, number][] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 46; i++) stars.push([rnd() * 400, rnd() * 860, 2 + rnd() * (i % 6 === 0 ? 9 : 4), 0.25 + rnd() * 0.6]);
  const star = ([x, y, r, o]: [number, number, number, number], k: number) => {
    const pts = Array.from({ length: 10 }, (_, i) => {
      const a = (Math.PI / 5) * i - Math.PI / 2;
      const rr = i % 2 ? r * 0.42 : r;
      return `${(x + rr * Math.cos(a)).toFixed(1)},${(y + rr * Math.sin(a)).toFixed(1)}`;
    });
    return <Path key={k} d={`M${pts.join("L")}Z`} fill="#FFFFFF" fillOpacity={o} />;
  };
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 400 860" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id={`n${id}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0A2A86" />
            <Stop offset="0.5" stopColor="#061A55" />
            <Stop offset="1" stopColor="#030D33" />
          </LinearGradient>
          <RadialGradient id={`glow${id}`} cx="0.5" cy="0.32" r="0.55">
            <Stop offset="0" stopColor="#3D7BFF" stopOpacity={0.35} />
            <Stop offset="1" stopColor="#3D7BFF" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={400} height={860} fill={`url(#n${id})`} />
        <Rect width={400} height={860} fill={`url(#glow${id})`} />
        {/* a wide soft arc of light, like a stadium roof at night */}
        <Path d="M-40,520 Q200,330 440,520" stroke="#BFD3FF" strokeOpacity={0.08} strokeWidth={26} fill="none" />
        <Path d="M-40,560 Q200,380 440,560" stroke="#BFD3FF" strokeOpacity={0.05} strokeWidth={10} fill="none" />
        {stars.map(star)}
      </Svg>
    </View>
  );
}

/** Night stadium: navy sky fading into a floodlit pitch, two light beams, faint pitch lines. */
function StadiumBg() {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 400 860" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id={`sky${id}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#06142B" />
            <Stop offset="0.45" stopColor="#0B2448" />
            <Stop offset="0.75" stopColor="#0D3B3A" />
            <Stop offset="1" stopColor="#0B4A2A" />
          </LinearGradient>
          <LinearGradient id={`beam${id}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#CFE6FF" stopOpacity={0.22} />
            <Stop offset="1" stopColor="#CFE6FF" stopOpacity={0} />
          </LinearGradient>
          <Pattern id={`grass${id}`} width={400} height={60} patternUnits="userSpaceOnUse">
            <Rect width={400} height={30} fill="#FFFFFF" fillOpacity={0.025} />
          </Pattern>
        </Defs>
        <Rect width={400} height={860} fill={`url(#sky${id})`} />
        {/* floodlight beams from the top corners */}
        <Path d="M-20,-10 L60,-10 L260,620 L120,640 Z" fill={`url(#beam${id})`} />
        <Path d="M340,-10 L420,-10 L280,640 L140,620 Z" fill={`url(#beam${id})`} />
        {/* mowing stripes and lines on the lower half */}
        <Rect y={430} width={400} height={430} fill={`url(#grass${id})`} />
        <SvgG stroke="#FFFFFF" strokeOpacity={0.07} strokeWidth={3} fill="none">
          <Path d="M0,640 L400,640" />
          <Path d="M200,640 m-70,0 a70,70 0 1,0 140,0 a70,70 0 1,0 -140,0" />
          <Path d="M120,860 L120,780 L280,780 L280,860" />
        </SvgG>
        {/* the lamps */}
        <SvgG fill="#FFFFFF" fillOpacity={0.55}>
          <Rect x={4} y={10} width={44} height={10} rx={3} />
          <Rect x={352} y={10} width={44} height={10} rx={3} />
        </SvgG>
      </Svg>
    </View>
  );
}

/** Violet background with big faint stars, like Draft Showdown's menus. */
function VioletBg() {
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
                <Stop offset="0" stopColor={G.cta1} />
                <Stop offset="1" stopColor={G.cta2} />
              </LinearGradient>
            </Defs>
            {/* underside */}
            <Path d={hex(edge)} fill={G.ctaEdge} stroke={G.ink} strokeWidth={3} strokeLinejoin="round" />
            {/* face */}
            <Path d={hex(pressed ? edge - 2 : 0)} fill={`url(#h${id})`} stroke={G.ink} strokeWidth={3} strokeLinejoin="round" />
            {/* shine */}
            <Path
              d={`M${k + 6},${(pressed ? edge - 2 : 0) + 7} L${width - k - 6},${(pressed ? edge - 2 : 0) + 7} L${width - k - 14},${(pressed ? edge - 2 : 0) + h * 0.38} L${k + 14},${(pressed ? edge - 2 : 0) + h * 0.38} Z`}
              fill="rgba(255,255,255,0.28)"
            />
          </Svg>
          <View style={[styles.hexLabel, { height: h, top: pressed ? edge - 2 : 0 }]} pointerEvents="none">
            <Text style={outline(Math.round(h * 0.52), G.ctaText, G.ctaTextShadow)} allowFontScaling={false}>
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
  from = G.cta1,
  to = G.cta2,
  edge = G.ctaEdge,
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
          <Grad from={G.bar1} to={G.bar2} />
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
    backgroundColor: G.glass,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingLeft: 12,
    paddingRight: 24,
  },
  counterIcon: { position: "absolute", right: 0, top: 0, bottom: 0, width: 40, alignItems: "center", justifyContent: "center" },
  fatOuter: { backgroundColor: G.barFrame, borderWidth: 2.5, borderColor: G.ink, padding: 2, justifyContent: "center" },
  fatInner: { backgroundColor: G.barInner, overflow: "hidden", justifyContent: "center" },
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
