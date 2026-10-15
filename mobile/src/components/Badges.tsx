import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";

import { loadBadges, type Badge } from "~/lib/cosmetics";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { usePlayStreak } from "~/lib/playStreak";
import { C, F, T } from "~/lib/theme";

import { Text } from "./Text";
import { Card, Icon, SectionLabel, Tap } from "./ui";

/** Profile: badges earned by playing; tap one to see how to get it. */
export function Badges() {
  const { t } = useI18n();
  const { best } = usePlayStreak();
  const [list, setList] = useState<Badge[]>([]);
  const [open, setOpen] = useState<Badge | null>(null);
  useFocusEffect(
    useCallback(() => {
      loadBadges(best).then(setList);
    }, [best])
  );
  if (list.length === 0) return null;
  const done = list.filter((b) => b.done).length;

  return (
    <>
      <View style={styles.head}>
        <SectionLabel>{t("badgesTitle")}</SectionLabel>
        <Text style={T.caption}>{t("badgesCount").replace("{n}", String(done)).replace("{max}", String(list.length))}</Text>
      </View>
      <Card style={{ paddingVertical: 14 }}>
        <View style={styles.grid}>
          {list.map((b) => (
            <Tap key={b.id} onPress={() => (haptic.tap(), setOpen(open?.id === b.id ? null : b))} style={styles.cell} accessibilityLabel={`${t(`badge_${b.id}`)}, ${b.progress}/${b.target}`}>
              <View style={[styles.medal, { backgroundColor: b.done ? b.color : "#E3E8E4" }, open?.id === b.id && styles.medalOn]}>
                <Icon name={b.icon as never} size={24} color={b.done ? "white" : "#A3ADA6"} fallback="★" />
              </View>
              <Text style={[styles.name, !b.done && { color: C.text3 }]} numberOfLines={1}>
                {t(`badge_${b.id}`)}
              </Text>
              {!b.done && b.target > 1 && (
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${(b.progress / b.target) * 100}%`, backgroundColor: b.color }]} />
                </View>
              )}
            </Tap>
          ))}
        </View>
        {open && (
          <View style={styles.detail}>
            <Text style={T.headline}>{t(`badge_${open.id}`)}</Text>
            <Text style={T.body}>{t(`badgeD_${open.id}`)}</Text>
            <Text style={[T.caption, { marginTop: 2 }]}>
              {open.progress}/{open.target}
            </Text>
          </View>
        )}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 14 },
  cell: { width: "25%", alignItems: "center", gap: 5 },
  medal: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  medalOn: { transform: [{ scale: 1.1 }] },
  name: { fontFamily: F.display, fontSize: 13, color: C.text, textAlign: "center", paddingHorizontal: 2 },
  track: { width: 44, height: 4, borderRadius: 2, backgroundColor: "#E3E8E4", overflow: "hidden" },
  fill: { height: 4, borderRadius: 2 },
  detail: { marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: "#EEF2EF", gap: 2 },
});
