import MaskedView from "@react-native-masked-view/masked-view";
import { Image, StyleSheet, View } from "react-native";

import { BRAND, type JerseyStyle } from "~/lib/brand";
import { F } from "~/lib/theme";

import { Text } from "./Text";

/**
 * Football shirt in the team's kit colours. Three generated layers: a white
 * silhouette tinted with the body colour, a sleeve mask tinted with the sleeve
 * colour, and neutral grey folds multiplied on top. The number is text.
 */
/** light enough that white trim would vanish on it */
function isLight(hex: string) {
  const h = hex.replace("#", "");
  if (h.length < 6) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 170;
}

export function Jersey({
  body,
  sleeves,
  numberColor,
  number,
  variant = "vneck",
  captain,
  goals,
  faded,
  hideNumber,
  pattern,
  trim,
  size = 54,
}: {
  body: string;
  sleeves: string;
  numberColor: string;
  number: number;
  variant?: JerseyStyle;
  captain?: boolean;
  goals?: number;
  faded?: boolean;
  hideNumber?: boolean;
  /** Torso pattern over the body colour: `bands` alternating stripes (body colour first) */
  pattern?: { color: string; bands: number; horizontal?: boolean };
  /** collar and cuffs; by default the stripe colour, else white on a dark shirt and near-black on a light one */
  trim?: string;
  size?: number;
}) {
  const layers = BRAND.jersey[variant];
  const fill = { width: size, height: size };
  return (
    <View style={[fill, { opacity: faded ? 0.45 : 1 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Image source={layers.body} style={[StyleSheet.absoluteFill, fill, { tintColor: body }]} />
      {pattern && (
        // Stripes clipped to the shirt silhouette; the sleeves layer covers their outer ends
        <MaskedView style={StyleSheet.absoluteFill} maskElement={<Image source={layers.body} style={fill} />}>
          <View style={[fill, { flexDirection: pattern.horizontal ? "column" : "row", paddingHorizontal: pattern.horizontal ? 0 : size * 0.24 }]}>
            {Array.from({ length: pattern.bands }, (_, i) => (
              <View key={i} style={{ flex: 1, backgroundColor: i % 2 ? pattern.color : body }} />
            ))}
          </View>
        </MaskedView>
      )}
      <Image source={layers.sleeves} style={[StyleSheet.absoluteFill, fill, { tintColor: sleeves }]} />
      <Image source={layers.trim} style={[StyleSheet.absoluteFill, fill, { tintColor: trim ?? pattern?.color ?? (isLight(body) ? "#1F2937" : "#FFFFFF") }]} />
      <View style={[StyleSheet.absoluteFill, { mixBlendMode: "multiply" }]}>
        <Image source={layers.shade} style={fill} />
      </View>
      {/* the sheen of the cloth */}
      <Image source={layers.gloss} style={[StyleSheet.absoluteFill, fill, { opacity: 0.55 }]} />
      {!hideNumber && <View style={[StyleSheet.absoluteFill, styles.numberWrap]}>
        <Text
          allowFontScaling={false}
          style={{
            color: numberColor,
            fontSize: Math.round(size * 0.42),
            fontFamily: F.black,
            fontVariant: ["tabular-nums"],
            textShadowColor: "rgba(0,0,0,0.25)",
            textShadowOffset: { width: 0, height: 0.5 },
            textShadowRadius: 1,
          }}
        >
          {number}
        </Text>
      </View>}
      {goals ? (
        <View style={styles.goals}>
          <Text style={{ fontSize: 10 }}>⚽</Text>
          {goals > 1 && <Text style={{ fontSize: 10, fontWeight: "800", color: "#0B1220" }}>{goals}</Text>}
        </View>
      ) : null}
      {captain ? (
        <View style={styles.captain}>
          <Text style={{ fontSize: 9, fontWeight: "900", color: "#0B1220" }}>C</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  numberWrap: { alignItems: "center", justifyContent: "center", paddingTop: "8%" },
  goals: {
    position: "absolute",
    right: -2,
    top: -2,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 10,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  captain: {
    position: "absolute",
    left: 0,
    bottom: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FACC15",
    alignItems: "center",
    justifyContent: "center",
  },
});
