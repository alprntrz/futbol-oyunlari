import { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withSequence, withTiming, type SharedValue } from "react-native-reanimated";
import Svg, { Circle, Line, Rect } from "react-native-svg";

import { SLOTS, type Pos } from "@/lib/taktik/rules";
import type { MatchEvent, Unit } from "@/lib/taktik/types";

import { useI18n } from "~/lib/i18n";
import { C, F } from "~/lib/theme";

import { Text } from "../Text";
import { surname } from "./Card";

/** where each line stands in its own half at kick-off (0 = own goal line, 0.5 = halfway) */
const DEPTH: Record<Pos, number> = { GK: 0.05, DEF: 0.2, MID: 0.34, FWD: 0.45 };
/** kits: me in blue, the opponent in coral (the app's X / O colours); keepers a darker shade */
const HOME = "#2563EB";
const AWAY = "#F43F5E";
const KEEPER = { home: "#1E3A8A", away: "#9F1239" };

type Dot = { key: string; x: number; y: number; label: string; gk: boolean; pos: Pos };

/** a side's players as dots: by line, spread across the width; `right` = attacking leftwards */
function lineUp(units: { name: string; pos: Pos }[], right: boolean): Dot[] {
  const byLine = new Map<Pos, { name: string; pos: Pos }[]>();
  for (const u of units) byLine.set(u.pos, [...(byLine.get(u.pos) ?? []), u]);
  const out: Dot[] = [];
  for (const [pos, us] of byLine) {
    us.forEach((u, i) => {
      const x = DEPTH[pos];
      const y = us.length === 1 ? 0.5 : 0.18 + (0.64 * i) / (us.length - 1);
      out.push({ key: `${right ? "a" : "h"}-${pos}-${i}`, x: right ? 1 - x : x, y, label: u.name ? surname(u.name).slice(0, 3).toUpperCase() : "", gk: pos === "GK", pos });
    });
  }
  return out;
}

const onPitch = (units: Unit[]) => units.filter((u) => u.slot !== null).map((u) => ({ name: u.name, pos: SLOTS[u.slot!] }));

/** a friendly side has no squad to show: the same shape as mine, faceless */
const ghostOf = (n: number) =>
  Array.from({ length: Math.max(3, n) }, (_, i) => ({ name: "", pos: (i === 0 ? "GK" : i < 4 ? "DEF" : i < 7 ? "MID" : "FWD") as Pos }));

/**
 * A top-down 2D pitch for a Pitch Chess match (prototype): both sides stand in
 * their lines, the ball is passed about each slice, and every match event plays
 * out as a move that ends in a goal, a save or a shot wide. The teams lean
 * towards the ball.
 */
