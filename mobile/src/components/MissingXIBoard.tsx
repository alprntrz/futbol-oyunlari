import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { FORMATIONS } from "@/lib/formations";
import type { Difficulty, Match, SlotState } from "@/lib/types";

import { useI18n } from "~/lib/i18n";
import { C, F } from "~/lib/theme";

import { GuessSheet } from "./GuessSheet";
import { Jersey } from "./Jersey";
import { Button, Tap } from "./ui";

const SLOT_W = 86;
const SLOT_H = 58;

/** Scoreboard + pitch + footer + guess sheet for one Eksik 11 game. */
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

  return (
    <View style={{ width: "100%" }}>
      <View style={styles.scoreboard}>
        <Text style={styles.competition}>
          {match.competition[locale]} · {match.season}
        </Text>
        <View style={styles.scoreRow}>
          <Text style={styles.team} numberOfLines={1} adjustsFontSizeToFit>
            {match.team}
          </Text>
          <View style={styles.score}>
            <Text style={styles.scoreText}>{match.score}</Text>
          </View>
          <Text style={styles.opponent} numberOfLines={1} adjustsFontSizeToFit>
            {match.opponent}
          </Text>
        </View>
        <Text style={styles.date}>
          {match.date} · {match.team} {t("guessThe")}
        </Text>
        {headerExtra}
      </View>

      <View style={[styles.pitch, { height: pitchH || undefined }]} onLayout={(e) => setPitchW(e.nativeEvent.layout.width)}>
        {Array.from({ length: 8 }, (_, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: i % 2 ? C.pitchB : C.pitchA }} />
        ))}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={[styles.line, { top: "50%", left: 0, right: 0, height: 2 }]} />
          <View style={[styles.circle, { left: pitchW / 2 - 44, top: pitchH / 2 - 44 }]} />
          <View style={[styles.box, { top: -2, borderTopWidth: 0, left: pitchW / 2 - 80 }]} />
          <View style={[styles.box, { bottom: -2, borderBottomWidth: 0, left: pitchW / 2 - 80 }]} />
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
                <View
                  style={[
                    styles.label,
                    s.solved ? styles.labelSolved : s.failed ? styles.labelFailed : styles.labelOpen,
                  ]}
                >
                  {revealed ? (
                    <Text style={[styles.labelText, { color: s.solved || s.failed ? "white" : "#27272a" }]} numberOfLines={1} adjustsFontSizeToFit>
                      {p.name}
                    </Text>
                  ) : (
                    <Text style={[styles.labelText, { color: "#71717a", letterSpacing: 1.5 }]} numberOfLines={1}>
                      {p.answer
                        .slice(0, 12)
                        .split("")
                        .map((ch) => (ch === " " ? " " : "·"))
                        .join("")}
                      {s.guesses.length > 0 ? ` ${s.guesses.length}` : ""}
                    </Text>
                  )}
                </View>
              </Tap>
            );
          })}
      </View>

      <View style={styles.footer}>
        <Text style={styles.count}>
          {solved}
          <Text style={{ color: C.textMute }}>/11</Text>
          <Text style={styles.guesses}>
            {"   "}
            {t("totalGuesses")}: {totalGuesses}
          </Text>
        </Text>
        {!done && <Button title={t("giveUp")} color={C.red} onPress={() =>
              Alert.alert(t("giveUp"), t("giveUpConfirm"), [
                { text: t("cancel"), style: "cancel" },
                { text: t("giveUp"), style: "destructive", onPress: onGiveUp },
              ])
            } style={{ paddingVertical: 9 }} />}
      </View>

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

const styles = StyleSheet.create({
  scoreboard: { alignItems: "center", marginBottom: 10 },
  competition: { color: C.emeraldLight, fontFamily: F.bold, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", textAlign: "center" },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4, maxWidth: "100%" },
  team: { color: C.text, fontFamily: F.black, fontSize: 18, flexShrink: 1 },
  opponent: { color: C.textDim, fontFamily: F.bold, fontSize: 18, flexShrink: 1 },
  score: { backgroundColor: C.surface2, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  scoreText: { color: C.emeraldLight, fontFamily: F.black, fontSize: 17, fontVariant: ["tabular-nums"] },
  date: { color: C.textMute, fontFamily: F.body, fontSize: 12, marginTop: 2 },
  pitch: { width: "100%", aspectRatio: 3 / 4, borderRadius: 14, borderWidth: 4, borderColor: C.pitchBorder, overflow: "hidden" },
  line: { position: "absolute", backgroundColor: "rgba(255,255,255,0.6)" },
  circle: { position: "absolute", width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderColor: "rgba(255,255,255,0.6)" },
  box: { position: "absolute", width: 160, height: 52, borderWidth: 2, borderColor: "rgba(255,255,255,0.6)" },
  slot: { position: "absolute", width: SLOT_W, height: SLOT_H, alignItems: "center", justifyContent: "flex-start", gap: 2 },
  label: { minWidth: 44, maxWidth: SLOT_W, borderRadius: 3, borderWidth: 1, paddingHorizontal: 4, paddingVertical: 2 },
  labelOpen: { backgroundColor: "white", borderColor: "#3f3f46" },
  labelSolved: { backgroundColor: C.emerald, borderColor: "#065f46" },
  labelFailed: { backgroundColor: "rgba(239,68,68,0.92)", borderColor: "#991b1b" },
  labelText: { fontFamily: F.black, fontSize: 10, textAlign: "center" },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  count: { color: C.text, fontFamily: F.black, fontSize: 20 },
  guesses: { color: C.textDim, fontFamily: F.body, fontSize: 13 },
});
