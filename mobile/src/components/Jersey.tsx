import { Text, View } from "react-native";

const EDGE = "rgba(0,0,0,0.18)";

/** Simple rounded shirt in the team's kit colours. */
export function Jersey({
  body,
  sleeves,
  numberColor,
  number,
  captain,
  goals,
  faded,
  size = 44,
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
  const h = size * 0.86;
  const sleeve = { position: "absolute" as const, top: h * 0.06, width: size * 0.3, height: h * 0.36, backgroundColor: sleeves, borderWidth: 1, borderColor: EDGE };
  return (
    <View style={{ width: size, height: h, opacity: faded ? 0.45 : 1 }}>
      <View style={[sleeve, { left: 0, borderTopLeftRadius: 8, borderBottomLeftRadius: 4, transform: [{ rotate: "-12deg" }] }]} />
      <View style={[sleeve, { right: 0, borderTopRightRadius: 8, borderBottomRightRadius: 4, transform: [{ rotate: "12deg" }] }]} />
      <View
        style={{
          position: "absolute",
          left: size * 0.18,
          right: size * 0.18,
          top: 0,
          bottom: 0,
          backgroundColor: body,
          borderWidth: 1,
          borderColor: EDGE,
          borderTopLeftRadius: 6,
          borderTopRightRadius: 6,
          borderBottomLeftRadius: 8,
          borderBottomRightRadius: 8,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: numberColor, fontWeight: "800", fontSize: size * 0.36, fontVariant: ["tabular-nums"] }}>{number}</Text>
      </View>
      {/* collar */}
      <View style={{ position: "absolute", left: size * 0.38, width: size * 0.24, height: h * 0.12, top: 0, backgroundColor: "rgba(0,0,0,0.22)", borderBottomLeftRadius: 8, borderBottomRightRadius: 8 }} />
      {goals ? (
        <View style={{ position: "absolute", right: -8, top: -8, flexDirection: "row", alignItems: "center", backgroundColor: "white", borderRadius: 10, paddingHorizontal: 3, paddingVertical: 1 }}>
          <Text style={{ fontSize: 10 }}>⚽</Text>
          {goals > 1 && <Text style={{ fontSize: 10, fontWeight: "800", color: "#0B1220" }}>{goals}</Text>}
        </View>
      ) : null}
      {captain ? (
        <View style={{ position: "absolute", left: -6, bottom: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: "#FACC15", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 9, fontWeight: "900", color: "#0B1220" }}>C</Text>
        </View>
      ) : null}
    </View>
  );
}
