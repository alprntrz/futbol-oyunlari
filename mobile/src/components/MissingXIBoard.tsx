import { useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { FORMATIONS } from "@/lib/formations";
import type { Difficulty, LineupPlayer, Match, SlotState } from "@/lib/types";
import { answerLetters } from "@/lib/wordle";

import { useI18n } from "~/lib/i18n";
import { jerseyStyle, keeperKit } from "~/lib/kits";
import { C, F, R, T } from "~/lib/theme";

import { GuessSheet } from "./GuessSheet";
import { Jersey } from "./Jersey";
import { FLIP_DURATION, FLIP_STAGGER } from "./LetterTile";
import { Text } from "./Text";
import { Confetti, PopNumber } from "./motion";
import { Button, Card, Icon, Tap } from "./ui";

const SLOT_W = 86;
/** Shirts drop in once when the board opens: short travel, one soft settle. */
const SHIRT_ENTER = (i: number) => FadeInDown.delay(40 + i * 30).springify().damping(20).stiffness(220).withInitialValues({ transform: [{ translateY: -10 }] });
const SLOT_H = 72;

/** How long the sheet stays open after a slot resolves: the tile flip, then a beat. */
const closeDelay = (answer: string, solved: boolean) => answerLetters(answer).length * FLIP_STAGGER + FLIP_DURATION + (solved ? 350 : 700);

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
  const won = slots.every((s) => s.solved);
  const style = jerseyStyle(match);
  const keeper = keeperKit(match.kit);

  // Close the sheet once the flip of the resolving guess has played
  const open = openSlot !== null ? slots[openSlot] : null;
  useEffect(() => {
    if (openSlot === null || !open) return;
    if (done || open.solved || open.failed) {
      const timer = setTimeout(() => setOpenSlot(null), closeDelay(match.lineup[openSlot].answer, open.solved));
      return () => clearTimeout(timer);
    }
  }, [open, openSlot, done, match.lineup]);

  // Confetti when the last name falls (not when a finished game is reopened)
  const [confetti, setConfetti] = useState(0);
  const wasWon = useRef(won);
  useEffect(() => {
    if (won && !wasWon.current) {
      const last = slots.findIndex((s, i) => s.solved && s.guesses.length > 0 && i === openSlot);
      const delay = last >= 0 ? closeDelay(match.lineup[last].answer, true) : 400;
      const timer = setTimeout(() => setConfetti(Date.now()), delay);
      wasWon.current = true;
      return () => clearTimeout(timer);
    }
    wasWon.current = won;
  }, [won, slots, openSlot, match.lineup]);

  // Progress bar slides to the new value
  const bar = useSharedValue(solved / 11);
  useEffect(() => {
    bar.set(withSpring(solved / 11, { damping: 16, stiffness: 120 }));
  }, [solved, bar]);
  const barStyle = useAnimatedStyle(() => ({ width: `${bar.get() * 100}%` }));

  const confirmGiveUp = () =>
    Alert.alert(t("giveUp"), t("giveUpConfirm"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("giveUp"), style: "destructive", onPress: onGiveUp },
    ]);

  return (
    <View style={{ width: "100%" }}>
      {/* Match */}
      <Card style={{ padding: 16 }}>
        <View style={styles.metaRow}>
          <Text style={T.caption} numberOfLines={1}>
            {match.competition[locale]}
          </Text>
          <Text style={T.caption}>{match.date}</Text>
        </View>
        <View style={styles.scoreRow}>
          <View style={styles.teamSide}>
            <Jersey body={match.kit.body} sleeves={match.kit.sleeves} numberColor={match.kit.number} number={11} variant={style} size={34} hideNumber />
            <Text style={styles.team} numberOfLines={2}>
              {match.team}
            </Text>
          </View>
          <Text style={styles.score}>{match.score}</Text>
          <Text style={[styles.team, styles.opponent]} numberOfLines={2}>
            {match.opponent}
          </Text>
        </View>
        {headerExtra}
      </Card>

      {/* Progress */}
      <View style={styles.progressRow}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
          <PopNumber value={solved} style={styles.bigCount} />
          <Text style={styles.countOf}>/11</Text>
          <Text style={[T.body, { marginLeft: 4 }]}>{t("found")}</Text>
        </View>
        <Text style={T.caption}>
          {t("totalGuesses")} <Text style={{ fontFamily: F.display, fontSize: 16, color: C.text2 }}>{totalGuesses}</Text>
        </Text>
      </View>
      <View style={styles.bar}>
        <Animated.View style={[styles.barFill, barStyle]} />
      </View>

      {!done && totalGuesses === 0 && (
        <View style={styles.hint}>
          <Icon name="hand.tap.fill" size={15} color={C.green} fallback="👆" />
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
          match.lineup.map((p, i) => (
            <Slot
              key={i}
              index={i}
              player={p}
              state={slots[i]}
              done={done}
              left={(positions[i].x / 100) * pitchW - SLOT_W / 2}
              top={(positions[i].y / 100) * pitchH - SLOT_H / 2}
              kit={i === 0 ? { ...keeper, variant: "keeper" as const } : { ...match.kit, variant: style }}
              onPress={() => setOpenSlot(i)}
            />
          ))}
      </View>

      {!done && <Button title={t("giveUp")} kind="ghost" icon="flag" onPress={confirmGiveUp} style={{ marginTop: 8, alignSelf: "center" }} />}

      <GuessSheet
        player={openSlot !== null && !done ? match.lineup[openSlot] : null}
        difficulty={difficulty}
        pastGuesses={openSlot !== null ? slots[openSlot].guesses : []}
        onGuess={(g) => openSlot !== null && onGuess(openSlot, g)}
        onClose={() => setOpenSlot(null)}
      />
      <Confetti fire={confetti} />
    </View>
  );
}

