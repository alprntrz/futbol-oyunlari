import { Stack } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { GridPlayer } from "@/data/players";
import { generateGrid, searchPlayers, validateCell, type Criterion, type Grid } from "@/lib/tiki";

import { HelpButton } from "~/components/HelpButton";
import { Text } from "~/components/Text";
import { Confetti } from "~/components/motion";
import { Button, Card, Icon, Page, Tap } from "~/components/ui";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { C, F, R, shadow, T } from "~/lib/theme";

type Mark = "X" | "O";
interface Cell {
  mark: Mark;
  player: GridPlayer;
}

const TURN_SECONDS = 45;
const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];
const MARK: Record<Mark, { color: string; soft: string }> = {
  X: { color: C.blue, soft: C.blueSoft },
  O: { color: C.coral, soft: C.coralSoft },
};

function initials(name: string) {
  const t = name.trim().split(/\s+/);
  return ((t[0]?.[0] ?? "") + (t.length > 1 ? t[t.length - 1][0] : "")).toUpperCase();
}
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360}, 45%, 48%)`;
}

/** Readable text colour on a crest: the club's 2nd colour unless it is too close to the 1st. */
function crestText(c: Criterion) {
  const lum = (hex = "#000000") => {
    const n = parseInt(hex.slice(1), 16);
    return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  };
  if (Math.abs(lum(c.c1) - lum(c.c2)) > 0.35) return c.c2;
  return lum(c.c1) > 0.6 ? "#111111" : "#ffffff";
}

function Crest({ c, size = 30 }: { c: Criterion; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 3, backgroundColor: c.c1, borderWidth: 1, borderColor: "rgba(0,0,0,0.1)", alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: crestText(c), fontWeight: "800", fontSize: size * 0.3 }}>{c.short}</Text>
    </View>
  );
}

function CriterionBadge({ c, size }: { c: Criterion; size?: number }) {
  return c.kind === "club" ? <Crest c={c} size={size} /> : <Text style={{ fontSize: (size ?? 30) * 0.8 }}>{c.icon}</Text>;
}

/** The mark in a winning square, pulsing. */
function WinPulse({ color, mark }: { color: string; mark: Mark }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.set(withRepeat(withSequence(withTiming(1.25, { duration: 380 }), withTiming(1, { duration: 380 })), -1));
  }, [scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return <Animated.Text style={[styles.mark, { color }, style]}>{mark}</Animated.Text>;
}

function winnerOf(board: (Cell | null)[]): { mark: Mark; line: number[] } | null {
  for (const line of LINES) {
    const [a, b, c] = line.map((i) => board[i]);
    if (a && b && c && a.mark === b.mark && b.mark === c.mark) return { mark: a.mark, line };
  }
  return null;
}

export default function TikiTakaToeScreen() {
  const { t, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const [grid, setGrid] = useState<Grid>(generateGrid);
  const [board, setBoard] = useState<(Cell | null)[]>(() => Array(9).fill(null));
  const [turn, setTurn] = useState<Mark>("X");
  const [used, setUsed] = useState<Set<string>>(() => new Set());
  const [winner, setWinner] = useState<Mark | "draw" | null>(null);
  const [openCell, setOpenCell] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [confetti, setConfetti] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TURN_SECONDS);
  const [deadline, setDeadline] = useState(() => Date.now() + TURN_SECONDS * 1000);
  // Explicit cell sizes keep header and board columns exactly aligned
  const [gridW, setGridW] = useState(0);
  const cellW = gridW ? (gridW - 3 * 6) / 4.1 : 0;
  const size = (n: number) => (cellW ? { width: cellW * n, height: cellW } : null);
  const resetClock = () => {
    setDeadline(Date.now() + TURN_SECONDS * 1000);
    setTimeLeft(TURN_SECONDS);
  };

  const label = (c: Criterion) => (locale === "tr" ? c.tr : c.en);
  const suggestions = useMemo(() => searchPlayers(input), [input]);
  const winningLine = useMemo(() => winnerOf(board)?.line ?? null, [board]);

  const passTurn = (message: string) => {
    setFlash(`${turn}: ${message}`);
    setOpenCell(null);
    setInput("");
    setTurn((m) => (m === "X" ? "O" : "X"));
    resetClock();
  };

  // Per-turn countdown from a deadline; at zero the turn passes
  useEffect(() => {
    if (winner) return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setTimeLeft(left);
      if (left === 0) {
        haptic.warning();
        passTurn(t("ttTimeout"));
      }
    }, 250);
    return () => clearInterval(id);
    // passTurn/t only change with turn/locale, which restart the interval anyway
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline, winner, turn]);

  function newGrid() {
    setGrid(generateGrid());
    setBoard(Array(9).fill(null));
    setTurn("X");
    setUsed(new Set());
    setWinner(null);
    setOpenCell(null);
    setInput("");
    setFlash(null);
    resetClock();
  }

  function submit(text?: string) {
    const guess = (text ?? input).trim();
    if (openCell === null || !guess) return;
    const row = grid.rows[Math.floor(openCell / 3)];
    const col = grid.cols[openCell % 3];
    const player = validateCell(guess, row, col, used);
    if (!player) {
      haptic.error();
      passTurn(t("ttWrong"));
      return;
    }
    const next = board.slice();
    next[openCell] = { mark: turn, player };
    setBoard(next);
    setUsed(new Set(used).add(player.name));
    setOpenCell(null);
    setInput("");
    setFlash(null);

    let win: Mark | "draw" | null = winnerOf(next)?.mark ?? null;
    if (!win && next.every(Boolean)) {
      const x = next.filter((c) => c?.mark === "X").length;
      win = x === 9 - x ? "draw" : x > 9 - x ? "X" : "O";
    }
    if (win) {
      haptic.success();
      setWinner(win);
      if (win !== "draw") setConfetti(Date.now());
    } else {
      haptic.press();
      setTurn((m) => (m === "X" ? "O" : "X"));
      resetClock();
    }
  }

  const low = timeLeft <= 10;
  const row = openCell !== null ? grid.rows[Math.floor(openCell / 3)] : null;
  const col = openCell !== null ? grid.cols[openCell % 3] : null;

  return (
    <Page>
      <Stack.Screen options={{ title: t("tikiTakaName"), headerRight: () => <HelpButton game="tiki" /> }} />

      {/* Whose turn */}
      {winner ? (
        <Card style={[styles.winner, { backgroundColor: winner === "draw" ? C.amberSoft : MARK[winner].soft }]}>
          <Icon name="trophy.fill" size={26} color={winner === "draw" ? C.amber : MARK[winner].color} fallback="🏆" />
          <Text style={[T.title, { color: winner === "draw" ? C.text : MARK[winner].color }]}>
            {winner === "draw" ? t("ttDraw") : `${winner} ${t("ttWins")}`}
          </Text>
        </Card>
      ) : (
        <Card style={{ padding: 14 }}>
          <View style={styles.players}>
            {(["X", "O"] as Mark[]).map((m) => {
              const active = turn === m;
              return (
                <View key={m} style={[styles.playerPill, { backgroundColor: active ? MARK[m].color : MARK[m].soft }]}>
                  <Text style={[styles.playerMark, { color: active ? "white" : MARK[m].color }]}>{m}</Text>
                  {active && <Text style={styles.playerTime}>{timeLeft}s</Text>}
                </View>
              );
            })}
          </View>
          <View style={styles.bar}>
            <View style={{ height: "100%", width: `${(timeLeft / TURN_SECONDS) * 100}%`, backgroundColor: low ? C.red : MARK[turn].color, borderRadius: 3 }} />
          </View>
          <Text style={[T.body, { textAlign: "center", marginTop: 10, color: C.text }]}>
            <Text style={{ fontWeight: "800", color: MARK[turn].color }}>
              {t("ttTurn")}: {turn}
            </Text>{" "}
            · {t("ttPick")}
          </Text>
          {flash ? <Text style={[T.caption, { textAlign: "center", color: C.red, marginTop: 4 }]}>{flash}</Text> : null}
        </Card>
      )}

      {/* Grid */}
      <View style={styles.grid} onLayout={(e) => setGridW(e.nativeEvent.layout.width)}>
        <View style={styles.row}>
          <View style={[styles.corner, size(1.1)]} />
          {grid.cols.map((c, i) => (
            <View key={i} style={[styles.cell, styles.head, size(1)]}>
              <CriterionBadge c={c} />
              <Text style={styles.headLabel} numberOfLines={2} adjustsFontSizeToFit>
                {label(c)}
              </Text>
            </View>
          ))}
        </View>
        {grid.rows.map((r, ri) => (
          <View key={ri} style={styles.row}>
            <View style={[styles.corner, styles.head, size(1.1)]}>
              <CriterionBadge c={r} />
              <Text style={styles.headLabel} numberOfLines={2} adjustsFontSizeToFit>
                {label(r)}
              </Text>
            </View>
            {grid.cols.map((_, ci) => {
              const idx = ri * 3 + ci;
              const cell = board[idx];
              const inWin = winningLine?.includes(idx);
              return (
                <Tap
                  key={ci}
                  disabled={!!cell || !!winner}
                  onPress={() => {
                    setOpenCell(idx);
                    setInput("");
                    setFlash(null);
                  }}
                  style={[
                    styles.cell,
                    styles.play,
                    size(1),
                    cell && { backgroundColor: MARK[cell.mark].soft, borderColor: MARK[cell.mark].soft },
                    inWin && { borderColor: MARK[cell!.mark].color },
                  ]}
                >
                  {cell ? (
                    <Animated.View entering={ZoomIn.springify().damping(9)} style={{ alignItems: "center" }}>
                      {inWin ? <WinPulse color={MARK[cell.mark].color} mark={cell.mark} /> : <Text style={[styles.mark, { color: MARK[cell.mark].color }]}>{cell.mark}</Text>}
                      <Text style={styles.cellName} numberOfLines={2}>
                        {cell.player.name}
                      </Text>
                    </Animated.View>
                  ) : (
                    <Icon name="plus" size={20} color="#C3C9D3" fallback="+" />
                  )}
                </Tap>
              );
            })}
          </View>
        ))}
      </View>

      <Button title={t("ttNewGrid")} kind={winner ? "primary" : "secondary"} icon="arrow.clockwise" onPress={newGrid} style={{ marginTop: 18 }} />

      {/* Guess sheet */}
      <Modal visible={openCell !== null} transparent animationType="slide" onRequestClose={() => setOpenCell(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={{ flex: 1, backgroundColor: "rgba(11,18,32,0.35)" }} onPress={() => setOpenCell(null)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.grabber} />
            {row && col && (
              <View style={styles.pair}>
                <View style={styles.chip}>
                  <CriterionBadge c={row} size={22} />
                  <Text style={styles.chipText}>{label(row)}</Text>
                </View>
                <Icon name="plus" size={14} color={C.text3} fallback="+" />
                <View style={styles.chip}>
                  <CriterionBadge c={col} size={22} />
                  <Text style={styles.chipText}>{label(col)}</Text>
                </View>
              </View>
            )}
            <Text style={[T.caption, { textAlign: "center", marginVertical: 12, color: MARK[turn].color, fontWeight: "700" }]}>
              {turn} · {t("ttYourGuess")} · {timeLeft}s
            </Text>
            <View style={styles.inputWrap}>
              <Icon name="magnifyingglass" size={16} color={C.text3} fallback="🔎" />
              <TextInput
                autoFocus
                value={input}
                onChangeText={setInput}
                onSubmitEditing={() => (suggestions.length === 1 ? submit(suggestions[0].name) : submit())}
                placeholder={t("ttPlaceholder")}
                placeholderTextColor={C.text3}
                autoCorrect={false}
                autoCapitalize="words"
                returnKeyType="done"
                style={styles.input}
              />
            </View>
            {input.trim().length >= 2 && (
              <ScrollView style={styles.suggestions} keyboardShouldPersistTaps="handled">
                {suggestions.length === 0 ? (
                  <Text style={[T.body, { textAlign: "center", padding: 14 }]}>{t("ttNoResult")}</Text>
                ) : (
                  suggestions.map((p, i) => (
                    <Tap
                      key={p.name}
                      disabled={used.has(p.name)}
                      onPress={() => submit(p.name)}
                      style={[styles.suggestion, i > 0 && styles.suggestionDivider, used.has(p.name) && { opacity: 0.4 }]}
                    >
                      <View style={[styles.avatar, { backgroundColor: avatarColor(p.name) }]}>
                        <Text style={styles.avatarText}>{initials(p.name)}</Text>
                      </View>
                      <Text style={[T.headline, { flex: 1, fontSize: 15 }]}>{p.name}</Text>
                      {used.has(p.name) && <Icon name="checkmark" size={14} color={C.text3} fallback="✓" />}
                    </Tap>
                  ))
                )}
              </ScrollView>
            )}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <Button title={t("close")} kind="secondary" onPress={() => setOpenCell(null)} style={{ flex: 1 }} />
              <Button title={t("ttSubmit")} onPress={() => submit()} style={{ flex: 1 }} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <Confetti fire={confetti} />
    </Page>
  );
}

const styles = StyleSheet.create({
  winner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 20 },
  players: { flexDirection: "row", gap: 10 },
  playerPill: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, paddingVertical: 10 },
  playerMark: { fontFamily: F.black, fontSize: 30, lineHeight: 32 },
  playerTime: { color: "white", fontFamily: F.display, fontSize: 24, fontVariant: ["tabular-nums"] },
  bar: { height: 6, borderRadius: 3, backgroundColor: "#E2E6EC", marginTop: 12, overflow: "hidden" },
  grid: { width: "100%", gap: 6, marginTop: 16 },
  row: { flexDirection: "row", gap: 6 },
  corner: { borderRadius: 14 },
  cell: { borderRadius: 14 },
  head: { backgroundColor: C.card, alignItems: "center", justifyContent: "center", gap: 4, padding: 4, ...shadow, shadowOpacity: 0.04 },
  headLabel: { color: C.text2, fontSize: 10, fontWeight: "700", textAlign: "center" },
  play: { backgroundColor: C.card, borderWidth: 2, borderColor: C.border, borderStyle: "dashed", alignItems: "center", justifyContent: "center", padding: 3 },
  mark: { fontFamily: F.black, fontSize: 40, lineHeight: 42 },
  cellName: { color: C.text, fontSize: 9, fontWeight: "600", textAlign: "center" },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 16, paddingTop: 8 },
  grabber: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: "#D5DAE1", marginBottom: 14 },
  pair: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, flexWrap: "wrap" },
  chip: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  chipText: { color: C.text, fontWeight: "700", fontSize: 14 },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.bg, borderRadius: R.button, paddingHorizontal: 12 },
  input: { flex: 1, paddingVertical: 13, fontSize: 16, color: C.text },
  suggestions: { maxHeight: 230, marginTop: 10, borderRadius: R.button, borderWidth: 1, borderColor: C.border },
  suggestion: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 9 },
  suggestionDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "white", fontWeight: "800", fontSize: 12 },
});
