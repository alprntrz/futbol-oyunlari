import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, Keyframe, useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import Svg, { Polygon } from "react-native-svg";

import type { GridPlayer } from "@/data/players";
import type { Criterion } from "@/lib/tiki";
import { pick } from "@/lib/strings";

import { haptic, useClockTicks } from "~/lib/haptics";
import { play } from "~/lib/sound";
import type { Mark } from "~/lib/hattrick";
import { useI18n } from "~/lib/i18n";
import { POS, ROWS, type PpCell } from "~/lib/possession";
import { C, F, LTR, shadow, T } from "~/lib/theme";

import { CriterionBadge, MARK } from "./HatTrickBoard";
import { Confetti, SOFT_IN } from "./motion";
import { PlayerSearchSheet } from "./PlayerSearchSheet";
import { Text } from "./Text";
import { Card, Icon, Tap } from "./ui";

const POP = new Keyframe({
  0: { transform: [{ scale: 0.85 }] },
  55: { transform: [{ scale: 1.08 }] },
  100: { transform: [{ scale: 1 }] },
}).duration(260);

// a claimed hex turns over to its new owner's colour (steals turn over again) and shows the
// footballer for a moment, then its own club / country again
const FLIP_MS = 420;
const NAME_MS = 1200;

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;
const surname = (name: string) => name.trim().split(/\s+/).slice(-1)[0];

/**
 * One claimed hex: the screen's key changes with the owner, so each claim mounts a new one. The
 * flip is a flat scaleX on purpose: with perspective + rotateY iOS sorts the hex in 3D against its
 * neighbours and half of it (or of them) disappears behind the board.
 */
function ClaimedHex({ c, cell, text, left, top, w, h, points }: { c: Criterion; cell: PpCell; text: string; left: number; top: number; w: number; h: number; points: string }) {
  const [showName, setShowName] = useState(true);
  const turn = useSharedValue(1);
  const flip = useAnimatedStyle(() => ({ transform: [{ scaleX: turn.get() }] }));
  useEffect(() => {
    turn.set(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: FLIP_MS, easing: Easing.out(Easing.back(1.6)) })));
    const id = setTimeout(() => setShowName(false), NAME_MS);
    return () => clearTimeout(id);
  }, [turn]);
  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", left, top, width: w, height: h }, flip]}>
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        <Polygon points={points} fill={MARK[cell.mark].color} stroke="white" strokeWidth={2} />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.hexInner]}>
        <CriterionBadge c={c} size={16} />
        <Text style={showName ? styles.hexOwner : styles.hexOwnerLabel} numberOfLines={showName ? 1 : 2}>
          {showName ? surname(cell.name) : text}
        </Text>
      </View>
    </Animated.View>
  );
}

/**
 * Possession Play board: two chess clocks, 31 hexes, and the guess sheet.
 * Holds no game state; `onMove(hex, player)` gets the named footballer (or
 * null for a wrong answer) and the screen applies it (same phone or online).
 */
