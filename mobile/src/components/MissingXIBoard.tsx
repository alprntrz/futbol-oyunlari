import { useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { FORMATIONS } from "@/lib/formations";
import { teamName } from "@/lib/teams";
import type { Difficulty, LineupPlayer, Match, SlotState } from "@/lib/types";
import { answerLetters } from "@/lib/wordle";

import { useI18n } from "~/lib/i18n";
import { jerseyStyle, keeperKit, teamKit } from "~/lib/kits";
import { C, F, R, T } from "~/lib/theme";

import { GuessSheet } from "./GuessSheet";
import { Jersey } from "./Jersey";
import { FLIP_DURATION, FLIP_STAGGER } from "./LetterTile";
import { Text } from "./Text";
import { ComboBurst, ComboChip, comboColor } from "./Combo";
import { Confetti } from "./motion";
import { Button, Card, Tap } from "./ui";

const SLOT_W = 86;
/** Shirts fade in once when the board opens: quick, no travel. */
const SHIRT_ENTER = (i: number) => FadeIn.duration(160).delay(i * 12);
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
  onNext,
  combo = 0,
  headerExtra,
}: {
  match: Match;
  difficulty: Difficulty;
  slots: SlotState[];
  done: boolean;
  totalGuesses: number;
  onGuess: (idx: number, guess: string) => void;
  onGiveUp: () => void;
  /** practice modes: "Next match" under the pitch once the game is over */
  onNext?: () => void;
  /** current run of right guesses (useCombo) */
  combo?: number;
  headerExtra?: React.ReactNode;
}) {
  const { t, locale } = useI18n();
  const [openSlot, setOpenSlot] = useState<number | null>(null);
  const [pitchW, setPitchW] = useState(0);
  // The pitch takes what's left of the screen so the whole board (and the button under it)
  // fits without scrolling: 3:4 at most, never shorter than 360 pt on small phones.
  const { height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pitchRef = useRef<View>(null);
  const [pitchTop, setPitchTop] = useState(0);
  const below = 12 + 52 + 16 + insets.bottom; // gap + button + breathing room
  // once the game is over the result card sits above and the page scrolls: full size again
  const pitchH = !pitchW ? 0 : done ? Math.round((pitchW * 4) / 3) : Math.round(Math.min((pitchW * 4) / 3, Math.max(360, screenH - pitchTop - below)));
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
    bar.set(withTiming(solved / 11, { duration: 220 }));
  }, [solved, bar]);
  const barStyle = useAnimatedStyle(() => ({ width: `${bar.get() * 100}%` }));

  const confirmGiveUp = () =>
    Alert.alert(t("giveUp"), t("giveUpConfirm"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("giveUp"), style: "destructive", onPress: onGiveUp },
    ]);

  const rival = teamKit(match.opponent);

  return (
    <View style={{ width: "100%" }}>
      {/* Match */}
      <Card style={{ paddingVertical: 10, paddingHorizontal: 14 }}>
        <View style={styles.metaRow}>
          <Text style={T.caption} numberOfLines={1}>
            {match.competition[locale]}
          </Text>
          <Text style={T.caption}>{match.date}</Text>
        </View>
        {/* both sides the same way: shirt over name; one-word names shrink to fit instead of breaking */}
        <View style={styles.scoreRow}>
          <View style={styles.side}>
            <Jersey body={match.kit.body} sleeves={match.kit.sleeves} numberColor={match.kit.number} number={11} variant={style} size={30} hideNumber />
            <TeamName name={teamName(match.team, locale)} />
          </View>
          <Text style={styles.score}>{match.score}</Text>
          <View style={styles.side}>
            <Jersey body={rival.body} sleeves={rival.sleeves} pattern={rival.pattern} numberColor="#000" number={0} variant={style} size={30} hideNumber />
            <TeamName name={teamName(match.opponent, locale)} muted />
          </View>
        </View>
        {/* found so far: a slim bar with the count, inside the card (frees a row for the pitch) */}
        <View style={styles.progressRow}>
          <View style={styles.bar}>
            <Animated.View style={[styles.barFill, { backgroundColor: comboColor(combo) }, barStyle]} />
          </View>
          {combo >= 2 && <ComboChip combo={combo} />}
          <Text style={styles.count}>
            <Text style={{ color: C.green }}>{solved}</Text>/11
          </Text>
        </View>
        {headerExtra}
      </Card>

      {/* Pitch */}
      <View
        ref={pitchRef}
        style={[styles.pitch, pitchH ? { height: pitchH } : { aspectRatio: 3 / 4 }]}
        onLayout={(e) => {
          setPitchW(e.nativeEvent.layout.width);
          pitchRef.current?.measureInWindow((_x, y) => setPitchTop(y));
        }}
      >
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

      {!done && <Button title={t("giveUp")} kind="danger" icon="flag.fill" onPress={confirmGiveUp} style={{ marginTop: 12 }} />}
      {done && onNext && <Button title={t("nextMatch")} icon="arrow.right" onPress={onNext} style={{ marginTop: 12 }} />}

      <ComboBurst combo={combo} hold={openSlot !== null} />

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

/** A team name that wraps between words but never inside one. */
function TeamName({ name, muted }: { name: string; muted?: boolean }) {
  const words = name.trim().split(/\s+/).length;
  return (
    <Text style={[styles.team, muted && styles.opponent]} numberOfLines={words > 1 ? 2 : 1} adjustsFontSizeToFit minimumFontScale={0.7}>
      {name}
    </Text>
  );
}

const styles = StyleSheet.create({
  metaRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
  side: { flex: 1, alignItems: "center", gap: 2 },
  team: { fontFamily: F.display, fontSize: 17, color: C.text, lineHeight: 19, textAlign: "center" },
  opponent: { color: C.text2 },
  score: { fontFamily: F.black, fontSize: 26, color: C.text, fontVariant: ["tabular-nums"] },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  count: { fontFamily: F.display, fontSize: 17, color: C.text3, fontVariant: ["tabular-nums"] },
  bar: { flex: 1, height: 8, borderRadius: 4, backgroundColor: "#DDE4DF", overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 5, backgroundColor: C.green },
  pitch: { width: "100%", borderRadius: R.card, overflow: "hidden", marginTop: 10 },
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
