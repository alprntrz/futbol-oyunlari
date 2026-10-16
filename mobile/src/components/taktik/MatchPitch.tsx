import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, Line, Rect } from "react-native-svg";

import { SLOTS, type Pos } from "@/lib/taktik/rules";
import type { MatchEvent, Unit } from "@/lib/taktik/types";

import { useI18n } from "~/lib/i18n";
import { C, F } from "~/lib/theme";

import { CLUB_KITS, type Kit } from "../HatTrickBoard";
import { Jersey } from "../Jersey";
import { Text } from "../Text";
import { clubCriterion, surname } from "./Card";

/** where each line stands in its own half at kick-off (0 = own goal line, 0.5 = halfway) */
const DEPTH: Record<Pos, number> = { GK: 0.05, DEF: 0.2, MID: 0.34, FWD: 0.45 };
/** how far each line follows the ball up and down the pitch */
const FOLLOW: Record<Pos, number> = { GK: 0.06, DEF: 0.3, MID: 0.45, FWD: 0.55 };
/** fallback kits (no club in the squad, or two kits too alike): me in blue, the opponent in coral */
const PLAIN = { home: { body: "#2563EB", sleeves: "#2563EB" } as Kit, away: { body: "#F43F5E", sleeves: "#F43F5E" } as Kit };
const KEEPER: Record<"home" | "away", Kit> = { home: { body: "#1F2937", sleeves: "#1F2937" }, away: { body: "#FACC15", sleeves: "#FACC15" } };

/** a side plays in the kit of the club most of its players come from */
function teamKit(units: Unit[] | null): Kit | null {
  const count = new Map<string, number>();
  for (const u of units ?? []) if (u.slot !== null && u.club) count.set(u.club, (count.get(u.club) ?? 0) + 1);
  const top = [...count.entries()].sort((a, b) => b[1] - a[1])[0];
  const c = top && clubCriterion(top[0]);
  return c ? (CLUB_KITS[c.id] ?? (c.c1 ? { body: c.c1, sleeves: c.c1 } : null)) : null;
}

