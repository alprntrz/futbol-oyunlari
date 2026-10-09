import { Text, View } from "react-native";

import { F } from "~/lib/theme";

const EDGE = "rgba(0,0,0,0.65)";

/** Pixel-style shirt drawn with Views, same look as the web Jersey. */
export function Jersey({
  body,
  sleeves,
  numberColor,
  number,
  captain,
  goals,
  faded,
  size = 46,
}: {
  body: string;
  sleeves: string;
  numberColor: string;
  number: number;
  captain?: boolean;
  goals?: number;
  faded?: boolean;
  size?: number;
}) {
  const h = size * 0.82;
  return (
    <View style={{ width: size, height: h, opacity: faded ? 0.55 : 1 }}>
      <View style={{ position: "absolute", left: 0, top: h * 0.08, width: size * 0.22, height: h * 0.38, backgroundColor: sleeves, borderWidth: 2, borderColor: EDGE, borderRadius: 2 }} />
      <View style={{ position: "absolute", right: 0, top: h * 0.08, width: size * 0.22, height: h * 0.38, backgroundColor: sleeves, borderWidth: 2, borderColor: EDGE, borderRadius: 2 }} />
      <View
        style={{
          position: "absolute",
          left: size * 0.16,
          top: 0,
          width: size * 0.68,
          height: h,
          backgroundColor: body,
          borderWidth: 2,
          borderColor: EDGE,
          borderRadius: 2,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            color: numberColor,
            fontFamily: F.pixel,
            fontSize: size * (number >= 10 ? 0.26 : 0.32),
            textShadowColor: "rgba(0,0,0,0.35)",
            textShadowOffset: { width: 1, height: 1 },
            textShadowRadius: 0,
          }}
        >
          {number}
        </Text>
      </View>
      <View style={{ position: "absolute", left: size * 0.4, top: 0, width: size * 0.2, height: h * 0.1, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 2 }} />
      {goals ? (
        <View style={{ position: "absolute", right: -6, top: -9, flexDirection: "row", alignItems: "center" }}>
          <Text style={{ fontSize: 11 }}>⚽</Text>
          {goals > 1 && (
            <View style={{ backgroundColor: "#0284c7", borderRadius: 3, paddingHorizontal: 3, marginLeft: 1 }}>
              <Text style={{ color: "white", fontSize: 9, fontFamily: F.bold }}>{goals}</Text>
            </View>
          )}
        </View>
      ) : null}
      {captain ? (
        <View style={{ position: "absolute", right: -6, bottom: 0, width: 15, height: 15, backgroundColor: "white", borderWidth: 1, borderColor: "black", borderRadius: 2, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 9, fontFamily: F.black, color: "black" }}>C</Text>
        </View>
      ) : null}
    </View>
  );
}
