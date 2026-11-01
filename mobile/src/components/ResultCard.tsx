import { Image, StyleSheet, View } from "react-native";

import type { Match, SlotState } from "@/lib/types";
import { teamName } from "@/lib/teams";

import { BRAND } from "~/lib/brand";
import { useI18n } from "~/lib/i18n";
import { T } from "~/lib/theme";

import { useShareCard, type Mark } from "./ShareCard";
import { Text } from "./Text";
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
  const { t, locale } = useI18n();
  const { share: shareCard, card: shareView } = useShareCard();
  const solved = slots.filter((s) => s.solved).length;
  const totalGuesses = slots.reduce((a, s) => a + s.guesses.length, 0);

  const share = () => {
    const marks = slots.map((s): Mark => (s.solved ? (s.guesses.length <= 2 ? "ok" : s.guesses.length <= 4 ? "mid" : "late") : "miss"));
    const emoji: Record<Mark, string> = { ok: "🟩", mid: "🟨", late: "🟧", miss: "🟥", empty: "⬜" };
    const title = day !== undefined ? `Eksik 11 #${day}` : `Eksik 11 · ${teamName(match.team, locale)}`;
    const detail = `${totalGuesses} ${t("guessesWord")}`;
    shareCard({
      game: "xi",
      name: day !== undefined ? "Eksik 11" : `Eksik 11 · ${teamName(match.team, locale)}`,
      tag: day !== undefined ? `#${day}` : undefined,
      rows: linesOf(match.formation, marks),
      score: `${solved}/11`,
      detail,
      text: `${title}\n${marks.map((m) => emoji[m]).join("")}\n${solved}/11 · ${detail}`,
    });
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
      {shareView}
    </Card>
  );
}

/** The lineup's marks as the team lines, attack on top, each line left to right as on the pitch ("4-3-3" → 3, 3, 4, GK). */
function linesOf(formation: string, marks: Mark[]): Mark[][] {
  const counts = formation.split("-").map(Number);
  const lines: Mark[][] = [];
  let i = 1;
  for (const n of counts) {
    // slots run from the team's right (the viewer's right) to its left
    lines.push(marks.slice(i, i + n).reverse());
    i += n;
  }
  return [...lines.reverse(), [marks[0]]];
}

const styles = StyleSheet.create({
  card: { marginTop: 16, alignItems: "center", padding: 20 },
  illus: { width: 200, height: 110 },
  buttons: { flexDirection: "row", gap: 10, marginTop: 18, alignSelf: "stretch" },
});
