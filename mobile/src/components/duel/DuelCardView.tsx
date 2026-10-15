import { StyleSheet, View } from "react-native";

import type { DuelCard } from "@/lib/duel";

import { C, F } from "~/lib/theme";

import { Flag } from "../Flag";
import { ClubShirt } from "../HatTrickBoard";
import { clubCriterion, STAR_FRAME, surname } from "../taktik/Card";
import { Text } from "../Text";
import { Icon, Tap } from "../ui";

/**
 * A Card Duel card: the country's flag behind the main club's shirt, the
 * surname underneath, a bronze / silver / gold frame for its tier. `value`
 * shows the revealed number for the round; `back` = face down.
 */
export function DuelCardView({
  card,
  width,
  value,
  result,
  used,
  selected,
  back,
  onPress,
}: {
  card: DuelCard | null;
  width: number;
  value?: string;
  result?: "win" | "lose" | "draw";
  used?: boolean;
  selected?: boolean;
  back?: boolean;
  onPress?: () => void;
}) {
  const h = width * 1.36;
  if (back || !card) {
    return (
      <View style={[styles.card, styles.back, { width, height: h }]}>
        <Icon name="questionmark" size={width * 0.3} color="rgba(255,255,255,0.7)" fallback="?" />
      </View>
    );
  }
  const club = clubCriterion(card.club);
  return (
    <Tap
      onPress={onPress}
      disabled={!onPress || used}
      accessibilityLabel={value ? `${card.name}, ${value}` : card.name}
      style={[
        styles.card,
        { width, height: h, borderColor: STAR_FRAME[card.tier], borderWidth: card.tier === 1 ? 2 : 3 },
        selected && styles.selected,
        result === "win" && styles.win,
        used && { opacity: 0.35 },
      ]}
    >
      <View style={styles.flagWrap}>
        <View style={{ transform: [{ scale: 1.25 }] }}>
          <Flag id={card.country} width={width} />
        </View>
        <View style={styles.shirt}>{club ? <ClubShirt c={club} size={width * 0.46} /> : null}</View>
      </View>
      <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55} style={[styles.name, { fontSize: Math.max(10, width * 0.15) }]}>
        {surname(card.name)}
      </Text>
      {value !== undefined && (
        <View style={[styles.value, result === "lose" && { backgroundColor: C.text3 }, result === "draw" && { backgroundColor: "#E3A008" }]}>
          <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit style={[styles.valueText, { fontSize: Math.max(12, width * 0.2) }]}>
            {value}
          </Text>
        </View>
      )}
      {used && (
        <View style={styles.usedTag}>
          <Text allowFontScaling={false} style={styles.usedText}>
            ✓
          </Text>
        </View>
      )}
    </Tap>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "white", borderRadius: 12, overflow: "hidden" },
  back: { backgroundColor: C.greenDark, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(255,255,255,0.25)" },
  selected: { transform: [{ translateY: -8 }], shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 5 }, elevation: 8 },
  win: { shadowColor: "#FACC15", shadowOpacity: 0.9, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 10 },
  flagWrap: { flex: 1, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: "#E3E8E4" },
  shirt: { position: "absolute", bottom: 2, alignSelf: "center" },
  name: { fontFamily: F.display, color: C.text, textAlign: "center", paddingHorizontal: 4, paddingVertical: 4 },
  value: { position: "absolute", top: 6, alignSelf: "center", backgroundColor: C.green, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2, maxWidth: "92%" },
  valueText: { fontFamily: F.black, color: "white" },
  usedTag: { position: "absolute", top: 4, right: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: C.text, alignItems: "center", justifyContent: "center" },
  usedText: { color: "white", fontSize: 11, fontWeight: "800" },
});
