import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Ellipse, Line, Rect } from "react-native-svg";

import { SPOT_DIRS, SPOT_KICKS, SPOT_PICK_MS, spotKicker, spotOther, type SpotDir, type SpotKick, type SpotMark } from "@/lib/spot";

import { haptic, useClockTicks } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { play } from "~/lib/sound";
import type { SpotMatch } from "~/lib/spotMatch";
import { C, F, R, T } from "~/lib/theme";

import { GameActions } from "./GameActions";
import { MARK } from "./HatTrickBoard";
import { Jersey } from "./Jersey";
import { Text } from "./Text";
import { Button, Card, Tap } from "./ui";

const GOAL_RATIO = 2.3;
const GRASS_H = 118;
const ARROW: Record<SpotDir, string> = { l: "←", c: "↑", r: "→" };
const SHIFT: Record<SpotDir, number> = { l: -1, c: 0, r: 1 };

/** Each player's kicks as a row of dots: green scored, red missed, hollow still to come. */
function KickDots({ kicks, mark }: { kicks: SpotKick[]; mark: SpotMark }) {
  const mine = kicks.filter((k) => k.kicker === mark);
  const slots = Math.max(SPOT_KICKS, Math.ceil(kicks.length / 2));
  return (
    <View style={styles.dots}>
      {Array.from({ length: slots }, (_, i) => (
        <View key={i} style={[styles.dot, mine[i] && { backgroundColor: mine[i].goal ? C.green : C.red, borderColor: "transparent" }]} />
      ))}
    </View>
  );
}

/** The goal, the keeper and the ball: the keeper and ball slide flat (no 3D: see PossessionBoard). */
function Goal({ width, kicker, shot, dive, reveal, chosen, canPick, onPick }: { width: number; kicker: SpotMark; shot: SpotDir | null; dive: SpotDir | null; reveal: boolean; chosen: SpotDir | null; canPick: boolean; onPick: (d: SpotDir) => void }) {
  const { t } = useI18n();
  const h = width / GOAL_RATIO;
  const third = width / 3;
  const keeperX = useSharedValue(0);
  const keeperTilt = useSharedValue(0);
  const ballX = useSharedValue(0);
  const ballY = useSharedValue(0);
  const ballScale = useSharedValue(1);

  useEffect(() => {
    const ease = { duration: reveal ? 420 : 200, easing: Easing.out(Easing.cubic) };
    keeperX.set(withTiming(reveal && dive ? SHIFT[dive] * third : 0, ease));
    keeperTilt.set(withTiming(reveal && dive ? SHIFT[dive] * 62 : 0, ease));
    ballX.set(withTiming(reveal && shot ? SHIFT[shot] * third * 0.92 : 0, ease));
    ballY.set(withTiming(reveal && shot ? -(GRASS_H + h * 0.42) : 0, ease));
    ballScale.set(withTiming(reveal && shot ? 0.62 : 1, ease));
  }, [reveal, shot, dive, third, h, keeperX, keeperTilt, ballX, ballY, ballScale]);

  const keeperStyle = useAnimatedStyle(() => ({ transform: [{ translateX: keeperX.get() }, { rotate: `${keeperTilt.get()}deg` }] }));
  const ballStyle = useAnimatedStyle(() => ({ transform: [{ translateX: ballX.get() }, { translateY: ballY.get() }, { scale: ballScale.get() }] }));
  const keeperMark = spotOther(kicker);
  const label = { l: t("spLeft"), c: t("spCenter"), r: t("spRight") };

  return (
    <View style={{ width, height: h + GRASS_H }}>
      <Svg width={width} height={h + GRASS_H} style={StyleSheet.absoluteFill}>
        <Rect x={0} y={h} width={width} height={GRASS_H} rx={R.inner} fill={C.greenMid} />
        <Rect x={0} y={h + GRASS_H / 3} width={width} height={GRASS_H / 3} fill="#1F9D55" />
        <Line x1={0} y1={h + 1} x2={width} y2={h + 1} stroke="white" strokeWidth={3} />
        <Ellipse cx={width / 2} cy={h + GRASS_H - 16} rx={20} ry={6} fill="white" />
        {Array.from({ length: 13 }, (_, i) => (
          <Line key={`v${i}`} x1={(width / 12) * i} y1={4} x2={(width / 12) * i} y2={h} stroke="#CBD5D0" strokeWidth={1} />
        ))}
        {Array.from({ length: 6 }, (_, i) => (
          <Line key={`h${i}`} x1={0} y1={4 + ((h - 4) / 5) * i} x2={width} y2={4 + ((h - 4) / 5) * i} stroke="#CBD5D0" strokeWidth={1} />
        ))}
        <Rect x={2} y={2} width={width - 4} height={h} fill="none" stroke="white" strokeWidth={5} />
        <Rect x={2} y={2} width={width - 4} height={h} fill="none" stroke="#9CA9A2" strokeWidth={1} />
      </Svg>

      <Animated.View pointerEvents="none" style={[styles.keeper, { left: width / 2 - 34, top: h - 74 }, keeperStyle]}>
        <Jersey body={MARK[keeperMark].color} sleeves={MARK[keeperMark].color} numberColor="white" number={1} size={68} />
      </Animated.View>

      {SPOT_DIRS.map((d, i) => (
        <Tap
          key={d}
          disabled={!canPick}
          onPress={() => onPick(d)}
          accessibilityRole="button"
          accessibilityLabel={label[d]}
          accessibilityState={{ selected: chosen === d, disabled: !canPick }}
          style={[styles.zone, { left: i * third, width: third, height: h }, chosen === d && styles.zoneOn]}
        >
          {canPick && <Text style={styles.zoneArrow}>{ARROW[d]}</Text>}
        </Tap>
      ))}

      <Animated.View pointerEvents="none" style={[styles.ball, { left: width / 2 - 17, top: h + GRASS_H - 52 }, ballStyle]}>
        <Text allowFontScaling={false} style={{ fontSize: 30 }}>
          ⚽
        </Text>
      </Animated.View>
    </View>
  );
}

