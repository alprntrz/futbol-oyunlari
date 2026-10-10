import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { FORMATIONS } from "@/lib/formations";
import type { Difficulty, Match, SlotState } from "@/lib/types";

import { useI18n } from "~/lib/i18n";
import { C, R, T } from "~/lib/theme";

import { GuessSheet } from "./GuessSheet";
import { Jersey } from "./Jersey";
import { Button, Card, Icon, Tap } from "./ui";

const SLOT_W = 86;
const SLOT_H = 60;

/** Match card + progress + pitch + guess sheet for one Eksik 11 game. */
export function MissingXIBoard({
  match,
  difficulty,
  slots,
  done,
  totalGuesses,
  onGuess,
  onGiveUp,
  headerExtra,
}: {
  match: Match;
  difficulty: Difficulty;
  slots: SlotState[];
  done: boolean;
  totalGuesses: number;
  onGuess: (idx: number, guess: string) => void;
  onGiveUp: () => void;
  headerExtra?: React.ReactNode;
}) {
  const { t, locale } = useI18n();
  const [openSlot, setOpenSlot] = useState<number | null>(null);
  const [pitchW, setPitchW] = useState(0);
  const pitchH = (pitchW * 4) / 3;
  const positions = FORMATIONS[match.formation];
  const solved = slots.filter((s) => s.solved).length;

  // Close the sheet shortly after its slot resolves (or the game ends)
  const open = openSlot !== null ? slots[openSlot] : null;
  useEffect(() => {
    if (openSlot === null || !open) return;
    if (done || open.solved || open.failed) {
      const timer = setTimeout(() => setOpenSlot(null), open.solved ? 500 : 900);
      return () => clearTimeout(timer);
    }
  }, [open, openSlot, done]);

  const confirmGiveUp = () =>
    Alert.alert(t("giveUp"), t("giveUpConfirm"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("giveUp"), style: "destructive", onPress: onGiveUp },
    ]);

  return (
    <View style={{ width: "100%" }}>
      {/* Match */}
      <Card style={{ padding: 16 }}>
        <Text style={[T.caption, { textAlign: "center" }]} numberOfLines={1}>
          {match.competition[locale]} · {match.season} · {match.date}
        </Text>
        <View style={styles.scoreRow}>
          <Text style={[styles.team, { textAlign: "right" }]} numberOfLines={2}>
            {match.team}
          </Text>
          <View style={styles.score}>
            <Text style={styles.scoreText}>{match.score}</Text>
          </View>
          <Text style={[styles.team, { color: C.text3, fontWeight: "600" }]} numberOfLines={2}>
            {match.opponent}
          </Text>
        </View>
        <View style={styles.findRow}>
          <Icon name="magnifyingglass" size={13} color={C.greenDark} fallback="🔎" />
          <Text style={styles.findText}>
            {t("findXI")} {match.team}
          </Text>
        </View>
        {headerExtra}
      </Card>

      {/* Progress */}
      <View style={styles.progressRow}>
        <Text style={T.headline}>
          {solved}/11 <Text style={[T.body, { fontSize: 15 }]}>{t("found")}</Text>
        </Text>
        <Text style={T.caption}>
          {t("totalGuesses")}: {totalGuesses}
        </Text>
      </View>
      <View style={styles.bar}>
        <View style={[styles.barFill, { width: `${(solved / 11) * 100}%` }]} />
      </View>

      {!done && totalGuesses === 0 && (
        <View style={styles.hint}>
          <Icon name="hand.tap.fill" size={16} color={C.blue} fallback="👆" />
          <Text style={styles.hintText}>{t("tapShirtHint")}</Text>
        </View>
      )}

      {/* Pitch */}
      <View style={styles.pitch} onLayout={(e) => setPitchW(e.nativeEvent.layout.width)}>
        {Array.from({ length: 8 }, (_, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: i % 2 ? C.pitchB : C.pitchA }} />
        ))}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={[styles.line, { top: "50%", left: 0, right: 0, height: 1.5 }]} />
          <View style={[styles.circle, { left: pitchW / 2 - 40, top: pitchH / 2 - 40 }]} />
          <View style={[styles.box, { top: -2, borderTopWidth: 0, left: pitchW / 2 - 76 }]} />
          <View style={[styles.box, { bottom: -2, borderBottomWidth: 0, left: pitchW / 2 - 76 }]} />
        </View>

        {pitchW > 0 &&
          match.lineup.map((p, i) => {
            const pos = positions[i];
            const s = slots[i];
            const revealed = s.solved || done;
            const locked = done || s.solved || s.failed;
            return (
              <Tap
                key={i}
                disabled={locked}
                onPress={() => setOpenSlot(i)}
                style={[styles.slot, { left: (pos.x / 100) * pitchW - SLOT_W / 2, top: (pos.y / 100) * pitchH - SLOT_H / 2 }]}
              >
                <Jersey
                  body={match.kit.body}
                  sleeves={match.kit.sleeves}
                  numberColor={match.kit.number}
                  number={p.number}
                  captain={p.captain}
                  goals={p.goals}
                  faded={s.failed && !done}
                />
                <View style={[styles.label, s.solved ? { backgroundColor: C.green } : s.failed ? { backgroundColor: C.red } : null]}>
                  {revealed ? (
                    <Text style={[styles.labelText, { color: s.solved || s.failed ? "white" : C.text }]} numberOfLines={1} adjustsFontSizeToFit>
                      {p.name}
                    </Text>
                  ) : (
                    <Text style={[styles.labelText, { color: C.text2 }]} numberOfLines={1}>
                      {answerLength(p.answer)} {t("letters")}
                      {s.guesses.length > 0 ? ` · ${s.guesses.length}×` : ""}
                    </Text>
                  )}
                </View>
              </Tap>
            );
          })}
      </View>

      {!done && <Button title={t("giveUp")} kind="ghost" icon="flag" onPress={confirmGiveUp} style={{ marginTop: 8, alignSelf: "center" }} />}

      <GuessSheet
        player={openSlot !== null && !done ? match.lineup[openSlot] : null}
        difficulty={difficulty}
        pastGuesses={openSlot !== null ? slots[openSlot].guesses : []}
        onGuess={(g) => openSlot !== null && onGuess(openSlot, g)}
        onClose={() => setOpenSlot(null)}
      />
    </View>
  );
}

