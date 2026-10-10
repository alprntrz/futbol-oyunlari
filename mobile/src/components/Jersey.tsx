import { Image, StyleSheet, View } from "react-native";

import { BRAND, type JerseyStyle } from "~/lib/brand";
import { F } from "~/lib/theme";

import { Text } from "./Text";

/**
 * Football shirt in the team's kit colours. Three generated layers: a white
 * silhouette tinted with the body colour, a sleeve mask tinted with the sleeve
 * colour, and neutral grey folds multiplied on top. The number is text.
 */
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
  size?: number;
}) {
  const layers = BRAND.jersey[variant];
  const fill = { width: size, height: size };
  return (
    <View style={[fill, { opacity: faded ? 0.45 : 1 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Image source={layers.body} style={[StyleSheet.absoluteFill, fill, { tintColor: body }]} />
      <Image source={layers.sleeves} style={[StyleSheet.absoluteFill, fill, { tintColor: sleeves }]} />
      <View style={[StyleSheet.absoluteFill, { mixBlendMode: "multiply" }]}>
        <Image source={layers.shade} style={fill} />
      </View>
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
