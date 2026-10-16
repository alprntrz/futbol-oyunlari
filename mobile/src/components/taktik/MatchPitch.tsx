import { useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Line } from "react-native-svg";

import { SLOTS, type Pos } from "@/lib/taktik/rules";
import type { MatchEvent, Unit } from "@/lib/taktik/types";

import { TAKTIK } from "~/lib/brand";
import { useI18n } from "~/lib/i18n";
import { C, F } from "~/lib/theme";

import { CLUB_KITS, type Kit } from "../HatTrickBoard";
import { Jersey } from "../Jersey";
import { Text } from "../Text";
import { clubCriterion, surname } from "./Card";

/** the full portrait pitch picture: its height over width, and where its touchlines sit (measured from pitch-full) */
export const PITCH_RATIO = 1364 / 900;
const FIELD = { left: 0.05, right: 0.95, top: 0.053, bottom: 0.931 };

/** where each line stands in its own half at kick-off (0 = own goal line, 0.5 = halfway) */
const DEPTH: Record<Pos, number> = { GK: 0.05, DEF: 0.19, MID: 0.31, FWD: 0.43 };
/** how far each line follows the ball up and down the pitch */
const FOLLOW: Record<Pos, number> = { GK: 0.05, DEF: 0.28, MID: 0.42, FWD: 0.5 };
/** shirt numbers by spot: keeper 1, back four 2–5, midfield 6, 8, 10, 7, front three 9, 11, 7 */
const NUMBER = [1, 2, 5, 4, 3, 6, 8, 10, 7, 9, 11, 7];
/** each side's colour on its name tags (me blue, the opponent red) */
export const SIDE = { home: "#2563EB", away: "#F43F5E" };

type Dot = { key: string; x: number; y: number; name: string; label: string; gk: boolean; pos: Pos; home: boolean; club: string | null; number: number };
type Lined = { name: string; pos: Pos; club: string | null; number: number };

/**
 * A side's players by line. `x` runs along the pitch from my goal (0) to theirs (1),
 * `y` across it; I attack up the screen, the opponent down.
 */
function lineUp(units: Lined[], home: boolean): Dot[] {
  const byLine = new Map<Pos, Lined[]>();
  for (const u of units) byLine.set(u.pos, [...(byLine.get(u.pos) ?? []), u]);
  const out: Dot[] = [];
  for (const [pos, us] of byLine) {
    us.forEach((u, i) => {
      const x = DEPTH[pos];
      const y = us.length === 1 ? 0.5 : 0.14 + (0.72 * i) / (us.length - 1);
      out.push({ key: `${home ? "h" : "a"}-${pos}-${i}`, x: home ? x : 1 - x, y: home ? y : 1 - y, name: u.name, label: u.name ? surname(u.name) : "", gk: pos === "GK", pos, home, club: u.club, number: u.number });
    });
  }
  return out;
}

const onPitch = (units: Unit[]): Lined[] => units.filter((u) => u.slot !== null).map((u) => ({ name: u.name, pos: SLOTS[u.slot!], club: u.club, number: NUMBER[u.slot!] }));

/** a friendly side has no squad to show: a faceless side of about my size */
const ghostOf = (n: number) =>
  Array.from({ length: Math.max(3, n) }, (_, i): Lined => ({ name: "", pos: i === 0 ? "GK" : i < 4 ? "DEF" : i < 7 ? "MID" : "FWD", club: null, number: [1, 2, 3, 4, 6, 8, 7, 9, 11, 10, 5][i] ?? i + 1 }));

/** a player's shirt: his card's club kit, or his side's plain colour */
function kitOf(d: { club: string | null; home: boolean }): Kit {
  const c = clubCriterion(d.club);
  return (c && (CLUB_KITS[c.id] ?? (c.c1 ? { body: c.c1, sleeves: c.c1 } : null))) ?? (d.home ? { body: "#1D4ED8", sleeves: "#1D4ED8" } : { body: "#1E3A8A", sleeves: "#1E3A8A" });
}
const numberInk = (kit: Kit) => (["#FFFFFF", "#FACC15", "#FDE047", "#F8FAFC"].includes(kit.body.toUpperCase()) ? "#111111" : "#FFFFFF");

/** a shot's flight, drawn for a moment: from where it was hit to where it ended */
type Shot = { from: { x: number; y: number }; to: { x: number; y: number }; kind: MatchEvent["kind"]; id: number };