export function PossessionBoard({
  board,
  owners,
  turn,
  clocks,
  labels,
  canMove,
  winner,
  winnerText,
  status,
  flash,
  celebrate,
  onMove,
  footer,
  usedNames,
}: {
  board: Criterion[];
  owners: (PpCell | null)[];
  turn: Mark;
  /** seconds left per player */
  clocks: Record<Mark, number>;
  labels: Record<Mark, string>;
  canMove: boolean;
  winner: Mark | "draw" | null;
  winnerText: string;
  status: string;
  flash?: string | null;
  celebrate: boolean;
  onMove: (hex: number, player: GridPlayer | null) => void;
  footer?: React.ReactNode;
  /** every name played this game, including ones whose hexes were stolen */
  usedNames: string[];
}) {
  const { locale, t } = useI18n();
  const [width, setWidth] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const [confetti, setConfetti] = useState(0);

  const used = new Set(usedNames);
  const count = (m: Mark) => owners.filter((o) => o?.mark === m).length;
  const label = (c: Criterion) => pick(c, locale);

  // Close the sheet if the turn moves on under it
  const sheetTurn = useRef(turn);
  useEffect(() => {
    if (turn !== sheetTurn.current || winner) {
      sheetTurn.current = turn;
      setOpen(null);
    }
  }, [turn, winner]);

  const wasWon = useRef(!!winner);
  useEffect(() => {
    if (winner && !wasWon.current && winner !== "draw" && celebrate) setConfetti(Date.now());
    wasWon.current = !!winner;
  }, [winner, celebrate]);
  useClockTicks(winner ? null : clocks[turn], canMove);

  // Pointy-top hexes; wide rows hold 5, narrow rows 4 shifted half a hex
  const w = width / 5;
  const h = (w * 2) / Math.sqrt(3);
  const step = h * 0.75;
  const height = h + step * (ROWS.length - 1);
  const center = (i: number) => {
    const [r, c] = POS[i];
    return { x: c * w + (ROWS[r] === 4 ? w : w / 2), y: h / 2 + r * step };
  };
  const hexPoints = (cx: number, cy: number) => {
    const rr = h / 2 - 1.5;
    return Array.from({ length: 6 }, (_, k) => {
      const a = (Math.PI / 3) * k - Math.PI / 2;
      return `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`;
    }).join(" ");
  };

  return (
    <View style={{ width: "100%" }}>
      {winner ? (
        <Animated.View entering={SOFT_IN}>
          <Card style={[styles.winner, { backgroundColor: winner === "draw" ? C.amberSoft : MARK[winner].soft }]}>
            <Icon name="trophy.fill" size={24} color={winner === "draw" ? C.amber : MARK[winner].color} fallback="🏆" />
            <Text style={[T.title, { color: winner === "draw" ? C.text : MARK[winner].color }]}>{winnerText}</Text>
          </Card>
        </Animated.View>
      ) : null}

      {/* Chess clocks and hex counts */}
      <View style={styles.clocks}>
        {(["X", "O"] as Mark[]).map((m) => {
          const active = turn === m && !winner;
          return (
            <View key={m} style={[styles.clock, { backgroundColor: active ? MARK[m].color : MARK[m].soft }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.clockName, { color: active ? "white" : MARK[m].color }]} numberOfLines={1}>
                  {labels[m]}
                </Text>
                <Text style={[styles.clockCount, { color: active ? "white" : MARK[m].color }]}>{count(m)}</Text>
              </View>
              <Text style={[styles.clockTime, { color: active ? "white" : MARK[m].color }, clocks[m] <= 15 && { color: active ? "#FFE4E6" : C.red }]}>
                {fmt(clocks[m])}
              </Text>
            </View>
          );
        })}
      </View>
      {!winner && (
        <Animated.View key={turn} entering={POP} style={[styles.turn, { backgroundColor: MARK[turn].color }]}>
          <View style={styles.turnMark}>
            <Text style={[styles.turnMarkText, { color: MARK[turn].color }]}>{turn}</Text>
          </View>
          <Text style={styles.turnText} numberOfLines={1}>
            {status}
          </Text>
        </Animated.View>
      )}
      <View style={{ height: 20, justifyContent: "center" }}>
        {flash ? (
          <Animated.View key={flash} entering={SOFT_IN}>
            <Text style={[T.caption, { textAlign: "center", color: C.text2, fontWeight: "600" }]}>{flash}</Text>
          </Animated.View>
        ) : null}
      </View>

      {/* Hexes */}
      <View style={[{ width: "100%", height: height || undefined }, LTR]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <>
            <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
              {board.map((_, i) => {
                const { x, y } = center(i);
                const o = owners[i];
                return (
                  <Polygon
                    key={i}
                    points={hexPoints(x, y)}
                    fill={o ? MARK[o.mark].soft : C.card}
                    stroke={o ? MARK[o.mark].color : C.border}
                    strokeWidth={o ? 2 : 1.2}
                  />
                );
              })}
            </Svg>
            {board.map((c, i) => {
              const { x, y } = center(i);
              const o = owners[i];
              const size = w * 0.86;
              return (
                <Tap
                  key={i}
                  disabled={!!o || !!winner || !canMove}
                  onPress={() => setOpen(i)}
                  accessibilityLabel={o ? `${label(c)}, ${o.mark}, ${o.name}` : label(c)}
                  style={[styles.hex, { left: x - size / 2, top: y - size / 2, width: size, height: size }]}
                >
                  {o ? null : (
                    <View style={styles.hexInner}>
                      <CriterionBadge c={c} size={18} />
                      <Text style={styles.hexLabel} numberOfLines={2}>
                        {label(c)}
                      </Text>
                    </View>
                  )}
                </Tap>
              );
            })}
            {/* claimed hexes: solid owner colour, the criterion stays readable */}
            {board.map((c, i) => {
              const o = owners[i];
              if (!o) return null;
              const { x, y } = center(i);
              return (
                <ClaimedHex
                  key={`${i}-${o.mark}-${o.name}`}
                  c={c}
                  cell={o}
                  text={label(c)}
                  left={x - w / 2}
                  top={y - h / 2}
                  w={w}
                  h={h}
                  points={hexPoints(w / 2, h / 2)}
                />
              );
            })}
          </>
        )}
      </View>

      {footer}

      <PlayerSearchSheet
        visible={open !== null}
        header={
          open !== null ? (
            <View style={{ alignItems: "center", gap: 6 }}>
              <CriterionBadge c={board[open]} size={30} />
              <Text style={T.headline}>{label(board[open])}</Text>
              <Text style={[T.caption, { textAlign: "center" }]}>{t("ppNeighbours")}</Text>
            </View>
          ) : null
        }
        caption={`${labels[turn]}  ${fmt(clocks[turn])}`}
        captionColor={MARK[turn].color}
        used={used}
        accept={(p) => open !== null && board[open].test(p)}
        onSubmit={(p) => {
          if (open === null) return;
          if (p) {
            haptic.success();
            play("correct");
          } else {
            haptic.error();
            play("wrong");
          }
          onMove(open, p);
          setOpen(null);
        }}
        onClose={() => setOpen(null)}
      />
      <Confetti fire={confetti} />
    </View>
  );
}

