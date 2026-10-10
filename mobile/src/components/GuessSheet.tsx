import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Difficulty, LineupPlayer, TileMark } from "@/lib/types";
import { answerLetters, evaluateGuess, keyboardState } from "@/lib/wordle";

import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { C, T } from "~/lib/theme";

import { TileLegend } from "./HowTo";
import { Keyboard } from "./Keyboard";
import { Icon } from "./ui";

const GAP = 5;
const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);
const WORD_GAP = 12;
const MARK_BG: Record<TileMark, string> = { correct: C.tileCorrect, present: C.tilePresent, absent: C.tileAbsent };

function Tile({ ch, mark, size, hint }: { ch: string; mark?: TileMark; size: number; hint?: boolean }) {
  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size },
        mark ? { backgroundColor: MARK_BG[mark], borderColor: MARK_BG[mark] } : ch ? { borderColor: "#9AA3B2" } : null,
      ]}
    >
      <Text style={{ color: mark ? "white" : hint ? C.text3 : C.text, fontWeight: "800", fontSize: size * 0.5 }}>{ch}</Text>
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
  const left = maxGuesses - pastGuesses.length;
  const spaces = display.split(" ").length - 1;
  const usable = Math.min(width, 560) - 40 - (answer.length - 1) * GAP - spaces * WORD_GAP;
  const tileSize = Math.max(16, Math.min(48, Math.floor(usable / Math.max(answer.length, 1))));

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
      const isHint = !!hintFirst && li === 0 && !letters;
      return <Tile key={j} ch={isHint ? answer[0] : (letters[li] ?? "")} mark={marks?.[li]} size={tileSize} hint={isHint} />;
    });
  };

  return (
    <Modal visible={!!openPlayer} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 10 }]}>
        <View style={styles.grabber} />
        <View style={styles.header}>
          <View style={styles.numberBadge}>
            <Text style={styles.numberText}>{player?.number}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={T.headline}>
              {answer.length} {t("letters")}
            </Text>
            <Text style={T.caption}>
              {capitalize(t("guessesLeft"))}: {left}/{maxGuesses}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} style={styles.close}>
            <Icon name="xmark" size={14} color={C.text2} fallback="✕" />
          </Pressable>
        </View>

        <View style={styles.rows}>
          {pastGuesses.map((g, i) => (
            <View key={i} style={styles.row}>
              {row(g, evaluateGuess(g, answer))}
            </View>
          ))}
          <Animated.View style={[styles.row, shakeStyle]}>{row(current, undefined, showHint)}</Animated.View>
        </View>

        <View style={{ alignItems: "center", marginBottom: 14 }}>
          <TileLegend compact />
        </View>

        <Keyboard onKey={handleKey} marks={keyboardState(pastGuesses, answer)} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(11,18,32,0.35)" },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 12, paddingTop: 8 },
  grabber: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: "#D5DAE1", marginBottom: 10 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 8, marginBottom: 16 },
  numberBadge: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.greenSoft, alignItems: "center", justifyContent: "center" },
  numberText: { color: C.greenDark, fontWeight: "800", fontSize: 16 },
  close: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
  rows: { alignItems: "center", gap: GAP, marginBottom: 14 },
  row: { flexDirection: "row", gap: GAP },
  tile: { borderWidth: 2, borderColor: "#D5DAE1", borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: C.card },
});
