import { Stack } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { GridPlayer } from "@/data/players";
import { generateGrid, searchPlayers, validateCell, type Criterion, type Grid } from "@/lib/tiki";

import { Screen } from "~/components/Screen";
import { Button, Tap } from "~/components/ui";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { C, F } from "~/lib/theme";

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
const MARK_COLOR: Record<Mark, string> = { X: C.indigoLight, O: C.roseLight };

function initials(name: string) {
  const t = name.trim().split(/\s+/);
  return ((t[0]?.[0] ?? "") + (t.length > 1 ? t[t.length - 1][0] : "")).toUpperCase();
}
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360}, 42%, 38%)`;
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

function Crest({ c, size = 28 }: { c: Criterion; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: 6, backgroundColor: c.c1, borderWidth: 1, borderColor: (c.c2 ?? "#fff") + "55", alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: crestText(c), fontFamily: F.black, fontSize: size * 0.32 }}>{c.short}</Text>
    </View>
  );
}

function CriterionHeader({ c, label }: { c: Criterion; label: string }) {
  return (
    <View style={styles.header}>
      {c.kind === "club" ? <Crest c={c} /> : <Text style={{ fontSize: 22 }}>{c.icon}</Text>}
      <Text style={styles.headerLabel} numberOfLines={2} adjustsFontSizeToFit>
        {label}
      </Text>
    </View>
  );
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
  const [timeLeft, setTimeLeft] = useState(TURN_SECONDS);
  const [deadline, setDeadline] = useState(() => Date.now() + TURN_SECONDS * 1000);
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
    <Screen>
      <Stack.Screen options={{ title: t("tikiTakaName") }} />

      <View style={styles.status}>
        {winner ? (
          <Text style={styles.winner}>{winner === "draw" ? t("ttDraw") : `${winner} ${t("ttWins")}`}</Text>
        ) : (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
              <View style={[styles.turn, { backgroundColor: turn === "X" ? C.indigo : C.rose }]}>
                <Text style={styles.turnText}>
                  {t("ttTurn")}: {turn}
                </Text>
              </View>
              <Text style={[styles.timer, low && { color: "#f43f5e" }]}>
                {timeLeft}
                <Text style={styles.timerUnit}> {t("secondsShort")}</Text>
              </Text>
            </View>
            <View style={styles.bar}>
              <View style={{ height: "100%", width: `${(timeLeft / TURN_SECONDS) * 100}%`, backgroundColor: low ? "#f43f5e" : C.indigo }} />
            </View>
            {flash ? <Text style={styles.flash}>{flash}</Text> : null}
          </>
        )}
      </View>

      <View style={styles.grid}>
        <View style={styles.row}>
          <View style={styles.corner} />
          {grid.cols.map((c, i) => (
            <View key={i} style={[styles.cell, styles.headCell]}>
              <CriterionHeader c={c} label={label(c)} />
            </View>
          ))}
        </View>
        {grid.rows.map((r, ri) => (
          <View key={ri} style={styles.row}>
            <View style={[styles.corner, styles.headCell]}>
              <CriterionHeader c={r} label={label(r)} />
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
                  style={[styles.cell, styles.playCell, cell && styles.filled, inWin && styles.win]}
                >
                  {cell ? (
                    <>
                      <Text style={[styles.mark, { color: MARK_COLOR[cell.mark] }]}>{cell.mark}</Text>
                      <Text style={styles.cellName} numberOfLines={2}>
                        {cell.player.name}
                      </Text>
                    </>
                  ) : (
                    <Text style={{ color: "#52525b", fontSize: 26 }}>+</Text>
                  )}
                </Tap>
              );
            })}
          </View>
        ))}
      </View>

      <Button title={t("ttNewGrid")} outline onPress={newGrid} style={{ marginTop: 16, paddingVertical: 9 }} />
      <Text style={styles.hint}>{t("ttHint")}</Text>

      <Modal visible={openCell !== null} transparent animationType="slide" onRequestClose={() => setOpenCell(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)" }} onPress={() => setOpenCell(null)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.grabber} />
            {row && col && (
              <View style={styles.pair}>
                <View style={styles.chip}>
                  {row.kind === "club" ? <Crest c={row} size={20} /> : <Text>{row.icon}</Text>}
                  <Text style={styles.chipText}>{label(row)}</Text>
                </View>
                <Text style={{ color: C.textMute }}>×</Text>
                <View style={styles.chip}>
                  {col.kind === "club" ? <Crest c={col} size={20} /> : <Text>{col.icon}</Text>}
                  <Text style={styles.chipText}>{label(col)}</Text>
                </View>
              </View>
            )}
            <Text style={[styles.yourGuess, { color: MARK_COLOR[turn] }]}>
              {turn} — {t("ttYourGuess")} · {timeLeft} {t("secondsShort")}
            </Text>
            <TextInput
              autoFocus
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => (suggestions.length === 1 ? submit(suggestions[0].name) : submit())}
              placeholder={t("ttPlaceholder")}
              placeholderTextColor={C.textMute}
              autoCorrect={false}
              autoCapitalize="words"
              returnKeyType="done"
              style={styles.input}
            />
            {input.trim().length >= 2 && (
              <ScrollView style={styles.suggestions} keyboardShouldPersistTaps="handled">
                {suggestions.length === 0 ? (
                  <Text style={styles.noResult}>{t("ttNoResult")}</Text>
                ) : (
                  suggestions.map((p) => (
                    <Tap key={p.name} disabled={used.has(p.name)} onPress={() => submit(p.name)} style={[styles.suggestion, used.has(p.name) && { opacity: 0.4 }]}>
                      <View style={[styles.avatar, { backgroundColor: avatarColor(p.name) }]}>
                        <Text style={styles.avatarText}>{initials(p.name)}</Text>
                      </View>
                      <Text style={styles.suggestionName}>{p.name}</Text>
                      {used.has(p.name) && <Text style={{ color: C.textMute }}>✓</Text>}
                    </Tap>
                  ))
                )}
              </ScrollView>
            )}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <Button title={t("close")} outline onPress={() => setOpenCell(null)} style={{ flex: 1 }} />
              <Button title={t("ttSubmit")} onPress={() => submit()} style={{ flex: 1 }} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  status: { alignItems: "center", gap: 8, minHeight: 112, justifyContent: "center", marginBottom: 12 },
  winner: { color: C.text, fontFamily: F.black, fontSize: 26 },
  turn: { borderRadius: 999, paddingHorizontal: 18, paddingVertical: 6 },
  turnText: { color: "white", fontFamily: F.black, fontSize: 16 },
  timer: { color: C.text, fontFamily: F.black, fontSize: 44, fontVariant: ["tabular-nums"] },
  timerUnit: { color: C.textMute, fontSize: 14 },
  bar: { width: 220, height: 7, borderRadius: 4, backgroundColor: C.surface2, overflow: "hidden" },
  flash: { color: C.roseLight, fontFamily: F.bold, fontSize: 12 },
  grid: { width: "100%", gap: 6 },
  row: { flexDirection: "row", gap: 6 },
  corner: { flex: 1.1, aspectRatio: 1, borderRadius: 10 },
  cell: { flex: 1, aspectRatio: 1, borderRadius: 10 },
  headCell: { backgroundColor: C.surface2 },
  playCell: { borderWidth: 2, borderColor: C.border, backgroundColor: "rgba(24,24,27,0.6)", alignItems: "center", justifyContent: "center", padding: 3 },
  filled: { backgroundColor: C.surface },
  win: { borderColor: C.emerald, backgroundColor: "rgba(6,78,59,0.45)" },
  header: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4, padding: 3 },
  headerLabel: { color: "#e4e4e7", fontFamily: F.bold, fontSize: 10, textAlign: "center" },
  mark: { fontFamily: F.black, fontSize: 30, lineHeight: 34 },
  cellName: { color: "#d4d4d8", fontFamily: F.body, fontSize: 9, textAlign: "center" },
  hint: { color: C.textMute, fontFamily: F.body, fontSize: 12, textAlign: "center", marginTop: 12, lineHeight: 17 },
  sheet: { backgroundColor: C.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingTop: 8 },
  grabber: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: "#52525b", marginBottom: 12 },
  pair: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, flexWrap: "wrap" },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.surface2, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  chipText: { color: C.text, fontFamily: F.bold, fontSize: 13 },
  yourGuess: { textAlign: "center", fontFamily: F.bold, fontSize: 12, marginVertical: 10 },
  input: { backgroundColor: C.surface2, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontFamily: F.bold, fontSize: 16 },
  suggestions: { maxHeight: 220, marginTop: 8, borderRadius: 10, borderWidth: 1, borderColor: C.surface2 },
  noResult: { color: C.textMute, fontFamily: F.body, fontSize: 13, textAlign: "center", padding: 12 },
  suggestion: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10, paddingVertical: 8 },
  avatar: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "rgba(255,255,255,0.9)", fontFamily: F.black, fontSize: 11 },
  suggestionName: { flex: 1, color: C.text, fontFamily: F.bold, fontSize: 14 },
});
