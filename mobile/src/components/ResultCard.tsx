import { Share, StyleSheet, Text, View } from "react-native";

import type { Match, SlotState } from "@/lib/types";

import { useI18n } from "~/lib/i18n";
import { C, F } from "~/lib/theme";

import { Button } from "./ui";

/** End-of-game panel with native share sheet (emoji grid like the web app). */
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
  const totalGuesses = slots.reduce((a, s) => a + s.guesses.length, 0);

  const share = () => {
    const rows = slots
      .map((s) => (s.solved ? (s.guesses.length <= 2 ? "🟩" : s.guesses.length <= 4 ? "🟨" : "🟧") : "🟥"))
      .join("");
    const title = day !== undefined ? `Eksik 11 #${day}` : `Eksik 11 · ${match.team}`;
    Share.share({ message: `${title}\n${rows}\n${totalGuesses} ${t("guessesWord")}` });
  };

  return (
    <View style={styles.card}>
      <Text style={[styles.title, { color: won ? C.emeraldLight : "#f87171" }]}>{won ? t("won") : t("lost")}</Text>
      <Text style={styles.sub}>
        {t("totalGuesses")}: <Text style={{ color: C.text, fontFamily: F.black }}>{totalGuesses}</Text>
      </Text>
      <View style={styles.buttons}>
        <Button title={t("share")} color={C.emerald} onPress={share} style={{ flex: 1 }} />
        {onNewMatch && <Button title={t("newMatch")} onPress={onNewMatch} style={{ flex: 1 }} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 16, borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, padding: 16, alignItems: "center" },
  title: { fontFamily: F.black, fontSize: 17, textAlign: "center" },
  sub: { color: C.textDim, fontFamily: F.body, fontSize: 13, marginTop: 4 },
  buttons: { flexDirection: "row", gap: 10, marginTop: 14, alignSelf: "stretch" },
});
