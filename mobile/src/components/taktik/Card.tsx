import { Image, StyleSheet, View } from "react-native";

import { ALL_CRITERIA } from "@/lib/tiki";
import type { Cost, Pos } from "@/lib/taktik/rules";
import type { ItemId, Unit } from "@/lib/taktik/types";

import { TAKTIK } from "~/lib/brand";
import { useI18n } from "~/lib/i18n";
import { C, F } from "~/lib/theme";

import { Flag } from "../Flag";
import { ClubShirt } from "../HatTrickBoard";
import { Text } from "../Text";
import { Icon, Tap } from "../ui";

/** cost colour: grey, green, blue, purple, gold */
export const COST_COLOR: Record<Cost, string> = { 1: "#8D978F", 2: "#22A55A", 3: "#2F6FE4", 4: "#8B5CF6", 5: "#E3A008" };
/** star level frame: bronze, silver, gold */
export const STAR_FRAME = { 1: "#C9864A", 2: "#A3AFBB", 3: "#F2B705" } as const;

export const surname = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(-1)[0] : parts[0];
};

const CLUB = new Map(ALL_CRITERIA.filter((c) => c.kind === "club").map((c) => [c.id, c]));
export const clubCriterion = (id: string | null) => (id ? CLUB.get(id) : undefined);

export function PosTag({ pos, small }: { pos: Pos; small?: boolean }) {
  const { t } = useI18n();
  return (
    <View style={[styles.pos, small && { paddingHorizontal: 3 }]}>
      <Text allowFontScaling={false} style={[styles.posText, small && { fontSize: 9 }]}>
        {t(`ttkPos_${pos}`)}
      </Text>
    </View>
  );
}

export function ItemIcon({ id, size = 16 }: { id: ItemId; size?: number }) {
  return <Image source={TAKTIK.item[id]} style={{ width: size, height: size }} />;
}

/** A player card: cost band on top, star level as the frame, surname, flag, club shirt, position. */
export function UnitCard({
  unit,
  width,
  selected,
  dim,
  onPress,
}: {
  unit: Pick<Unit, "name" | "cost" | "star" | "pos" | "country" | "club" | "items"> & { scouted?: boolean };
  width: number;
  selected?: boolean;
  dim?: boolean;
  onPress?: () => void;
}) {
  const club = clubCriterion(unit.club);
  const h = width * 1.12;
  return (
    <Tap
      onPress={onPress}
      disabled={!onPress}
      accessibilityLabel={`${unit.name}, ${"★".repeat(unit.star)}`}
      style={[
        styles.card,
        { width, height: h, borderColor: STAR_FRAME[unit.star], borderWidth: unit.star === 1 ? 2 : 3 },
        selected && styles.selected,
        dim && { opacity: 0.45 },
      ]}
    >
      <View style={[styles.band, { backgroundColor: COST_COLOR[unit.cost] }]}>
        <Text allowFontScaling={false} style={styles.stars}>
          {"★".repeat(unit.star)}
        </Text>
      </View>
      <View style={styles.art}>
        {club ? <ClubShirt c={club} size={width * 0.3} /> : <Icon name="tshirt.fill" size={width * 0.3} color={C.text3} fallback="👕" />}
      </View>
      <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[styles.name, { fontSize: Math.max(10, width * 0.17) }]}>
        {surname(unit.name)}
      </Text>
      <View style={styles.foot}>
        <Flag id={unit.country} width={width * 0.24} />
        <PosTag pos={unit.pos} small={width < 60} />
      </View>
      {unit.items.length > 0 && (
        <View style={styles.items}>
          {unit.items.map((it, i) => (
            <ItemIcon key={i} id={it} size={Math.max(12, width * 0.2)} />
          ))}
        </View>
      )}
      {unit.scouted && (
        <View style={styles.scouted}>
          <Icon name="magnifyingglass" size={9} color="white" fallback="🔎" />
        </View>
      )}
    </Tap>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "white", borderRadius: 10, overflow: "hidden", alignItems: "center" },
  selected: { transform: [{ translateY: -4 }], shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  band: { alignSelf: "stretch", height: 12, alignItems: "center", justifyContent: "center" },
  stars: { color: "white", fontSize: 9, lineHeight: 11, fontWeight: "800" },
  art: { flex: 1, alignItems: "center", justifyContent: "center" },
  name: { fontFamily: F.display, color: C.text, paddingHorizontal: 3 },
  foot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", alignSelf: "stretch", paddingHorizontal: 4, paddingBottom: 4, gap: 2 },
  pos: { backgroundColor: C.greenDark, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  posText: { color: "white", fontSize: 10, fontWeight: "800" },
  items: { position: "absolute", top: 13, right: 2, gap: 1 },
  scouted: { position: "absolute", top: 13, left: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: "#7C3AED", alignItems: "center", justifyContent: "center" },
});
