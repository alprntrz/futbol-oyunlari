import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";

import { loadHistory, type MatchRecord } from "~/lib/history";
import { useI18n } from "~/lib/i18n";
import { C, F, T } from "~/lib/theme";

import { Text } from "./Text";
import { Card, SectionLabel } from "./ui";

const SHOWN = 8;

/** Profile: the last two-player matches (this phone only). Hidden until there is one. */
export function RecentMatches() {
  const { t, locale } = useI18n();
  const [list, setList] = useState<MatchRecord[]>([]);
  useFocusEffect(
    useCallback(() => {
      loadHistory().then(setList);
    }, [])
  );
  if (list.length === 0) return null;

  const game = { ht: t("tikiTakaName"), pp: t("ppName"), dz: t("dzName"), rd: "Rondo", wm: t("wmName") };
  const date = (at: number) => new Date(at).toLocaleDateString(locale === "tr" ? "tr-TR" : "en-GB", { day: "numeric", month: "short" });

  return (
    <>
      <SectionLabel>{t("recentMatches")}</SectionLabel>
      <Card style={{ paddingVertical: 4 }}>
        {list.slice(0, SHOWN).map((m, i) => {
          const tone = m.result === "win" ? C.green : m.result === "loss" ? C.red : "#E3A008";
          return (
            <View key={m.key} style={[styles.row, i > 0 && styles.divider]}>
              <View style={[styles.badge, { backgroundColor: tone }]}>
                <Text style={styles.badgeText}>{t(m.result === "win" ? "resultW" : m.result === "loss" ? "resultL" : "resultD")}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={T.headline} numberOfLines={1}>
                  {m.opponent || t("opponent")}
                </Text>
                <Text style={T.caption}>
                  {game[m.game]} · {date(m.at)}
                </Text>
              </View>
              <Text style={styles.score}>{m.score}</Text>
            </View>
          );
        })}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  badge: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  badgeText: { color: "white", fontFamily: F.display, fontSize: 15 },
  score: { fontFamily: F.display, fontSize: 18, color: C.text, fontVariant: ["tabular-nums"] },
});
