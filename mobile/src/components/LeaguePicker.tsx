import { ScrollView, StyleSheet, View } from "react-native";

import { useI18n } from "~/lib/i18n";
import { C, F } from "~/lib/theme";

import { Flag } from "./Flag";
import { Text } from "./Text";
import { Icon, Tap } from "./ui";

export interface PickerItem {
  id: string;
  name: { tr: string; en: string };
  flag?: string;
  icon?: "europe" | "national";
  /** small line under the name, e.g. a match count */
  note?: string;
}

/** Round badge: the country's flag, or a symbol for the all / cups / national-team options. */
export function LeagueBadge({ item, size = 34 }: { item: PickerItem; size?: number }) {
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2 }]}>
      {item.flag ? (
        <Flag id={item.flag} width={size * 1.45} />
      ) : (
        <Icon name={item.icon === "europe" ? "star.circle.fill" : item.icon === "national" ? "globe.europe.africa.fill" : "soccerball"} size={size * 0.62} color={C.greenDark} fallback="⚽" />
      )}
    </View>
  );
}

/** Horizontal row of league chips; the selected one is filled. */
export function LeaguePicker({ items, value, onChange }: { items: PickerItem[]; value: string; onChange: (id: string) => void }) {
  const { locale } = useI18n();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.scroll}>
      {items.map((it) => {
        const on = it.id === value;
        return (
          <Tap
            key={it.id}
            onPress={() => onChange(it.id)}
            style={[styles.chip, on && styles.chipOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={it.name[locale]}
          >
            <LeagueBadge item={it} size={24} />
            <Text style={[styles.chipText, on && { color: "white" }]}>{it.name[locale]}</Text>
          </Tap>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { marginHorizontal: -16 },
  row: { gap: 8, paddingHorizontal: 16 },
  badge: { overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: C.greenSoft },
  chip: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.card, borderRadius: 999, borderWidth: 1, borderColor: C.border, paddingLeft: 6, paddingRight: 14, paddingVertical: 6 },
  chipOn: { backgroundColor: C.greenMid, borderColor: C.greenMid },
  chipText: { fontFamily: F.display, fontSize: 17, color: C.text },
});