export function MatchPitch({
  mine,
  theirs,
  events,
  shown,
  sliceMs,
  width,
}: {
  mine: Unit[];
  /** null = a friendly side */
  theirs: Unit[] | null;
  /** events with side already flipped so 0 = me */
  events: MatchEvent[];
  /** slices played so far */
  shown: number;
  sliceMs: number;
  width: number;
}) {
  const { t } = useI18n();
  const height = width * 0.62;
  const home = useMemo(() => lineUp(onPitch(mine), false), [mine]);
  const away = useMemo(() => lineUp(theirs ? onPitch(theirs) : ghostOf(home.length), true), [theirs, home.length]);

  const bx = useSharedValue(0.5);
  const by = useSharedValue(0.5);
  const flash = useSharedValue(0);
  const current = events.filter((e) => e.slice === shown - 1);
  const goalNow = current.find((e) => e.kind === "goal");

  // each slice: a short move by one side, ending in that slice's event if there is one
  useEffect(() => {
    if (shown === 0) return;
    const s = shown - 1;
    const ev = events.find((e) => e.slice === s);
    const side = ev ? ev.side : s % 2 === 0 ? 0 : 1;
    const team = side === 0 ? home : away;
    const dir = side === 0 ? 1 : -1;
    const pick = (k: number) => team[(s * 7 + k * 3) % Math.max(1, team.length)] ?? { x: 0.5, y: 0.5 };
    const a = pick(1);
    const b = pick(2);
    // pass up the pitch, towards the opponent's goal
    const p1 = { x: Math.min(0.92, Math.max(0.08, a.x + dir * 0.18)), y: a.y };
    const p2 = { x: Math.min(0.92, Math.max(0.08, b.x + dir * 0.3)), y: b.y };
    const goalX = side === 0 ? 1 : 0;
    const end = !ev
      ? { x: 0.5 + dir * 0.05, y: 0.5 }
      : ev.kind === "goal"
        ? { x: goalX, y: 0.5 }
        : ev.kind === "miss"
          ? { x: goalX, y: s % 2 ? 0.08 : 0.92 }
          : { x: side === 0 ? 0.95 : 0.05, y: 0.5 }; // save / disallowed: the keeper has it
    const leg = sliceMs / 3;
    const ease = Easing.inOut(Easing.quad);
    bx.set(withSequence(withTiming(p1.x, { duration: leg, easing: ease }), withTiming(p2.x, { duration: leg, easing: ease }), withTiming(end.x, { duration: leg, easing: Easing.out(Easing.quad) })));
    by.set(withSequence(withTiming(p1.y, { duration: leg, easing: ease }), withTiming(p2.y, { duration: leg, easing: ease }), withTiming(end.y, { duration: leg, easing: Easing.out(Easing.quad) })));
    if (ev?.kind === "goal") flash.set(withSequence(withTiming(0, { duration: leg * 2 }), withTiming(1, { duration: 160 }), withTiming(0, { duration: 700 })));
  }, [shown, events, home, away, sliceMs, bx, by, flash]);

  const ball = useAnimatedStyle(() => ({ transform: [{ translateX: bx.get() * width - 7 }, { translateY: by.get() * height - 7 }] }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.get() * 0.35 }));

  return (
    <View style={[styles.pitch, { width, height }]}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        {Array.from({ length: 8 }, (_, i) => (
          <Rect key={i} x={(i * width) / 8} y={0} width={width / 8} height={height} fill={i % 2 ? "#3BA55C" : "#43B064"} />
        ))}
        <Rect x={4} y={4} width={width - 8} height={height - 8} stroke="rgba(255,255,255,0.7)" strokeWidth={2} fill="none" rx={4} />
        <Line x1={width / 2} y1={4} x2={width / 2} y2={height - 4} stroke="rgba(255,255,255,0.7)" strokeWidth={2} />
        <Circle cx={width / 2} cy={height / 2} r={height * 0.17} stroke="rgba(255,255,255,0.7)" strokeWidth={2} fill="none" />
        <Rect x={4} y={height * 0.28} width={width * 0.12} height={height * 0.44} stroke="rgba(255,255,255,0.7)" strokeWidth={2} fill="none" />
        <Rect x={width - 4 - width * 0.12} y={height * 0.28} width={width * 0.12} height={height * 0.44} stroke="rgba(255,255,255,0.7)" strokeWidth={2} fill="none" />
        <Rect x={0} y={height * 0.4} width={5} height={height * 0.2} fill="white" />
        <Rect x={width - 5} y={height * 0.4} width={5} height={height * 0.2} fill="white" />
      </Svg>

      {home.map((d) => (
        <Player key={d.key} d={d} color={d.gk ? KEEPER.home : HOME} bx={bx} by={by} width={width} height={height} />
      ))}
      {away.map((d) => (
        <Player key={d.key} d={d} color={d.gk ? KEEPER.away : AWAY} bx={bx} by={by} width={width} height={height} />
      ))}

      <Animated.View style={[styles.ball, ball]} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, flashStyle]} />
      {goalNow && (
        <Animated.View key={`g-${shown}`} entering={FadeIn.delay(sliceMs * 0.66).duration(160)} exiting={FadeOut.duration(200)} style={styles.goalTag} pointerEvents="none">
          <Text style={styles.goalText}>
            {t("ttkGoal")} · {surname(goalNow.name)}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

/** how far each line follows the ball up and down the pitch */
const FOLLOW: Record<Pos, number> = { GK: 0.06, DEF: 0.3, MID: 0.45, FWD: 0.55 };

/** one player: holds their line, the whole team shifts with the ball, and whoever is near it goes for it */
function Player({ d, color, bx, by, width, height }: { d: Dot; color: string; bx: SharedValue<number>; by: SharedValue<number>; width: number; height: number }) {
  const size = 26;
  const follow = FOLLOW[d.pos];
  const style = useAnimatedStyle(() => {
    const ballX = bx.get();
    const ballY = by.get();
    let x = d.x + (ballX - 0.5) * follow;
    let y = d.y + (ballY - d.y) * (d.gk ? 0.15 : 0.2);
    // close to the ball: run at it
    const dist = Math.hypot(ballX - x, (ballY - y) * 0.62);
    const chase = d.gk ? 0 : Math.max(0, 1 - dist / 0.3) * 0.7;
    x += (ballX - x) * chase;
    y += (ballY - y) * chase;
    return { transform: [{ translateX: x * width - size / 2 }, { translateY: y * height - size / 2 }] };
  });
  return (
    <Animated.View style={[styles.player, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]}>
      {d.label ? (
        <Text allowFontScaling={false} style={styles.playerText}>
          {d.label}
        </Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pitch: { borderRadius: 14, overflow: "hidden", alignSelf: "center" },
  player: { position: "absolute", left: 0, top: 0, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "white" },
  playerText: { fontSize: 8, fontWeight: "900", color: "white", letterSpacing: -0.2 },
  ball: { position: "absolute", left: 0, top: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: "white", borderWidth: 2, borderColor: C.text, zIndex: 5 },
  flash: { backgroundColor: "#FACC15" },
  goalTag: { position: "absolute", alignSelf: "center", top: 10, backgroundColor: C.greenDark, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 5, zIndex: 6 },
  goalText: { fontFamily: F.black, fontSize: 20, color: "white" },
});
