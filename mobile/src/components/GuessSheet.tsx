import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Difficulty, LineupPlayer, TileMark } from "@/lib/types";
import { answerLetters, evaluateGuess, keyboardState } from "@/lib/wordle";

import { useI18n } from "~/lib/i18n";
import { haptic } from "~/lib/haptics";
import { C, F } from "~/lib/theme";

import { Keyboard } from "./Keyboard";

const GAP = 4;
const WORD_GAP = 10;

function Tile({ ch, mark, size }: { ch: string; mark?: TileMark; size: number }) {
  const bg = mark === "correct" ? C.tileCorrect : mark === "present" ? C.tilePresent : mark === "absent" ? C.tileAbsent : "transparent";
  const border = mark ? bg : ch ? "#a1a1aa" : "#52525b";
  const color = mark === "present" ? "black" : mark === "absent" ? "#d4d4d8" : "white";
  return (
    <View style={[styles.tile, { width: size, height: size, backgroundColor: bg, borderColor: border }]}>
      <Text style={{ color, fontFamily: F.black, fontSize: size * 0.5 }}>{ch}</Text>
    </View>
  );
}

/**
 * Bottom sheet with Wordle rows + keyboard for one lineup slot. Tiles shrink to
 * fit the screen width, so long surnames (up to 17 letters) never overflow.
 */
export function GuessSheet({
  player: openPlayer,
  difficulty,
  pastGuesses: openGuesses,
  onGuess,
  onClose,
}: {
  player: LineupPlayer | null;
  difficulty: Difficulty;
  pastGuesses: string[];
  onGuess: (guess: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [current, setCurrent] = useState("");
  // Keep showing the last slot while the sheet slides out after it closes
  const [shown, setShown] = useState({ player: openPlayer, pastGuesses: openGuesses });
  if (openPlayer && (openPlayer !== shown.player || openGuesses !== shown.pastGuesses)) {
    if (openPlayer !== shown.player) setCurrent("");
    setShown({ player: openPlayer, pastGuesses: openGuesses });
  }
  const { player, pastGuesses } = shown;
  const shakeX = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.get() }] }));

  const display = player?.answer ?? "";
  const answer = answerLetters(display);
  const maxGuesses = difficulty === "hard" ? 4 : 6;
  const spaces = display.split(" ").length - 1;
  const usable = Math.min(width, 520) - 32 - (answer.length - 1) * GAP - spaces * WORD_GAP;
  const tileSize = Math.max(14, Math.min(46, Math.floor(usable / Math.max(answer.length, 1))));

  const showHint = difficulty === "normal" && pastGuesses.length >= 3 && !pastGuesses.some((g) => g[0] === answer[0]);

  const shake = () => {
    haptic.error();
    shakeX.set(
      withSequence(
      withTiming(-8, { duration: 50 }),
      withTiming(8, { duration: 50 }),
      withTiming(-5, { duration: 50 }),
      withTiming(5, { duration: 50 }),
        withTiming(0, { duration: 50 })
      )
    );
  };

  const handleKey = (key: string) => {
    if (key === "ENTER") {
      if (current.length !== answer.length) return shake();
      onGuess(current);
      setCurrent("");
    } else if (key === "DELETE") setCurrent((c) => c.slice(0, -1));
    else setCurrent((c) => (c.length < answer.length ? c + key : c));
  };

  const row = (letters: string, marks?: TileMark[], hintFirst?: boolean) => {
    let li = -1;
    return display.split("").map((ch, j) => {
      if (ch === " ") return <View key={j} style={{ width: WORD_GAP - GAP }} />;
      li++;
      const letter = hintFirst && li === 0 && !letters ? answer[0] : (letters[li] ?? "");
      return <Tile key={j} ch={letter} mark={marks?.[li]} size={tileSize} />;
    });
  };

  return (
    <Modal visible={!!openPlayer} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 10 }]}>
        <View style={styles.grabber} />
        <View style={styles.header}>
          <Text style={styles.headerText}>
            #{player?.number} · {answer.length} {t("letters")} · {maxGuesses - pastGuesses.length}/{maxGuesses} {t("guessesLeft")}
          </Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={{ color: C.textDim, fontSize: 18 }}>✕</Text>
          </Pressable>
        </View>

        <View style={styles.rows}>
          {pastGuesses.map((g, i) => (
            <View key={i} style={styles.row}>
              {row(g, evaluateGuess(g, answer))}
            </View>
          ))}
          <Animated.View style={[styles.row, shakeStyle]}>{row(current, undefined, showHint)}</Animated.View>
          {showHint && <Text style={styles.hint}>💡 {answer[0]}…</Text>}
        </View>

        <Keyboard onKey={handleKey} marks={keyboardState(pastGuesses, answer)} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
    backgroundColor: "#18181b",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  grabber: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: "#52525b", marginBottom: 8 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 6, marginBottom: 12 },
  headerText: { color: C.textDim, fontFamily: F.bold, fontSize: 13 },
  rows: { alignItems: "center", gap: 6, marginBottom: 16 },
  row: { flexDirection: "row", gap: GAP },
  tile: { borderWidth: 2, borderRadius: 5, alignItems: "center", justifyContent: "center" },
  hint: { color: C.amber, fontFamily: F.bold, fontSize: 12 },
});
