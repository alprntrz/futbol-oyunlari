import { useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import Animated, { Keyframe } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { searchPlayers, validateCell, type Criterion, type Grid } from "@/lib/tiki";

import { haptic } from "~/lib/haptics";
import { TURN_SECONDS, winningLine, type HtCell, type Mark, type Winner } from "~/lib/hattrick";
import { useI18n } from "~/lib/i18n";
import { C, F, R, shadow, T } from "~/lib/theme";

import { Flag } from "./Flag";
import { Jersey } from "./Jersey";
import { Confetti } from "./motion";
import { Text } from "./Text";
import { Button, Card, Icon, Tap } from "./ui";

export const MARK: Record<Mark, { color: string; soft: string }> = {
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

type Kit = { body: string; sleeves: string; pattern?: { color: string; bands: number; horizontal?: boolean } };
const stripes = (color: string, bands = 7) => ({ color, bands });

/** Club home kits for criterion shirts (body, sleeves, stripes/halves/hoops). */
const CLUB_KITS: Record<string, Kit> = {
  realmadrid: { body: "#FFFFFF", sleeves: "#FFFFFF" },
  barcelona: { body: "#A50044", sleeves: "#004D98", pattern: stripes("#004D98", 5) },
  atletico: { body: "#CB3524", sleeves: "#CB3524", pattern: stripes("#FFFFFF") },
  sevilla: { body: "#FFFFFF", sleeves: "#D81920" },
  valencia: { body: "#FFFFFF", sleeves: "#111111" },
  villarreal: { body: "#FFE667", sleeves: "#FFE667" },
  bayern: { body: "#DC052D", sleeves: "#DC052D" },
  dortmund: { body: "#FDE100", sleeves: "#111111" },
  schalke: { body: "#004B9E", sleeves: "#004B9E" },
  leverkusen: { body: "#E32221", sleeves: "#111111" },
  manutd: { body: "#DA291C", sleeves: "#DA291C" },
  mancity: { body: "#6CABDD", sleeves: "#6CABDD" },
  liverpool: { body: "#C8102E", sleeves: "#C8102E" },
  chelsea: { body: "#034694", sleeves: "#034694" },
  arsenal: { body: "#EF0107", sleeves: "#FFFFFF" },
  tottenham: { body: "#FFFFFF", sleeves: "#132257" },
  juventus: { body: "#FFFFFF", sleeves: "#111111", pattern: stripes("#111111") },
  milan: { body: "#FB090B", sleeves: "#111111", pattern: stripes("#111111") },
  inter: { body: "#0068A8", sleeves: "#0068A8", pattern: stripes("#111111") },
  napoli: { body: "#12A0D7", sleeves: "#12A0D7" },
  roma: { body: "#8E1F2F", sleeves: "#8E1F2F" },
  psg: { body: "#004170", sleeves: "#004170", pattern: { color: "#DA291C", bands: 3 } },
  monaco: { body: "#E51B22", sleeves: "#FFFFFF", pattern: { color: "#FFFFFF", bands: 2, horizontal: true } },
  ajax: { body: "#FFFFFF", sleeves: "#FFFFFF", pattern: { color: "#D2122E", bands: 3 } },
  psv: { body: "#ED1C24", sleeves: "#ED1C24", pattern: stripes("#FFFFFF") },
  porto: { body: "#FFFFFF", sleeves: "#004B9E", pattern: stripes("#004B9E") },
  benfica: { body: "#E40521", sleeves: "#E40521" },
  sporting: { body: "#008057", sleeves: "#008057", pattern: { color: "#FFFFFF", bands: 7, horizontal: true } },
  galatasaray: { body: "#FDB912", sleeves: "#A32638", pattern: { color: "#A32638", bands: 2 } },
  fenerbahce: { body: "#163962", sleeves: "#163962", pattern: stripes("#FFED00") },
  besiktas: { body: "#111111", sleeves: "#111111", pattern: stripes("#FFFFFF") },
};

export function ClubShirt({ c, size = 30 }: { c: Criterion; size?: number }) {
  const kit = CLUB_KITS[c.id] ?? { body: c.c1 ?? "#DDE3DF", sleeves: c.c1 ?? "#DDE3DF" };
  return <Jersey body={kit.body} sleeves={kit.sleeves} pattern={kit.pattern} numberColor="#000" number={0} size={size * 1.35} variant="crew" hideNumber />;
}

function CriterionBadge({ c, size = 30 }: { c: Criterion; size?: number }) {
  if (c.kind === "club") return <ClubShirt c={c} size={size} />;
  if (c.kind === "country") return <Flag id={c.id} width={size * 1.35} />;
  return <Text allowFontScaling={false} style={{ fontSize: size * 0.8 }}>{c.icon}</Text>;
}

/** A placed mark pops in once: small scale-up, one light overshoot, settle. */
const MARK_IN = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.6 }] },
  55: { opacity: 1, transform: [{ scale: 1.12 }] },
  100: { opacity: 1, transform: [{ scale: 1 }] },
}).duration(260);

/**
 * Hat-trick board: whose-turn card, the 3×3 criteria grid and the guess sheet.
 * Holds no game state; the screen decides what a move does (same phone or online).
 * `onMove(cell, name)` gets the validated player name, or null for a wrong guess.
 */
