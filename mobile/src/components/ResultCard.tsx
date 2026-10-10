import { Image, Share, StyleSheet, Text, View } from "react-native";

import type { Match, SlotState } from "@/lib/types";

import { BRAND } from "~/lib/brand";
import { useI18n } from "~/lib/i18n";
import { T } from "~/lib/theme";

import { Button, Card } from "./ui";

/** End-of-game summary with native share sheet (emoji grid like the web app). */
export function ResultCard({
  match,
  slots,
  won,
  day,
  onNewMatch,
}: {
  match: Match;
  slots: SlotState[];
  won: boolean;
  day?: number;
  onNewMatch?: () => void;
}) {
  const { t } = useI18n();
  const solved = slots.filter((s) => s.solved).length;
  const totalGuesses = slots.reduce((a, s) => a + s.guesses.length, 0);

  const share = () => {
    const rows = slots
      .map((s) => (s.solved ? (s.guesses.length <= 2 ? "🟩" : s.guesses.length <= 4 ? "🟨" : "🟧") : "🟥"))
      .join("");
    const title = day !== undefined ? `Eksik 11 #${day}` : `Eksik 11 · ${match.team}`;
    Share.share({ message: `${title}\n${rows}\n${solved}/11 · ${totalGuesses} ${t("guessesWord")}` });
  };

  return (
    <Card style={styles.card}>
      <Image source={won ? BRAND.illus.win : BRAND.illus.finish} style={styles.illus} resizeMode="contain" />
      <Text style={[T.title, { textAlign: "center", marginTop: 12 }]}>{won ? t("won") : `${solved}/11 ${t("resultFound")}`}</Text>
      <Text style={[T.body, { marginTop: 4 }]}>
        {t("totalGuesses")}: {totalGuesses}
      </Text>
      <View style={styles.buttons}>
        <Button title={t("share")} icon="square.and.arrow.up" kind={onNewMatch ? "secondary" : "primary"} onPress={share} style={{ flex: 1 }} />
        {onNewMatch && <Button title={t("newMatch")} icon="arrow.clockwise" onPress={onNewMatch} style={{ flex: 1 }} />}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 16, alignItems: "center", padding: 20 },
  illus: { width: 200, height: 110 },
  buttons: { flexDirection: "row", gap: 10, marginTop: 18, alignSelf: "stretch" },
});
