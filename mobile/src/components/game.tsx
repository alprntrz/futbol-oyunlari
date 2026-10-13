import { Image, Pressable, StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { OYUN } from "~/lib/brand";
import { haptic } from "~/lib/haptics";
import { play } from "~/lib/sound";
import { F } from "~/lib/theme";

import { Text } from "./Text";
import { Icon, type SymbolName } from "./ui";

/**
 * "Game" look (after Draft Showdown): deep pitch-green screens, chunky buttons
 * with a darker bottom edge, white display text with a hard dark outline.
 */
export const G = {
  top: "#0F6B3A",
  bottom: "#063A20",
  panel: "rgba(0,0,0,0.22)",
  panelEdge: "rgba(255,255,255,0.14)",
  bar: "#04271A",
  barEdge: "#0B4A2B",
  ink: "#05261A",
  text: "#FFFFFF",
  sub: "rgba(255,255,255,0.72)",
  orange: "#FF9F1C",
  orangeEdge: "#C2620A",
  lime: "#9BE15D",
  limeEdge: "#4E9A25",
  gold: "#FACC15",
  goldEdge: "#B58900",
  blue: "#3B82F6",
  blueEdge: "#1E4FB0",
  purple: "#A855F7",
  purpleEdge: "#6B2BB0",
  pink: "#F43F7A",
  pinkEdge: "#A3194A",
  teal: "#14B8A6",
  tealEdge: "#0A766B",
};

/** White display text with a hard dark drop, readable on any colour. */
export const outline = (size: number, color = G.text): TextStyle => ({
  fontFamily: F.black,
  fontSize: size,
  color,
  textShadowColor: "rgba(0,0,0,0.45)",
  textShadowOffset: { width: 0, height: Math.max(2, size / 14) },
  textShadowRadius: 0,
});

/** Full-screen gradient with faint stars, behind a game-style screen. */
export function GameBg({ from = G.top, to = G.bottom }: { from?: string; to?: string }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#bg)" />
      </Svg>
      <Image source={OYUN.pattern} resizeMode="repeat" style={[StyleSheet.absoluteFill, { opacity: 0.07, width: "100%", height: "100%" }]} />
    </View>
  );
}

/** Rounded translucent panel on the green background. */
export function Panel({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

/**
 * Chunky 3D button: coloured face on a darker edge; pressing drops the face
 * onto the edge. `size` "lg" is the big Play button.
 */
export function ChunkyButton({
  title,
  onPress,
  color = G.orange,
  edge = G.orangeEdge,
  icon,
  size = "md",
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  color?: string;
  edge?: string;
  icon?: SymbolName;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const depth = size === "lg" ? 7 : size === "md" ? 5 : 4;
  const font = size === "lg" ? 34 : size === "md" ? 22 : 17;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={() => {
        haptic.press();
        play("tap");
        onPress();
      }}
      style={({ pressed }) => [
        { borderRadius: 18, backgroundColor: edge, borderWidth: 2.5, borderColor: G.ink },
        pressed && !disabled ? { paddingTop: depth, backgroundColor: G.ink } : { paddingBottom: depth },
        disabled && { opacity: 0.5 },
        style,
      ]}
    >
      <View style={[styles.face, { backgroundColor: color, paddingVertical: size === "lg" ? 14 : size === "md" ? 10 : 7 }]}>
        {/* the top shine */}
        <View style={styles.shine} />
        {icon && <Icon name={icon} size={font * 0.8} color="white" fallback="▶" />}
        <Text style={outline(font)} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: G.panel, borderRadius: 22, borderWidth: 1.5, borderColor: G.panelEdge, padding: 14 },
  face: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 15, paddingHorizontal: 18, overflow: "hidden" },
  shine: { position: "absolute", top: 3, left: 10, right: 10, height: "38%", borderRadius: 12, backgroundColor: "rgba(255,255,255,0.22)" },
});