/** how alike two colours are (0 = same) */
function gap(a: string, b: string) {
  const n = (h: string) => [1, 3, 5].map((i) => parseInt(h.replace("#", "").padEnd(6, "0").slice(i - 1, i + 1), 16));
  const [x, y] = [n(a), n(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

type Dot = { key: string; x: number; y: number; name: string; label: string; gk: boolean; pos: Pos; home: boolean };

/** a side's players by line, spread across the width; away attacks right to left */
function lineUp(units: { name: string; pos: Pos }[], home: boolean): Dot[] {
  const byLine = new Map<Pos, { name: string; pos: Pos }[]>();
  for (const u of units) byLine.set(u.pos, [...(byLine.get(u.pos) ?? []), u]);
  const out: Dot[] = [];
  for (const [pos, us] of byLine) {
    us.forEach((u, i) => {
      const x = DEPTH[pos];
      const y = us.length === 1 ? 0.5 : 0.18 + (0.64 * i) / (us.length - 1);
      out.push({ key: `${home ? "h" : "a"}-${pos}-${i}`, x: home ? x : 1 - x, y, name: u.name, label: u.name ? surname(u.name).slice(0, 3).toUpperCase() : "", gk: pos === "GK", pos, home });
    });
  }
  return out;
}

const onPitch = (units: Unit[]) => units.filter((u) => u.slot !== null).map((u) => ({ name: u.name, pos: SLOTS[u.slot!] }));

/** a friendly side has no squad to show: a faceless side of about my size */
const ghostOf = (n: number) =>
  Array.from({ length: Math.max(3, n) }, (_, i) => ({ name: "", pos: (i === 0 ? "GK" : i < 4 ? "DEF" : i < 7 ? "MID" : "FWD") as Pos }));

/** a shot's flight, drawn for a moment: from where it was hit to where it ended */
type Shot = { from: { x: number; y: number }; to: { x: number; y: number }; kind: MatchEvent["kind"]; id: number };

/**
 * A Pitch Chess match on a top-down 2D pitch. Each slice is a short move: the
 * ball is carried and passed up the pitch, and a slice with an event ends in a
 * shot by that player (the trail shows its flight) that goes in, is saved with
 * a dive, or goes wide. The teams shift with the ball, whoever is near goes for
 * it, and the shooter makes his run to where he shoots from.
 */
export function MatchPitch({
  mine,
  theirs,
  events,
  shown,
  over = false,
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
  /** full time (or skipped): everyone back in shape, the ball on the spot */
  over?: boolean;
  sliceMs: number;
  width: number;
}) {
  const { t } = useI18n();
  const height = width * 0.66;
  const home = useMemo(() => lineUp(onPitch(mine), true), [mine]);
  // kits: each side's main club; if they'd look alike, the opponent changes to its plain away colour
  const kits = useMemo(() => {
    const h = teamKit(mine) ?? PLAIN.home;
    let a = teamKit(theirs) ?? PLAIN.away;
    if (gap(h.body, a.body) < 110) a = gap(h.body, PLAIN.away.body) < 110 ? PLAIN.home : PLAIN.away;
    return { home: h, away: a };
  }, [mine, theirs]);
  const away = useMemo(() => lineUp(theirs ? onPitch(theirs) : ghostOf(home.length), false), [theirs, home.length]);

  const bx = useSharedValue(0.5);
  const by = useSharedValue(0.5);
  const flash = useSharedValue(0);
  // the player making a run, and where to (he holds there while he shoots)
  const runKey = useSharedValue("");
  const rx = useSharedValue(0.5);
  const ry = useSharedValue(0.5);
  const [shot, setShot] = useState<Shot | null>(null);
  const goalNow = events.find((e) => e.slice === shown - 1 && e.kind === "goal");

  useEffect(() => {
    if (shown === 0) return;
    if (over) {
      runKey.set("");
      bx.set(withTiming(0.5, { duration: 500, easing: Easing.inOut(Easing.quad) }));
      by.set(withTiming(0.5, { duration: 500, easing: Easing.inOut(Easing.quad) }));
      return;
    }
    const s = shown - 1;
    const ev = events.find((e) => e.slice === s);
    const side = ev ? ev.side : s % 2 === 0 ? 0 : 1;
    const team = (side === 0 ? home : away).filter((d) => !d.gk);
    const dir = side === 0 ? 1 : -1;
    // the shooter is the event's player when he's on the pitch, else the one furthest up
    const shooter = (ev && team.find((d) => d.name === ev.name)) ?? [...team].sort((a, b) => dir * (b.x - a.x))[0];
    const passer = team.find((d) => d !== shooter) ?? shooter;
    const clamp = (v: number) => Math.min(0.94, Math.max(0.06, v));
    const p1 = passer ? { x: clamp(passer.x + dir * 0.16), y: passer.y } : { x: 0.5, y: 0.5 };
    // an event is shot from the edge of the box; a plain move ends in midfield
    const p2 = ev ? { x: side === 0 ? 0.76 : 0.24, y: 0.3 + ((s * 37) % 40) / 100 } : { x: clamp(0.5 + dir * 0.12), y: shooter ? shooter.y : 0.5 };
    const goalX = side === 0 ? 1 : 0;
    const end = !ev
      ? { x: 0.5 + dir * 0.04, y: 0.5 }
      : ev.kind === "goal"
        ? { x: goalX, y: s % 2 ? 0.44 : 0.56 }
        : ev.kind === "miss"
          ? { x: goalX, y: s % 2 ? 0.1 : 0.9 }
          : { x: side === 0 ? 0.95 : 0.05, y: p2.y * 0.3 + 0.35 }; // save / disallowed: the keeper gets it

    const leg = sliceMs / 3;
    const ease = Easing.inOut(Easing.quad);
    const cut = Easing.out(Easing.quad);
    // the shooter runs from his spot to where he'll get the ball, then the move is over and he's back in line
    const back = setTimeout(() => runKey.set(""), sliceMs * 0.95);
    if (ev && shooter) {
      runKey.set(shooter.key);
      rx.set(shooter.x);
      ry.set(shooter.y);
      rx.set(withTiming(p2.x, { duration: leg * 2, easing: ease }));
      ry.set(withTiming(p2.y, { duration: leg * 2, easing: ease }));
      bx.set(withSequence(withTiming(p1.x, { duration: leg, easing: ease }), withTiming(p2.x, { duration: leg, easing: ease }), withTiming(end.x, { duration: leg, easing: cut })));
      by.set(withSequence(withTiming(p1.y, { duration: leg, easing: ease }), withTiming(p2.y, { duration: leg, easing: ease }), withTiming(end.y, { duration: leg, easing: cut })));
    } else {
      // a quiet minute: a carrier dribbles a few yards, then a quick one-two and a pass on (four short touches)
      const carrier = team[(s * 5) % Math.max(1, team.length)] ?? shooter;
      const mate = team[(s * 5 + 2) % Math.max(1, team.length)] ?? carrier;
      const wob = (k: number) => (((s * 13 + k * 29) % 21) - 10) / 100;
      const start = carrier ? { x: carrier.x + (bx.get() - 0.5) * FOLLOW[carrier.pos], y: carrier.y } : { x: bx.get(), y: by.get() };
      const drib = { x: clamp(start.x + dir * 0.08), y: clamp(start.y + wob(1)) };
      const pass = mate ? { x: clamp(mate.x + dir * 0.1), y: clamp(mate.y + wob(2)) } : drib;
      const ret = { x: clamp(drib.x + dir * 0.06), y: clamp(drib.y + wob(3)) };
      const on = { x: clamp(ret.x + dir * 0.1), y: clamp(0.5 + wob(4) * 2.5) };
      const q = sliceMs / 4;
      if (carrier) {
        runKey.set(carrier.key);
        rx.set(start.x);
        ry.set(start.y);
        rx.set(withSequence(withTiming(drib.x, { duration: q, easing: ease }), withTiming(drib.x + dir * 0.03, { duration: q }), withTiming(ret.x, { duration: q, easing: ease })));
        ry.set(withSequence(withTiming(drib.y, { duration: q, easing: ease }), withTiming(drib.y, { duration: q }), withTiming(ret.y, { duration: q, easing: ease })));
      }
      bx.set(withSequence(withTiming(drib.x, { duration: q, easing: ease }), withTiming(pass.x, { duration: q, easing: cut }), withTiming(ret.x, { duration: q, easing: cut }), withTiming(on.x, { duration: q, easing: cut })));
      by.set(withSequence(withTiming(drib.y, { duration: q, easing: ease }), withTiming(pass.y, { duration: q, easing: cut }), withTiming(ret.y, { duration: q, easing: cut }), withTiming(on.y, { duration: q, easing: cut })));
    }
    if (ev?.kind === "goal") flash.set(withSequence(withTiming(0, { duration: leg * 2 }), withTiming(1, { duration: 160 }), withTiming(0, { duration: 700 })));
    // the shot's trail appears as the ball leaves his foot
    const id = ev ? setTimeout(() => setShot({ from: p2, to: end, kind: ev.kind, id: s }), leg * 2) : null;
    return () => {
      clearTimeout(back);
      if (id) clearTimeout(id);
    };
  }, [shown, over, events, home, away, sliceMs, bx, by, flash, runKey, rx, ry]);

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

      {shot && <ShotTrail key={shot.id} shot={shot} width={width} height={height} ms={sliceMs / 3} />}

      {[...home, ...away].map((d) => (
        <Player key={d.key} d={d} kit={d.gk ? KEEPER[d.home ? "home" : "away"] : d.home ? kits.home : kits.away} bx={bx} by={by} runKey={runKey} rx={rx} ry={ry} width={width} height={height} />
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

/** the shot's flight: a dashed line from the shooter to where the ball ended, fading out */
function ShotTrail({ shot, width, height, ms }: { shot: Shot; width: number; height: number; ms: number }) {
  const o = useSharedValue(0);
  useEffect(() => {
    o.set(withSequence(withTiming(1, { duration: ms * 0.6 }), withDelay(ms, withTiming(0, { duration: 500 }))));
  }, [o, ms]);
  const style = useAnimatedStyle(() => ({ opacity: o.get() }));
  const color = shot.kind === "goal" ? "#FDE047" : "rgba(255,255,255,0.85)";
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width={width} height={height}>
        <Line x1={shot.from.x * width} y1={shot.from.y * height} x2={shot.to.x * width} y2={shot.to.y * height} stroke={color} strokeWidth={3} strokeDasharray="6 5" strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
}

/**
 * One player: holds his line while the team shifts with the ball, goes for the
 * ball when it's near, runs to his shooting spot when it's his move, and a
 * keeper dives towards a shot that reaches his goal.
 */
function Player({
  d,
  kit,
  bx,
  by,
  runKey,
  rx,
  ry,
  width,
  height,
}: {
  d: Dot;
  kit: Kit;
  bx: SharedValue<number>;
  by: SharedValue<number>;
  runKey: SharedValue<string>;
  rx: SharedValue<number>;
  ry: SharedValue<number>;
  width: number;
  height: number;
}) {
  const size = 28;
  const follow = FOLLOW[d.pos];
  const style = useAnimatedStyle(() => {
    const ballX = bx.get();
    const ballY = by.get();
    let x = d.x + (ballX - 0.5) * follow;
    let y = d.y + (ballY - d.y) * (d.gk ? 0.15 : 0.2);
    let rotate = 0;
    if (runKey.get() === d.key) {
      // his run: straight to the spot he shoots from
      x = rx.get();
      y = ry.get();
    } else if (d.gk) {
      // keeper: comes across with a shot near his goal and dives at it
      const near = Math.max(0, 1 - Math.abs(ballX - d.x) / 0.2);
      y += (ballY - y) * near * 0.85;
      rotate = (ballY - d.y) * near * 140 * (d.home ? 1 : -1);
    } else {
      // near the ball: go for it
      const dist = Math.hypot(ballX - x, (ballY - y) * 0.66);
      const chase = Math.max(0, 1 - dist / 0.22) * 0.55;
      x += (ballX - x) * chase;
      y += (ballY - y) * chase;
    }
    return { transform: [{ translateX: x * width - size / 2 }, { translateY: y * height - size / 2 }, { rotate: `${rotate}deg` }] };
  });
  return (
    <Animated.View style={[styles.player, { width: size, height: size + 9 }, style]}>
      <Jersey body={kit.body} sleeves={kit.sleeves} pattern={kit.pattern} numberColor="#000" number={0} size={size} variant="crew" hideNumber />
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
  player: { position: "absolute", left: 0, top: 0, alignItems: "center" },
  playerText: { fontSize: 8, fontWeight: "900", color: "white", marginTop: -3, textShadowColor: "rgba(0,0,0,0.55)", textShadowRadius: 2 },
  ball: { position: "absolute", left: 0, top: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: "white", borderWidth: 2, borderColor: C.text, zIndex: 5 },
  flash: { backgroundColor: "#FACC15" },
  goalTag: { position: "absolute", alignSelf: "center", top: 10, backgroundColor: C.greenDark, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 5, zIndex: 6 },
  goalText: { fontFamily: F.black, fontSize: 20, color: "white" },
});
