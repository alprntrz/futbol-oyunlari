import { useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import Animated, { Keyframe } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { playerInfo } from "@/lib/playerInfo";
import { searchPlayers, validateCell, type Criterion, type Grid } from "@/lib/tiki";

import { haptic } from "~/lib/haptics";
import { play } from "~/lib/sound";
import { answersFor } from "~/lib/htBot";
import { SERIES_TARGET, TURN_SECONDS, winningLine, type HtCell, type Mark, type Winner } from "~/lib/hattrick";
import { useI18n } from "~/lib/i18n";
import { C, F, R, shadow, T } from "~/lib/theme";

import { initials, PlayerLine, PlayerToken } from "./PlayerRow";
import { Flag } from "./Flag";
import { Jersey } from "./Jersey";
import { Confetti, SmoothBar, SOFT_IN, softIn } from "./motion";
import { Text } from "./Text";
import { Button, Card, Icon, Tap } from "./ui";

export const MARK: Record<Mark, { color: string; soft: string }> = {
  X: { color: C.blue, soft: C.blueSoft },
  O: { color: C.coral, soft: C.coralSoft },
};


export type Kit = { body: string; sleeves: string; pattern?: { color: string; bands: number; horizontal?: boolean } };
const stripes = (color: string, bands = 7) => ({ color, bands });

/** Club home kits for criterion shirts (body, sleeves, stripes/halves/hoops). */
export const CLUB_KITS: Record<string, Kit> = {
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

export function CriterionBadge({ c, size = 30 }: { c: Criterion; size?: number }) {
  if (c.kind === "club") return <ClubShirt c={c} size={size} />;
  if (c.kind === "country") return <Flag id={c.id} width={size * 1.35} />;
  if (c.kind === "mate" || c.kind === "coach") return <PersonBadge c={c} size={size} />;
  return (
    <Text allowFontScaling={false} style={{ fontSize: size * 0.8 }}>
      {c.icon}
    </Text>
  );
}

/** "Played with" star (green disc, handshake) or "managed by" coach (navy disc, clipboard): initials. */
function PersonBadge({ c, size }: { c: Criterion; size: number }) {
  const coach = c.kind === "coach";
  const words = (c.short ?? c.en).split(/\s+/);
  const initials = (words.length > 1 ? words[0][0] + words[words.length - 1][0] : words[0].slice(0, 2)).toUpperCase();
  const d = size * 1.15;
  return (
    <View style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: coach ? "#1F3B8C" : C.greenMid, alignItems: "center", justifyContent: "center" }}>
      <Text allowFontScaling={false} style={{ fontFamily: F.black, fontSize: d * 0.42, lineHeight: d * 0.5, color: "white" }}>
        {initials}
      </Text>
      <Text allowFontScaling={false} style={{ position: "absolute", right: -d * 0.12, bottom: -d * 0.1, fontSize: d * 0.38 }}>
        {coach ? "📋" : "🤝"}
      </Text>
    </View>
  );
}

