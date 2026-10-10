import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Card, Icon, Page, SectionLabel } from "~/components/ui";
import { useI18n } from "~/lib/i18n";
import { loadStats, type GameStats } from "~/lib/storage";
import { C, T } from "~/lib/theme";

export default function StatsTab() {
  const { t } = useI18n();
  const [s, setS] = useState<GameStats | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadStats().then(setS);
    }, [])
  );

  const winRate = s && s.played ? Math.round((s.won / s.played) * 100) : 0;

  return (
    <Page topInset>
      <Text style={T.largeTitle}>{t("tabStats")}</Text>
      <SectionLabel>{t("statsDailyTitle")}</SectionLabel>

      {s && s.played === 0 ? (
        <Card style={{ alignItems: "center", paddingVertical: 32, gap: 12 }}>
          <Icon name="chart.bar" size={36} color={C.text3} fallback="📊" />
          <Text style={[T.body, { textAlign: "center" }]}>{t("noStatsYet")}</Text>
        </Card>
      ) : (
        <>
          <Card style={styles.streak}>
            <Icon name="flame.fill" size={34} color={C.amber} fallback="🔥" />
            <View style={{ flex: 1 }}>
              <Text style={styles.streakValue}>{s?.streak ?? 0}</Text>
              <Text style={T.caption}>{t("streak")}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[T.headline, { fontSize: 20 }]}>{s?.bestStreak ?? 0}</Text>
              <Text style={T.caption}>{t("bestStreak")}</Text>
            </View>
          </Card>
          <View style={styles.grid}>
            {[
              [s?.played ?? 0, t("played"), "gamecontroller.fill", C.blue],
              [`${winRate}%`, t("winRate"), "trophy.fill", C.green],
            ].map(([v, label, icon, color]) => (
              <Card key={label as string} style={styles.tile}>
                <Icon name={icon as "trophy.fill"} size={20} color={color as string} />
                <Text style={styles.tileValue}>{v}</Text>
                <Text style={T.caption}>{label}</Text>
              </Card>
            ))}
          </View>
        </>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  streak: { flexDirection: "row", alignItems: "center", gap: 14, padding: 20 },
  streakValue: { fontSize: 34, fontWeight: "800", color: C.text },
  grid: { flexDirection: "row", gap: 12, marginTop: 12 },
  tile: { flex: 1, gap: 6, padding: 18 },
  tileValue: { fontSize: 28, fontWeight: "800", color: C.text },
});
