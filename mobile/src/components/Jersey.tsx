import { Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop, Text as SvgText } from "react-native-svg";

// Shirt drawn on a 100×100 canvas: body, two sleeves, V collar, cuffs.
const SHIRT =
  "M34 7 L15 14 L2 35 L15 45 L24 37 L24 91 Q24 96 29 96 L71 96 Q76 96 76 91 L76 37 L85 45 L98 35 L85 14 L66 7 Q50 19 34 7 Z";
const LEFT_SLEEVE = "M31 8 L15 14 L2 35 L15 45 L24 37 L26 21 Z";
const RIGHT_SLEEVE = "M69 8 L85 14 L98 35 L85 45 L76 37 L74 21 Z";
const COLLAR = "M34 7 Q50 19 66 7";
const LEFT_CUFF = "M3.5 36.5 L14.5 44";
const RIGHT_CUFF = "M96.5 36.5 L85.5 44";

/** Football shirt in the team's kit colours, with the shirt number. */
export function Jersey({
  body,
  sleeves,
  numberColor,
  number,
  captain,
  goals,
  faded,
  size = 50,
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
  // Trim colour: the sleeve colour when it differs from the body, else a darker edge
  const trim = sleeves.toLowerCase() !== body.toLowerCase() ? sleeves : "rgba(0,0,0,0.28)";
  return (
    <View style={{ width: size, height: size, opacity: faded ? 0.45 : 1 }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="shade" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
            <Stop offset="0.45" stopColor="#ffffff" stopOpacity="0" />
            <Stop offset="1" stopColor="#000000" stopOpacity="0.16" />
          </LinearGradient>
        </Defs>
        <Path d={SHIRT} fill={body} />
        <Path d={LEFT_SLEEVE} fill={sleeves} />
        <Path d={RIGHT_SLEEVE} fill={sleeves} />
        <Path d={LEFT_CUFF} stroke={trim} strokeWidth={4} strokeLinecap="round" />
        <Path d={RIGHT_CUFF} stroke={trim} strokeWidth={4} strokeLinecap="round" />
        <Path d={SHIRT} fill="url(#shade)" />
        <Path d={COLLAR} stroke={trim} strokeWidth={5} fill="none" strokeLinecap="round" />
        <Path d={SHIRT} fill="none" stroke="rgba(0,0,0,0.32)" strokeWidth={2} strokeLinejoin="round" />
        <SvgText
          x="50"
          y="72"
          textAnchor="middle"
          fontSize={number >= 10 ? 30 : 34}
          fontWeight="800"
          fill={numberColor}
          stroke="rgba(0,0,0,0.18)"
          strokeWidth={0.8}
        >
          {number}
        </SvgText>
      </Svg>
      {goals ? (
        <View style={{ position: "absolute", right: -6, top: -4, flexDirection: "row", alignItems: "center", backgroundColor: "white", borderRadius: 10, paddingHorizontal: 3, paddingVertical: 1 }}>
          <Text style={{ fontSize: 10 }}>⚽</Text>
          {goals > 1 && <Text style={{ fontSize: 10, fontWeight: "800", color: "#0B1220" }}>{goals}</Text>}
        </View>
      ) : null}
      {captain ? (
        <View style={{ position: "absolute", left: -4, bottom: 2, width: 16, height: 16, borderRadius: 8, backgroundColor: "#FACC15", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 9, fontWeight: "900", color: "#0B1220" }}>C</Text>
        </View>
      ) : null}
    </View>
  );
}
