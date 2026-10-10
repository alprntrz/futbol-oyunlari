import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Keyframe } from "react-native-reanimated";
import Svg, { Polygon } from "react-native-svg";

import type { GridPlayer } from "@/data/players";
import type { Criterion } from "@/lib/tiki";

import { haptic } from "~/lib/haptics";
import type { Mark } from "~/lib/hattrick";
import { useI18n } from "~/lib/i18n";
import { POS, ROWS, type PpCell } from "~/lib/possession";
import { C, F, shadow, T } from "~/lib/theme";

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

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;
const surname = (name: string) => name.trim().split(/\s+/).slice(-1)[0];

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
  const label = (c: Criterion) => (locale === "tr" ? c.tr : c.en);

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
      {!winner && <Text style={[T.body, { textAlign: "center", marginTop: 8, color: MARK[turn].color, fontWeight: "700" }]}>{status}</Text>}
      <View style={{ height: 20, justifyContent: "center" }}>
        {flash ? (
          <Animated.View key={flash} entering={SOFT_IN}>
            <Text style={[T.caption, { textAlign: "center", color: C.text2, fontWeight: "600" }]}>{flash}</Text>
          </Animated.View>
        ) : null}
      </View>

      {/* Hexes */}
      <View style={{ width: "100%", height: height || undefined }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
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
                  {o ? (
                    <Animated.View key={o.name + o.mark} entering={POP} style={styles.hexInner}>
                      <CriterionBadge c={c} size={16} />
                      <Text style={[styles.hexOwner, { color: MARK[o.mark].color }]} numberOfLines={1}>
                        {surname(o.name)}
                      </Text>
                    </Animated.View>
                  ) : (
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
          if (p) haptic.success();
          else haptic.error();
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
  hexOwner: { fontSize: 9, fontWeight: "800", textAlign: "center" },
});