const answerLength = (a: string) => a.replace(/ /g, "").length;

const styles = StyleSheet.create({
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10 },
  team: { flex: 1, fontSize: 17, fontWeight: "800", color: C.text },
  score: { backgroundColor: C.bg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  scoreText: { fontSize: 17, fontWeight: "800", color: C.text, fontVariant: ["tabular-nums"] },
  findRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 12, backgroundColor: C.greenSoft, borderRadius: 10, paddingVertical: 7 },
  findText: { color: C.greenDark, fontWeight: "700", fontSize: 14 },
  progressRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 18, marginHorizontal: 4 },
  bar: { height: 8, borderRadius: 4, backgroundColor: "#E2E6EC", marginTop: 8, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 4, backgroundColor: C.green },
  hint: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, backgroundColor: C.blueSoft, borderRadius: 12, padding: 10 },
  hintText: { flex: 1, color: "#1E40AF", fontWeight: "600", fontSize: 14 },
  pitch: { width: "100%", aspectRatio: 3 / 4, borderRadius: R.card, overflow: "hidden", marginTop: 12 },
  line: { position: "absolute", backgroundColor: C.pitchLine },
  circle: { position: "absolute", width: 80, height: 80, borderRadius: 40, borderWidth: 1.5, borderColor: C.pitchLine },
  box: { position: "absolute", width: 152, height: 48, borderWidth: 1.5, borderColor: C.pitchLine },
  slot: { position: "absolute", width: SLOT_W, height: SLOT_H, alignItems: "center", gap: 3 },
  label: { maxWidth: SLOT_W, backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  labelText: { fontSize: 10, fontWeight: "700", textAlign: "center" },
});