const styles = StyleSheet.create({
  winner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16, marginBottom: 10 },
  clocks: { flexDirection: "row", gap: 10 },
  clock: { flex: 1, flexDirection: "row", alignItems: "center", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, ...shadow, shadowOpacity: 0.04 },
  clockName: { fontSize: 13, fontWeight: "700" },
  clockCount: { fontFamily: F.black, fontSize: 26, lineHeight: 28 },
  clockTime: { fontFamily: F.display, fontSize: 24, fontVariant: ["tabular-nums"] },
  hex: { position: "absolute", alignItems: "center", justifyContent: "center" },
  hexInner: { alignItems: "center", justifyContent: "center", gap: 2, paddingHorizontal: 2 },
  hexLabel: { color: C.text2, fontSize: 8, lineHeight: 10, fontWeight: "700", textAlign: "center" },
  hexOwner: { fontSize: 9, fontWeight: "800", textAlign: "center", color: "white" },
  hexOwnerLabel: { fontSize: 8, lineHeight: 10, fontWeight: "700", textAlign: "center", color: "white" },
  turn: { flexDirection: "row", alignItems: "center", alignSelf: "center", gap: 8, marginTop: 10, borderRadius: 999, paddingLeft: 6, paddingRight: 16, paddingVertical: 5 },
  turnMark: { width: 26, height: 26, borderRadius: 13, backgroundColor: "white", alignItems: "center", justifyContent: "center" },
  turnMarkText: { fontFamily: F.black, fontSize: 16, lineHeight: 18 },
  turnText: { fontFamily: F.display, fontSize: 17, color: "white" },
});