export function HatTrickBoard({
  grid,
  board,
  turn,
  winner,
  timeLeft,
  labels,
  canMove,
  status,
  flash,
  celebrate,
  winnerText,
  onMove,
  footer,
}: {
  grid: Grid;
  board: (HtCell | null)[];
  turn: Mark;
  winner: Winner;
  timeLeft: number;
  labels: Record<Mark, string>;
  canMove: boolean;
  status: string;
  flash?: string | null;
  /** fire confetti when this game is won (false for the losing online player) */
  celebrate: boolean;
  winnerText: string;
  onMove: (cell: number, name: string | null) => void;
  footer?: React.ReactNode;
}) {
  const { t, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const [openCell, setOpenCell] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [confetti, setConfetti] = useState(0);
  // Explicit cell sizes keep header and board columns exactly aligned
  const [gridW, setGridW] = useState(0);
  const cellW = gridW ? (gridW - 3 * 6) / 4.1 : 0;
  const size = (n: number) => (cellW ? { width: cellW * n, height: cellW } : null);

  const label = (c: Criterion) => (locale === "tr" ? c.tr : c.en);
  const used = useMemo(() => new Set(board.filter(Boolean).map((c) => c!.name)), [board]);
  const suggestions = useMemo(() => searchPlayers(input), [input]);
  const line = useMemo(() => winningLine(board), [board]);

  // Close the sheet when the turn moves on (timeout, or the other phone played)
  const sheetTurn = useRef(turn);
  useEffect(() => {
    if (turn !== sheetTurn.current || winner) {
      sheetTurn.current = turn;
      setOpenCell(null);
    }
  }, [turn, winner]);

  const wasWon = useRef(!!winner);
  useEffect(() => {
    if (winner && !wasWon.current && winner !== "draw" && celebrate) setConfetti(Date.now());
    wasWon.current = !!winner;
  }, [winner, celebrate]);

  const submit = (text?: string) => {
    const guess = (text ?? input).trim();
    if (openCell === null || !guess) return;
    const player = validateCell(guess, grid.rows[Math.floor(openCell / 3)], grid.cols[openCell % 3], used);
    if (player) haptic.press();
    else haptic.error();
    onMove(openCell, player?.name ?? null);
    setOpenCell(null);
    setInput("");
  };

  const low = timeLeft <= 10;
  const row = openCell !== null ? grid.rows[Math.floor(openCell / 3)] : null;
  const col = openCell !== null ? grid.cols[openCell % 3] : null;

  return (
    <View style={{ width: "100%" }}>
      {winner ? (
        <Card style={[styles.winner, { backgroundColor: winner === "draw" ? C.amberSoft : MARK[winner].soft }]}>
          <Icon name="trophy.fill" size={26} color={winner === "draw" ? C.amber : MARK[winner].color} fallback="🏆" />
          <Text style={[T.title, { color: winner === "draw" ? C.text : MARK[winner].color }]}>{winnerText}</Text>
        </Card>
      ) : (
        <Card style={{ padding: 14 }}>
          <View style={styles.players}>
            {(["X", "O"] as Mark[]).map((m) => {
              const active = turn === m;
              return (
                <View key={m} style={[styles.playerPill, { backgroundColor: active ? MARK[m].color : MARK[m].soft }]}>
                  <Text style={[styles.playerMark, { color: active ? "white" : MARK[m].color }]}>{m}</Text>
                  {labels[m] !== m && (
                    <Text style={[styles.playerName, { color: active ? "white" : MARK[m].color }]} numberOfLines={1}>
                      {labels[m]}
                    </Text>
                  )}
                  {active && <Text style={styles.playerTime}>{timeLeft}s</Text>}
                </View>
              );
            })}
          </View>
          <View style={styles.bar}>
            <View style={{ height: "100%", width: `${(timeLeft / TURN_SECONDS) * 100}%`, backgroundColor: low ? C.red : MARK[turn].color, borderRadius: 3 }} />
          </View>
          <Text style={[T.body, { textAlign: "center", marginTop: 10, color: MARK[turn].color, fontWeight: "700" }]}>{status}</Text>
          {flash ? <Text style={[T.caption, { textAlign: "center", color: C.red, marginTop: 4 }]}>{flash}</Text> : null}
        </Card>
      )}

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
            {grid.cols.map((c, ci) => {
              const idx = ri * 3 + ci;
              const cell = board[idx];
              const inWin = line?.includes(idx);
              return (
                <Tap
                  key={ci}
                  disabled={!!cell || !!winner || !canMove}
                  onPress={() => {
                    setOpenCell(idx);
                    setInput("");
                  }}
                  accessibilityLabel={cell ? `${cell.mark}, ${cell.name}` : `${label(r)} + ${label(c)}`}
                  style={[
                    styles.cell,
                    styles.play,
                    size(1),
                    cell && { backgroundColor: MARK[cell.mark].soft, borderColor: MARK[cell.mark].soft },
                    inWin && { borderColor: MARK[cell!.mark].color, borderStyle: "solid" },
                  ]}
                >
                  {cell ? (
                    <Animated.View entering={MARK_IN} style={{ alignItems: "center" }}>
                      <Text style={[styles.mark, { color: MARK[cell.mark].color }]}>{cell.mark}</Text>
                      <Text style={styles.cellName} numberOfLines={2}>
                        {cell.name}
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

      {footer}

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
                        <Text allowFontScaling={false} style={styles.avatarText}>
                          {initials(p.name)}
                        </Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  winner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 20 },
  players: { flexDirection: "row", gap: 10 },
  playerPill: { flex: 1, height: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 12, paddingHorizontal: 12 },
  playerMark: { fontFamily: F.black, fontSize: 30, lineHeight: 34 },
  playerName: { flexShrink: 1, fontSize: 14, fontWeight: "700" },
  playerTime: { color: "white", fontFamily: F.display, fontSize: 24, lineHeight: 34, fontVariant: ["tabular-nums"] },
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