/** One shirt on the pitch: drops in at mount, bounces when its name is found. */
function Slot({
  index,
  player,
  state,
  done,
  left,
  top,
  kit,
  onPress,
}: {
  index: number;
  player: LineupPlayer;
  state: SlotState;
  done: boolean;
  left: number;
  top: number;
  kit: { body: string; sleeves: string; number: string; variant: "keeper" | ReturnType<typeof jerseyStyle> };
  onPress: () => void;
}) {
  const { t } = useI18n();
  const revealed = state.solved || done;
  const locked = done || state.solved || state.failed;

  return (
    <Animated.View entering={SHIRT_ENTER(index)} style={[styles.slot, { left, top }]}>
      <Tap
        disabled={locked}
        onPress={onPress}
        style={{ alignItems: "center", gap: 3 }}
        accessibilityLabel={
          revealed ? `${player.number}, ${player.name}` : `${player.number}, ${answerLetters(player.answer).length} ${t("letters")}`
        }
      >
        <View>
          <Jersey
            variant={kit.variant}
            body={kit.body}
            sleeves={kit.sleeves}
            numberColor={kit.number}
            number={player.number}
            captain={player.captain}
            goals={player.goals}
            faded={state.failed && !done}
          />
        </View>
        <View style={[styles.label, state.solved ? { backgroundColor: C.green } : state.failed ? { backgroundColor: C.red } : null]}>
          {revealed ? (
            <Text style={[styles.labelText, { color: state.solved || state.failed ? "white" : C.text }]} numberOfLines={1} adjustsFontSizeToFit>
              {player.name}
            </Text>
          ) : (
            <View style={styles.blanksRow}>
              <Blanks answer={player.answer} />
              {state.guesses.length > 0 && <Text style={styles.tries}>{state.guesses.length}</Text>}
            </View>
          )}
        </View>
      </Tap>
    </Animated.View>
  );
}

const BLANKS_W = SLOT_W - 14;

/**
 * One small rounded cell per letter, like a miniature of the guess tiles, with
 * a wider gap between words ("DI MARIA" → ▢▢ ▢▢▢▢▢).
 */
function Blanks({ answer }: { answer: string }) {
  const letters = answer.replace(/ /g, "").length;
  const words = answer.split(" ").length;
  const GAP = 2;
  const WORD = 5;
  const w = Math.max(3, Math.min(7, (BLANKS_W - (letters - words) * GAP - (words - 1) * WORD) / letters));
  return (
    <View style={{ flexDirection: "row", gap: WORD, alignItems: "center" }}>
      {answer.split(" ").map((word, wi) => (
        <View key={wi} style={{ flexDirection: "row", gap: GAP }}>
          {word.split("").map((_, i) => (
            <View key={i} style={[styles.cell, { width: w }]} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  metaRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  teamSide: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  team: { flex: 1, fontFamily: F.display, fontSize: 22, color: C.text, lineHeight: 24 },
  opponent: { color: C.text3, textAlign: "right" },
  score: { fontFamily: F.black, fontSize: 30, color: C.text, fontVariant: ["tabular-nums"] },
  progressRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 18, marginHorizontal: 4 },
  bigCount: { fontFamily: F.black, fontSize: 40, lineHeight: 42, color: C.green },
  countOf: { fontFamily: F.display, fontSize: 22, color: C.text3 },
  bar: { height: 10, borderRadius: 5, backgroundColor: "#DDE4DF", marginTop: 6, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 5, backgroundColor: C.green },
  hint: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, paddingHorizontal: 4 },
  hintText: { flex: 1, color: C.text2, fontWeight: "600", fontSize: 14 },
  pitch: { width: "100%", aspectRatio: 3 / 4, borderRadius: R.card, overflow: "hidden", marginTop: 12 },
  line: { position: "absolute", backgroundColor: C.pitchLine },
  circle: { position: "absolute", width: 80, height: 80, borderRadius: 40, borderWidth: 1.5, borderColor: C.pitchLine },
  box: { position: "absolute", width: 152, height: 48, borderWidth: 1.5, borderColor: C.pitchLine },
  slot: { position: "absolute", width: SLOT_W, height: SLOT_H, alignItems: "center" },
  label: { maxWidth: SLOT_W, backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  labelText: { fontSize: 10, fontWeight: "700", textAlign: "center" },
  cell: { height: 9, borderRadius: 2, backgroundColor: "#D3E4D9", borderBottomWidth: 2, borderBottomColor: C.greenMid },
  blanksRow: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 3 },
  tries: { fontFamily: F.display, fontSize: 11, color: "white", backgroundColor: C.text2, borderRadius: 6, paddingHorizontal: 4, overflow: "hidden" },
});