/** The Spot: score, the goal with its three sides, and the rival's habits so far. */
export function SpotBoard({ m, footer }: { m: SpotMatch; footer?: React.ReactNode }) {
  const { t } = useI18n();
  const [width, setWidth] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const last = m.kicks[m.kicks.length - 1] ?? null;
  const reveal = m.phase === "reveal" && !!last;
  const kicker = reveal ? last.kicker : spotKicker(m.kicks);
  const iKick = kicker === m.mark;
  const live = !m.over && !m.peerLeft;
  const canPick = live && m.phase === "pick" && !m.mine;
  const secs = m.phase === "pick" && m.deadline ? Math.max(0, Math.ceil((m.deadline - now) / 1000)) : null;
  const sudden = m.kicks.length >= SPOT_KICKS * 2;

  useEffect(() => {
    if (!live || m.phase !== "pick") return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [live, m.phase]);
  useClockTicks(secs, canPick);

  // the moment a kick lands: good news for this phone or bad
  const told = useRef(m.kicks.length);
  useEffect(() => {
    if (m.kicks.length < told.current) told.current = 0;
    if (m.phase !== "reveal" || !last || told.current === m.kicks.length) return;
    told.current = m.kicks.length;
    const mineWent = last.kicker === m.mark ? last.goal : !last.goal;
    if (last.goal) play("goal");
    else play(mineWent ? "correct" : "wrong");
    if (mineWent) haptic.success();
    else haptic.warning();
  }, [m.phase, m.kicks.length, last, m.mark]);

  const rival = spotOther(m.mark);
  const tape = iKick ? m.kicks.filter((k) => k.kicker === m.mark).map((k) => k.dive) : m.kicks.filter((k) => k.kicker === rival).map((k) => k.shot);
  const outcome = !reveal ? null : last.shot === null ? t("spNoShot") : last.goal ? t("spGoal") : t("spSaved");
  const prompt = m.mine ? t("spWaiting") : t(iKick ? "spPickShot" : "spPickDive");

  return (
    <View style={{ flex: 1 }}>
      <Card style={styles.score}>
        {([m.mark, rival] as SpotMark[]).map((mark) => (
          <View key={mark} style={styles.scoreRow}>
            <View style={[styles.tag, { backgroundColor: MARK[mark].color }]} />
            <Text style={styles.name} numberOfLines={1}>
              {mark === m.mark ? t("you") : m.opponent?.nick || t("opponent")}
            </Text>
            <KickDots kicks={m.kicks} mark={mark} />
            <Text style={styles.goals}>{mark === m.mark ? m.score.me : m.score.them}</Text>
          </View>
        ))}
      </Card>

      <View style={styles.status}>
        {outcome ? (
          <Text style={[styles.outcome, { color: (last?.kicker === m.mark) === last?.goal ? C.green : C.red }]}>{outcome}</Text>
        ) : live ? (
          <>
            <Text style={styles.prompt} numberOfLines={1}>
              {sudden ? `${t("spSudden")} · ` : ""}
              {prompt}
            </Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${((secs ?? 0) * 1000 * 100) / SPOT_PICK_MS}%`, backgroundColor: MARK[m.mark].color }]} />
            </View>
          </>
        ) : null}
      </View>

      <View style={{ width: "100%" }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && <Goal width={width} kicker={kicker} shot={reveal ? last.shot : null} dive={reveal ? last.dive : null} reveal={reveal} chosen={reveal ? null : m.mine} canPick={canPick} onPick={m.pick} />}
      </View>

      <View style={styles.tape}>
        <Text style={T.caption}>{t(iKick ? "spTapeDives" : "spTapeShots")}</Text>
        <Text style={styles.tapeArrows} accessibilityElementsHidden importantForAccessibility="no">
          {tape.length ? tape.slice(-6).map((d) => (d ? ARROW[d] : "·")).join("  ") : "–"}
        </Text>
      </View>

      {live ? <GameActions onForfeit={m.forfeit} /> : footer}
    </View>
  );
}

/** Under the board at full time. */
export function SpotEnd({ m, onNew }: { m: SpotMatch; onNew?: () => void }) {
  const { t } = useI18n();
  const line = m.draw
    ? t("spDraw")
    : m.endReason === "forfeit" || m.endReason === "left"
      ? t(m.won ? "wmForfeitWon" : "wmForfeitLost")
      : t(m.won ? "spWon" : "spLost");
  return (
    <View style={{ gap: 10, marginTop: 10 }}>
      <Text style={[T.headline, { textAlign: "center" }]}>{line}</Text>
      {m.waitingAgain && <Text style={[T.body, { textAlign: "center" }]}>{t("htRematchWaiting")}</Text>}
      {m.rematch && <Button title={t(m.rivalWantsAgain ? "htAccept" : "htRematch")} icon="arrow.clockwise" onPress={m.rematch} />}
      {onNew && <Button title={t("htNewGame")} kind="secondary" icon="play.fill" onPress={onNew} />}
    </View>
  );
}

const styles = StyleSheet.create({
  score: { paddingVertical: 10, paddingHorizontal: 14, gap: 8 },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  tag: { width: 5, height: 22, borderRadius: 3 },
  name: { flex: 1, fontSize: 15, fontWeight: "700", color: C.text },
  dots: { flexDirection: "row", gap: 5 },
  dot: { width: 13, height: 13, borderRadius: 7, borderWidth: 1.5, borderColor: C.border },
  goals: { fontFamily: F.black, fontSize: 24, lineHeight: 27, minWidth: 22, textAlign: "right", color: C.text },
  status: { height: 62, alignItems: "center", justifyContent: "center", gap: 6 },
  prompt: { fontFamily: F.display, fontSize: 21, color: C.text },
  outcome: { fontFamily: F.black, fontSize: 38, lineHeight: 42 },
  track: { alignSelf: "stretch", height: 6, borderRadius: 3, backgroundColor: "#E3E8E4", overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },
  keeper: { position: "absolute", width: 68, alignItems: "center" },
  zone: { position: "absolute", top: 0, alignItems: "center", justifyContent: "center" },
  zoneOn: { backgroundColor: "rgba(250, 204, 21, 0.4)", borderRadius: R.inner },
  zoneArrow: { fontFamily: F.black, fontSize: 30, color: "rgba(15, 23, 20, 0.35)" },
  ball: { position: "absolute", width: 34, alignItems: "center" },
  tape: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10, marginBottom: 6 },
  tapeArrows: { fontFamily: F.display, fontSize: 20, color: C.text },
});