/**
 * A Pitch Chess match on the full portrait pitch: my side in the bottom half
 * attacking up, the opponent's walking into the top half. Each slice is a short
 * move; a slice with an event ends in that player's shot (its trail drawn) that
 * goes in, is saved with a dive or goes wide. Players wear their cards' shirts
 * with a name tag in their side's colour.
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
  const height = width * PITCH_RATIO;
  const fw = (FIELD.right - FIELD.left) * width;
  const fh = (FIELD.bottom - FIELD.top) * height;
  const home = useMemo(() => lineUp(onPitch(mine), true), [mine]);
  const away = useMemo(() => lineUp(theirs ? onPitch(theirs) : ghostOf(home.length), false), [theirs, home.length]);

  // along the pitch (x, my goal 0) and across it (y)
  const bx = useSharedValue(0.5);
  const by = useSharedValue(0.5);
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
    const clamp = (v: number) => Math.min(0.94, Math.max(0.06, v));
    const leg = sliceMs / 3;
    const ease = Easing.inOut(Easing.quad);
    const cut = Easing.out(Easing.quad);
    const back = setTimeout(() => runKey.set(""), sliceMs * 0.95);
    let id: ReturnType<typeof setTimeout> | null = null;

    if (ev) {
      // the event's player runs to the edge of the box and shoots it himself
      const shooter = team.find((d) => d.name === ev.name) ?? [...team].sort((a, b) => dir * (b.x - a.x))[0];
      const passer = team.find((d) => d !== shooter) ?? shooter;
      const p1 = passer ? { x: clamp(passer.x + dir * 0.16), y: passer.y } : { x: 0.5, y: 0.5 };
      const p2 = { x: side === 0 ? 0.8 : 0.2, y: 0.3 + ((s * 37) % 40) / 100 };
      const goalX = side === 0 ? 1 : 0;
      const end =
        ev.kind === "goal" ? { x: goalX, y: s % 2 ? 0.45 : 0.55 } : ev.kind === "miss" ? { x: goalX, y: s % 2 ? 0.12 : 0.88 } : { x: side === 0 ? 0.96 : 0.04, y: p2.y * 0.3 + 0.35 };
      if (shooter) {
        runKey.set(shooter.key);
        rx.set(shooter.x);
        ry.set(shooter.y);
        rx.set(withTiming(p2.x, { duration: leg * 2, easing: ease }));
        ry.set(withTiming(p2.y, { duration: leg * 2, easing: ease }));
      }
      bx.set(withSequence(withTiming(p1.x, { duration: leg, easing: ease }), withTiming(p2.x, { duration: leg, easing: ease }), withTiming(end.x, { duration: leg, easing: cut })));
      by.set(withSequence(withTiming(p1.y, { duration: leg, easing: ease }), withTiming(p2.y, { duration: leg, easing: ease }), withTiming(end.y, { duration: leg, easing: cut })));
      id = setTimeout(() => setShot({ from: p2, to: end, kind: ev.kind, id: s }), leg * 2);
    } else {
      // a quiet minute: a carrier dribbles a few yards, a one-two and a pass on
      const carrier = team[(s * 5) % Math.max(1, team.length)];
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
    return () => {
      clearTimeout(back);
      if (id) clearTimeout(id);
    };
  }, [shown, over, events, home, away, sliceMs, bx, by, runKey, rx, ry]);

  const ballStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: FIELD.left * width + by.get() * fw - 8 }, { translateY: FIELD.top * height + (1 - bx.get()) * fh - 8 }],
  }));

  const shirt = Math.min(40, width * 0.095);
  return (
    <View style={{ width, height, alignSelf: "center" }}>
      {/* explicit size: absoluteFill on an Image misrenders in RN */}
      <Image source={TAKTIK.pitch.full} style={{ position: "absolute", left: 0, top: 0, width, height }} />
      {shot && <ShotTrail key={shot.id} shot={shot} width={width} height={height} fw={fw} fh={fh} ms={sliceMs / 3} />}

      {home.map((d) => (
        <Player key={d.key} d={d} shirt={shirt} bx={bx} by={by} runKey={runKey} rx={rx} ry={ry} width={width} height={height} fw={fw} fh={fh} />
      ))}
      {/* the opponent walks in from the far end at kick-off */}
      {away.map((d, i) => (
        <Animated.View key={d.key} entering={FadeInDown.delay(150 + i * 70).duration(420)} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Player d={d} shirt={shirt} bx={bx} by={by} runKey={runKey} rx={rx} ry={ry} width={width} height={height} fw={fw} fh={fh} />
        </Animated.View>
      ))}

      <Animated.Image source={TAKTIK.pitch.ballTop} style={[styles.ball, ballStyle]} />

      {goalNow && (
        <Animated.View key={`g-${shown}`} entering={FadeIn.delay(sliceMs * 0.66).duration(180)} exiting={FadeOut.duration(250)} style={[styles.goalBanner, { top: height * 0.2 }]} pointerEvents="none">
          <Text style={styles.goalText} numberOfLines={1}>
            {t("ttkGoalBanner").replace("{name}", surname(goalNow.name))}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

/** the shot's flight: a dashed line from the shooter to where the ball ended, fading out */
function ShotTrail({ shot, width, height, fw, fh, ms }: { shot: Shot; width: number; height: number; fw: number; fh: number; ms: number }) {
  const o = useSharedValue(0);
  useEffect(() => {
    o.set(withSequence(withTiming(1, { duration: ms * 0.6 }), withDelay(ms, withTiming(0, { duration: 500 }))));
  }, [o, ms]);
  const style = useAnimatedStyle(() => ({ opacity: o.get() }));
  const px = (p: { x: number; y: number }) => ({ x: FIELD.left * width + p.y * fw, y: FIELD.top * height + (1 - p.x) * fh });
  const a = px(shot.from);
  const b = px(shot.to);
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width={width} height={height}>
        <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={shot.kind === "goal" ? "#FDE047" : "white"} strokeWidth={2.5} strokeDasharray="6 5" strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
}

/**
 * One player: holds his line while the team shifts with the ball, goes for it
 * when it's near, makes his run when it's his move; a keeper comes across and
 * dives at a shot near his goal.
 */
function Player({
  d,
  shirt,
  bx,
  by,
  runKey,
  rx,
  ry,
  width,
  height,
  fw,
  fh,
}: {
  d: Dot;
  shirt: number;
  bx: SharedValue<number>;
  by: SharedValue<number>;
  runKey: SharedValue<string>;
  rx: SharedValue<number>;
  ry: SharedValue<number>;
  width: number;
  height: number;
  fw: number;
  fh: number;
}) {
  const kit = kitOf(d);
  const follow = FOLLOW[d.pos];
  const boxW = shirt * 2.1;
  const style = useAnimatedStyle(() => {
    const ballX = bx.get();
    const ballY = by.get();
    let x = d.x + (ballX - 0.5) * follow;
    let y = d.y + (ballY - d.y) * (d.gk ? 0.15 : 0.2);
    let rotate = 0;
    if (runKey.get() === d.key) {
      x = rx.get();
      y = ry.get();
    } else if (d.gk) {
      const near = Math.max(0, 1 - Math.abs(ballX - d.x) / 0.2);
      y += (ballY - y) * near * 0.85;
      rotate = (ballY - d.y) * near * 120;
    } else {
      const dist = Math.hypot(ballX - x, ballY - y);
      const chase = Math.max(0, 1 - dist / 0.18) * 0.55;
      x += (ballX - x) * chase;
      y += (ballY - y) * chase;
    }
    y = Math.min(0.97, Math.max(0.03, y));
    return {
      transform: [{ translateX: FIELD.left * width + y * fw - boxW / 2 }, { translateY: FIELD.top * height + (1 - x) * fh - shirt * 0.6 }, { rotate: `${rotate}deg` }],
    };
  });
  return (
    <Animated.View style={[styles.player, { width: boxW }, style]}>
      <Jersey body={kit.body} sleeves={kit.sleeves} pattern={kit.pattern} numberColor={numberInk(kit)} number={d.number} size={shirt} variant="crew" />
      {d.label ? (
        <View style={[styles.tag, { borderBottomColor: d.home ? SIDE.home : SIDE.away }]}>
          <Text allowFontScaling={false} style={styles.tagText} numberOfLines={1}>
            {d.label}
          </Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  player: { position: "absolute", left: 0, top: 0, alignItems: "center" },
  tag: { marginTop: -3, maxWidth: "100%", backgroundColor: "white", borderRadius: 3, paddingHorizontal: 4, borderBottomWidth: 2.5 },
  tagText: { fontFamily: F.display, fontSize: 11, lineHeight: 13, color: C.text },
  ball: { position: "absolute", left: 0, top: 0, width: 16, height: 16, zIndex: 5 },
  goalBanner: { position: "absolute", left: "8%", right: "8%", backgroundColor: C.greenMid, borderRadius: 10, borderWidth: 2, borderColor: "white", paddingVertical: 8, alignItems: "center", zIndex: 6 },
  goalText: { fontFamily: F.black, fontSize: 26, color: "white" },
});