/** A placed name settles in with a barely-there bounce. */
const MARK_IN = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.92 }] },
  60: { opacity: 1, transform: [{ scale: 1.03 }] },
  100: { opacity: 1, transform: [{ scale: 1 }] },
}).duration(240);

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
  winnerSub,
  series,
  onMove,
  footer,
  header,
  sheetCaption,
  steals,
  usedNames,
  jokers = null,
  onJoker,
  turnSeconds = TURN_SECONDS,
  comeback = null,
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
  /** under the result: the series score / "next game starting" */
  winnerSub?: string;
  /** game wins in this series, per mark (series play only) */
  series?: Record<Mark, number> | null;
  /** full length of the current turn (the comeback player's are longer) */
  turnSeconds?: number;
  /** mark with the comeback bonus this game (+10 s a turn) */
  comeback?: Mark | null;
  onMove: (cell: number, name: string | null) => void;
  footer?: React.ReactNode;
  /** replaces the X/O turn card (single player) */
  header?: React.ReactNode;
  /** replaces the "X · your guess · 42s" line in the guess sheet */
  sheetCaption?: string;
  /** steal mode: steals left per player (null/undefined = off) */
  steals?: Record<Mark, number> | null;
  /** every name played this game, including ones stolen off the board */
  usedNames?: string[];
  /** jokers left this game (both players get the same; null = none in this mode) */
  jokers?: { time: number; hint: number } | null;
  onJoker?: (kind: "time" | "hint") => void;
}) {
  const { t, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const [openCell, setOpenCell] = useState<number | null>(null);
  // after the game: a square whose possible answers are being shown
  const [review, setReview] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [confetti, setConfetti] = useState(0);
  // a hint joker: initials and position of a well-known answer for that square
  const [hint, setHint] = useState<{ cell: number; text: string } | null>(null);
  // Explicit cell sizes keep header and board columns exactly aligned
  const [gridW, setGridW] = useState(0);
  const cellW = gridW ? (gridW - 3 * 6) / 4.1 : 0;
  const size = (n: number) => (cellW ? { width: cellW * n, height: cellW } : null);

  const label = (c: Criterion) => (locale === "tr" ? c.tr : c.en);
  const used = useMemo(() => new Set([...(usedNames ?? []), ...board.filter(Boolean).map((c) => c!.name)]), [board, usedNames]);
  // A rival's square can be taken while the player to move still has steals
  const canSteal = (cell: HtCell) => !!steals && cell.mark !== turn && steals[turn] > 0;
  const suggestions = useMemo(() => searchPlayers(input), [input]);
  const line = useMemo(() => winningLine(board), [board]);
  const gridKey = [...grid.rows, ...grid.cols].map((c) => c.id).join(".");

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
    if (player) {
      haptic.press();
      play("correct");
    } else {
      haptic.error();
      play("wrong");
    }
    onMove(openCell, player?.name ?? null);
    setOpenCell(null);
    setInput("");
  };

  const useHint = () => {
    if (openCell === null || !jokers?.hint) return;
    const answer = answersFor(grid, openCell).find((p) => !used.has(p.name));
    if (!answer) return;
    const { pos } = playerInfo(answer);
    haptic.tap();
    setHint({ cell: openCell, text: [initials(answer.name).split("").join(". ") + ".", pos ? t(`posName_${pos}`) : null].filter(Boolean).join(" · ") });
    onJoker?.("hint");
  };

  const low = timeLeft <= 10;
  const row = openCell !== null ? grid.rows[Math.floor(openCell / 3)] : null;
  const col = openCell !== null ? grid.cols[openCell % 3] : null;

  return (
    <View style={{ width: "100%" }}>
      {header ? (
        header
      ) : winner ? (
        <Animated.View entering={SOFT_IN}>
          <Card style={[styles.winner, { backgroundColor: winner === "draw" ? C.amberSoft : MARK[winner].soft }]}>
            <Icon name="trophy.fill" size={26} color={winner === "draw" ? C.amber : MARK[winner].color} fallback="🏆" />
            <View style={{ alignItems: "center", gap: 2 }}>
              <Text style={[T.title, { color: winner === "draw" ? C.text : MARK[winner].color }]}>{winnerText}</Text>
              {winnerSub ? <Text style={[T.caption, { fontWeight: "700" }]}>{winnerSub}</Text> : null}
            </View>
          </Card>
        </Animated.View>
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
                  {steals && (
                    <View style={[styles.stealBadge, { backgroundColor: active ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.7)" }]}>
                      <Icon name="arrow.left.arrow.right" size={11} color={active ? "white" : MARK[m].color} fallback="⇄" />
                      <Text allowFontScaling={false} style={[styles.stealCount, { color: active ? "white" : MARK[m].color }]}>
                        {steals[m]}
                      </Text>
                    </View>
                  )}
                  {series && (
                    <View style={styles.pips} accessibilityLabel={`${series[m]}/${SERIES_TARGET}`}>
                      {Array.from({ length: SERIES_TARGET }, (_, k) => (
                        <View
                          key={k}
                          style={[styles.pip, { borderColor: active ? "white" : MARK[m].color }, k < series[m] && { backgroundColor: active ? "white" : MARK[m].color }]}
                        />
                      ))}
                    </View>
                  )}
                  {comeback === m && !winner && (
                    <View style={[styles.comebackBadge, { backgroundColor: active ? "rgba(255,255,255,0.25)" : "#FFF4CC" }]} accessibilityLabel={t("htComeback")}>
                      <Text allowFontScaling={false} style={[styles.comebackText, { color: active ? "white" : "#8A5A00" }]}>
                        +10
                      </Text>
                    </View>
                  )}
                  {active && <Text style={styles.playerTime}>{timeLeft}s</Text>}
                </View>
              );
            })}
          </View>
          <View style={{ marginTop: 12 }}>
            <SmoothBar fraction={timeLeft / turnSeconds} color={low ? C.red : MARK[turn].color} />
          </View>
          {/* the turn line and any message cross-fade when they change */}
          <Animated.View key={`${turn}-${status}`} entering={SOFT_IN}>
            <Text style={[T.body, { textAlign: "center", marginTop: 10, color: MARK[turn].color, fontWeight: "700" }]}>{status}</Text>
          </Animated.View>
          {flash ? (
            <Animated.View key={flash} entering={SOFT_IN}>
              <Text style={[T.caption, { textAlign: "center", color: C.red, marginTop: 4 }]}>{flash}</Text>
            </Animated.View>
          ) : null}
        </Card>
      )}

      <View style={styles.grid} onLayout={(e) => setGridW(e.nativeEvent.layout.width)}>
        {/* a new grid deals in row by row */}
        <Animated.View key={`${gridKey}-head`} entering={softIn(0)} style={styles.row}>
          <View style={[styles.corner, size(1.1)]} />
          {grid.cols.map((c, i) => (
            <View key={i} style={[styles.cell, styles.head, size(1)]}>
              <CriterionBadge c={c} />
              <Text style={styles.headLabel} numberOfLines={2} adjustsFontSizeToFit>
                {label(c)}
              </Text>
            </View>
          ))}
        </Animated.View>
        {grid.rows.map((r, ri) => (
          <Animated.View key={`${gridKey}-${ri}`} entering={softIn(ri + 1)} style={styles.row}>
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
                  disabled={!winner && ((!!cell && !canSteal(cell)) || !canMove)}
                  onPress={() => {
                    if (winner) return setReview(idx);
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
          </Animated.View>
        ))}
      </View>

      {winner && (
        <View style={styles.reviewHint}>
          <Icon name="hand.tap.fill" size={14} color={C.text2} fallback="☝︎" />
          <Text style={T.caption}>{t("htReviewHint")}</Text>
        </View>
      )}

      {footer}

      <AnswersSheet grid={grid} cell={review} placed={review !== null ? board[review] : null} onClose={() => setReview(null)} />

      <Modal statusBarTranslucent navigationBarTranslucent visible={openCell !== null} transparent animationType="slide" onRequestClose={() => setOpenCell(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={{ flex: 1, backgroundColor: "rgba(11,18,32,0.35)" }} onPress={() => setOpenCell(null)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.grabber} />
            {row && col && <CriteriaPair row={row} col={col} color={MARK[turn].color} />}
            <Text style={[T.caption, { textAlign: "center", marginVertical: 12, color: MARK[turn].color, fontWeight: "700" }]}>
              {sheetCaption ??
                `${openCell !== null && board[openCell] ? `${t("htSteals")}: ${board[openCell]!.name}` : `${turn}, ${t("ttYourGuess")}`}  ${timeLeft}s`}
            </Text>
            {jokers && canMove && (
              <View style={styles.jokers}>
                <Tap disabled={!jokers.time} onPress={() => (haptic.tap(), onJoker?.("time"))} style={[styles.joker, !jokers.time && { opacity: 0.4 }]} accessibilityRole="button">
                  <Icon name="stopwatch.fill" size={15} color={C.blue} />
                  <Text style={styles.jokerText}>{t("jkTime")}</Text>
                  <Text style={styles.jokerCount}>×{jokers.time}</Text>
                </Tap>
                <Tap disabled={!jokers.hint || hint?.cell === openCell} onPress={useHint} style={[styles.joker, (!jokers.hint || hint?.cell === openCell) && { opacity: 0.4 }]} accessibilityRole="button">
                  <Icon name="lightbulb.fill" size={15} color={C.amber} />
                  <Text style={styles.jokerText}>{t("jkHint")}</Text>
                  <Text style={styles.jokerCount}>×{jokers.hint}</Text>
                </Tap>
              </View>
            )}
            {hint && hint.cell === openCell && (
              <View style={styles.hintBox}>
                <Icon name="lightbulb.fill" size={14} color={C.amber} />
                <Text style={styles.hintText}>{hint.text}</Text>
              </View>
            )}
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
                      <PlayerToken p={p} />
                      <PlayerLine p={p} />
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

/**
 * The two things a square asks for, above the keyboard: one tile each (badge, name,
 * what kind of criterion it is) joined by a round "and" in the mover's colour.
 */
function CriteriaPair({ row, col, color }: { row: Criterion; col: Criterion; color: string }) {
  const { t, locale } = useI18n();
  const kind = (c: Criterion) => t(c.kind === "club" ? "critClub" : c.kind === "country" ? "critCountry" : c.kind === "mate" ? "critMate" : c.kind === "coach" ? "critCoach" : "critBadge");
  const tile = (c: Criterion) => (
    <View style={styles.critTile}>
      <View style={styles.critBadge}>
        <CriterionBadge c={c} size={34} />
      </View>
      <Text style={styles.critName} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>
        {locale === "tr" ? c.tr : c.en}
      </Text>
      <Text style={styles.critKind}>{kind(c)}</Text>
    </View>
  );
  return (
    <View style={styles.critRow} accessible accessibilityLabel={`${locale === "tr" ? row.tr : row.en} ${t("critAnd")} ${locale === "tr" ? col.tr : col.en}`}>
      {tile(row)}
      {tile(col)}
      <View style={[styles.critJoin, { backgroundColor: color }]} pointerEvents="none">
        <Icon name="plus" size={16} color="white" fallback="+" />
      </View>
    </View>
  );
}

/** After a game: who could have gone in a square. Best-known players first. */
function AnswersSheet({ grid, cell, placed, onClose }: { grid: Grid; cell: number | null; placed: HtCell | null; onClose: () => void }) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const all = useMemo(() => (cell === null ? [] : answersFor(grid, cell)), [grid, cell]);
  if (cell === null) return null;
  const row = grid.rows[Math.floor(cell / 3)];
  const col = grid.cols[cell % 3];
  // the name actually played here goes first, then the best-known others
  const shown = [...all.filter((p) => p.name === placed?.name), ...all.filter((p) => p.name !== placed?.name)].slice(0, 8);

  return (
    <Modal statusBarTranslucent navigationBarTranslucent visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(11,18,32,0.35)" }} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.grabber} />
        <CriteriaPair row={row} col={col} color={C.greenMid} />
        <Text style={[T.caption, { textAlign: "center", marginVertical: 12 }]}>
          {all.length === 0 ? t("htNoAnswers") : `${all.length} ${t("htAnswersCount")}`}
        </Text>
        {shown.length > 0 && (
          <View style={styles.suggestionsStatic}>
            {shown.map((p, i) => {
              const mine = placed?.name === p.name;
              return (
                <View key={p.name} style={[styles.suggestion, i > 0 && styles.suggestionDivider]}>
                  <PlayerToken p={p} />
                  <PlayerLine p={p} />
                  {mine && placed && (
                    <Text style={[styles.placedTag, { color: MARK[placed.mark].color, backgroundColor: MARK[placed.mark].soft }]}>{placed.mark}</Text>
                  )}
                </View>
              );
            })}
          </View>
        )}
        <Button title={t("close")} kind="secondary" onPress={onClose} style={{ marginTop: 14 }} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  jokers: { flexDirection: "row", gap: 8, justifyContent: "center", marginBottom: 10 },
  joker: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border },
  jokerText: { fontFamily: F.display, fontSize: 16, color: C.text },
  jokerCount: { fontSize: 12, fontWeight: "800", color: C.text3 },
  hintBox: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "center", backgroundColor: C.amberSoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, marginBottom: 10 },
  hintText: { fontFamily: F.display, fontSize: 17, color: "#92400E" },
  reviewHint: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 12 },
  suggestionsStatic: { borderRadius: R.button, borderWidth: 1, borderColor: C.border, overflow: "hidden" },
  placedTag: { fontFamily: F.black, fontSize: 16, borderRadius: 8, paddingHorizontal: 8, overflow: "hidden" },
  winner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 20 },
  players: { flexDirection: "row", gap: 10 },
  playerPill: { flex: 1, height: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 12, paddingHorizontal: 12 },
  playerMark: { fontFamily: F.black, fontSize: 30, lineHeight: 34 },
  playerName: { flexShrink: 1, fontSize: 14, fontWeight: "700" },
  pips: { flexDirection: "row", gap: 3 },
  pip: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5 },
  comebackBadge: { borderRadius: 7, paddingHorizontal: 5, paddingVertical: 1 },
  comebackText: { fontFamily: F.display, fontSize: 13 },
  stealBadge: { flexDirection: "row", alignItems: "center", gap: 2, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 2 },
  stealCount: { fontFamily: F.display, fontSize: 14, lineHeight: 16 },
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
  critRow: { flexDirection: "row", gap: 10, alignItems: "stretch" },
  critTile: { flex: 1, alignItems: "center", gap: 4, backgroundColor: C.bg, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 10 },
  critBadge: { height: 40, justifyContent: "center" },
  critName: { fontFamily: F.display, fontSize: 18, lineHeight: 20, color: C.text, textAlign: "center" },
  critKind: { fontSize: 10, fontWeight: "800", letterSpacing: 1, color: C.text3 },
  critJoin: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 34,
    height: 34,
    marginLeft: -17,
    marginTop: -17,
    borderRadius: 17,
    borderWidth: 3,
    borderColor: C.card,
    alignItems: "center",
    justifyContent: "center",
  },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.bg, borderRadius: R.button, paddingHorizontal: 12 },
  input: { flex: 1, paddingVertical: 13, fontSize: 16, color: C.text },
  suggestions: { maxHeight: 230, marginTop: 10, borderRadius: R.button, borderWidth: 1, borderColor: C.border },
  suggestion: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 9 },
  suggestionDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "white", fontWeight: "800", fontSize: 12 },
});
