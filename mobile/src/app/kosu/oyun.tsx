import { Stack, router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Image, StyleSheet, useWindowDimensions, View, type GestureResponderEvent } from "react-native";
import Animated, { FadeInDown, FadeOut, ZoomIn, runOnJS, useAnimatedReaction, useAnimatedStyle, useFrameCallback, useSharedValue, type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LANE, multOf, newRun, nextGoalOf, obstacleX, POWER_S, scoreOf, step, type Input, type PowerKind, type RunState } from "@/lib/kosu/engine";
import { quizQuestions } from "@/lib/quiz";

import { CLUB_KITS } from "~/components/HatTrickBoard";
import { Jersey } from "~/components/Jersey";
import { FocusStatusBar } from "~/components/StadiumHeader";
import { Text } from "~/components/Text";
import { Button, Icon, Tap } from "~/components/ui";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { recordRun, useFavClub } from "~/lib/kosu";
import { TAKTIK } from "~/lib/brand";
import { play } from "~/lib/sound";
import { C, F, R, shadow } from "~/lib/theme";
import { useXpAward } from "~/lib/xp";

/** camera: this far behind the runner, this high; FX = pixels per metre at 1 m (× screen width) */
const CAM_BACK = 5;
const CAM_H = 7.5;
const FX = 0.75;
/** ground stripes (mowing bands) */
const BAND = 3;
const BANDS = 30;
/** sprite pools */
const OBST = 18;
const COINS = 40;
const PICKUPS = 4;
/** each power-up's look (stand-ins until the art): colour, symbol, name key */
const POWER_LOOK: { color: string; icon: string; name: "rushP_boots" | "rushP_magnet" | "rushP_armband" | "rushP_double" }[] = [
  { color: "#F97316", icon: "👟", name: "rushP_boots" },
  { color: "#DC2626", icon: "🧲", name: "rushP_magnet" },
  { color: "#FACC15", icon: "🛡️", name: "rushP_armband" },
  { color: "#8B5CF6", icon: "✖️2", name: "rushP_double" },
];
/** the touchlines, and the advertising boards (blank) along them for a sense of speed */
const HALF = 4.4;
const BOARDS = 16;
const BOARD_GAP = 9;

/**
 * Dribbling Rush prototype: the run happens on the UI thread (useFrameCallback → engine
 * `step`), drawn as a 2.5D pitch rushing forward; swipes are read as soon as the finger moves.
 */
export default function RushGame() {
  "use no memo";
  const { t, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const [club] = useFavClub();
  const kit = CLUB_KITS[club] ?? { body: "#16A34A", sleeves: "#16A34A" };

  const state = useSharedValue<RunState>(newRun(1));
  const input = useSharedValue<Input>("");
  const running = useSharedValue(false);
  const [phase, setPhase] = useState<"ready" | "run" | "over">("ready");
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const [final, setFinal] = useState<{ score: number; coins: number; metres: number } | null>(null);
  const [runNo, setRunNo] = useState(0);
  /** this run's goal questions: text and the three options laid out by lane (-1, 0, 1 → 0, 1, 2) */
  const [questions, setQuestions] = useState<{ text: string; lanes: string[] }[]>([]);
  /** the goal now on screen (index into questions), whether its question shows, and the last goal's result */
  const [goalQ, setGoalQ] = useState(-1);
  const [ask, setAsk] = useState(false);
  const [flash, setFlash] = useState<{ id: number; goal: boolean; mult: number } | null>(null);
  const [mult, setMult] = useState(1);
  /** power-ups running: seconds left (boots, magnet, double) and the armband */
  const [powers, setPowers] = useState<{ boots: number; magnet: number; double: number; armband: number }>({ boots: 0, magnet: 0, double: 0, armband: 0 });
  const [toast, setToast] = useState<{ id: number; text: string; color: string } | null>(null);

  // the screen's projection, in numbers the worklets can use
  const fx = FX * W;
  const runnerY = H * 0.78;
  const horizon = runnerY - (fx * CAM_H) / CAM_BACK;

  const reportError = (msg: string) => console.warn("Dribbling Rush loop:", msg);
  useFrameCallback((frame) => {
    "worklet";
    if (!running.value) return;
    const dt = Math.min(0.05, (frame.timeSincePreviousFrame ?? 16) / 1000);
    const inp = input.value;
    if (inp) input.value = "";
    try {
      state.modify((s) => {
        "worklet";
        step(s, inp, dt);
        return s;
      }, true);
    } catch (e) {
      // never take the app down from the frame loop: stop and report
      running.value = false;
      runOnJS(reportError)(String(e));
    }
  });

  // sounds and haptics for what just happened, the HUD ten times a second, and the end
  // a goal or a save (counted apart: a coin in the same frame mustn't hide it)
  const onGoal = (goal: boolean, m: number) => {
    setFlash({ id: Date.now(), goal, mult: m });
    setMult(m);
    setAsk(false);
    if (goal) {
      haptic.success();
      play("correct");
    } else {
      haptic.warning();
      play("wrong");
    }
  };
  useAnimatedReaction(
    () => state.value.goalsScored * 1000 + state.value.saves,
    (v, prev) => {
      if (prev === null || v === prev || v === 0) return;
      runOnJS(onGoal)(Math.floor(v / 1000) > Math.floor(prev / 1000), state.value.mult);
    }
  );
  const onEvent = (e: RunState["lastEvent"], kind: number) => {
    if (e === "goal" || e === "save") return;
    if (e === "power") {
      haptic.success();
      play("coin");
      const look = POWER_LOOK[kind];
      setToast({ id: Date.now(), text: t(look.name), color: look.color });
      return;
    }
    if (e === "saved") {
      haptic.warning();
      setToast({ id: Date.now(), text: t("rushArmbandUsed"), color: "#CA8A04" });
      return;
    }
    if (e === "coin") haptic.tap();
    else if (e === "bump") haptic.warning();
    else if (e === "dead") {
      haptic.error();
      play("wrong");
    }
  };
  useAnimatedReaction(
    () => state.value.events,
    (n, prev) => {
      if (prev === null || n === prev) return;
      // the power-up just taken: the last one marked taken
      const ps = state.value.pickups;
      let kind = 0;
      for (let k = ps.length - 1; k >= 0; k--) if (ps[k].taken) {
        kind = ps[k].kind;
        break;
      }
      runOnJS(onEvent)(state.value.lastEvent, kind);
    }
  );
  useAnimatedReaction(
    () => Math.floor(scoreOf(state.value) / 5) * 5 + state.value.coinsTaken * 100000,
    () => {
      runOnJS(setScore)(scoreOf(state.value));
      runOnJS(setCoins)(state.value.coinsTaken);
    }
  );
  // power-up timers for the HUD, in tenths
  useAnimatedReaction(
    () => {
      const s = state.value;
      return `${Math.ceil(s.boots * 10)},${Math.ceil(s.magnet * 10)},${Math.ceil(s.double * 10)},${s.armband},${multOf(s)}`;
    },
    (v, prev) => {
      if (v === prev) return;
      const [b, m, d, a, x] = v.split(",").map(Number);
      runOnJS(setPowers)({ boots: b / 10, magnet: m / 10, double: d / 10, armband: a });
      runOnJS(setMult)(x);
    }
  );
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 1200);
    return () => clearTimeout(id);
  }, [toast]);
  const [newBest, setNewBest] = useState(false);
  // the next goal: which question, and show it once the goal is in sight
  useAnimatedReaction(
    () => {
      const g = nextGoalOf(state.value);
      return g ? g.q * 2 + (g.z - state.value.z < 95 ? 1 : 0) : -1;
    },
    (v, prev) => {
      if (v === prev) return;
      runOnJS(setGoalQ)(v < 0 ? -1 : Math.floor(v / 2));
      runOnJS(setAsk)(v >= 0 && v % 2 === 1);
    }
  );
  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 1300);
    return () => clearTimeout(id);
  }, [flash]);

  const end = (sc: number, c: number, m: number) => {
    setFinal({ score: sc, coins: c, metres: m });
    setNewBest(recordRun(sc));
    setTimeout(() => setPhase("over"), 900);
  };
  useAnimatedReaction(
    () => state.value.dead,
    (d, prev) => {
      if (d && !prev) runOnJS(end)(scoreOf(state.value), state.value.coinsTaken, Math.floor(state.value.z));
    }
  );

  useXpAward(phase === "over" && !!final, final ? `run-${runNo}-${final.score}` : null, "bonus", final ? Math.min(40, 5 + Math.floor(final.score / 60)) : 0, { practice: true, label: "Dribbling Rush" });

  const start = () => {
    // goal questions for this run (easy quiz, three options): the right one in a random lane
    const pick = (l: { tr: string; en: string }) => (locale === "tr" ? l.tr : l.en);
    const qs = quizQuestions(30, "players", "easy").map((q) => {
      const lane = Math.floor(Math.random() * 3);
      const wrong = q.options.filter((_, i) => i !== q.answer).slice(0, 2);
      const lanes = [0, 1, 2].map((i) => (i === lane ? pick(q.options[q.answer]) : pick(wrong[i < lane ? i : i - 1])));
      return { text: pick(q.text), lanes, answer: lane - 1 };
    });
    setQuestions(qs);
    setMult(1);
    setPowers({ boots: 0, magnet: 0, double: 0, armband: 0 });
    setToast(null);
    setFlash(null);
    setAsk(false);
    state.set(newRun(Math.floor(Math.random() * 2 ** 31), qs.map((q) => q.answer)));
    input.set("");
    running.set(true);
    setFinal(null);
    setPhase("run");
    setRunNo((n) => n + 1);
  };
  useEffect(() => () => running.set(false), [running]);

  // swipes: fire as soon as the finger has moved far enough (no waiting for the lift)
  const touch = useRef<{ x: number; y: number; fired: boolean } | null>(null);
  const onStart = (e: GestureResponderEvent) => {
    touch.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, fired: false };
    if (phase === "ready") start();
  };
  const onMove = (e: GestureResponderEvent) => {
    const tc = touch.current;
    if (!tc || tc.fired || phase !== "run") return;
    const dx = e.nativeEvent.pageX - tc.x;
    const dy = e.nativeEvent.pageY - tc.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    tc.fired = true;
    input.set(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
  };

  const world = useAnimatedStyle(() => {
    const s = state.value.shake;
    return { transform: [{ translateX: s ? Math.sin(state.value.t * 90) * 7 * s * 3 : 0 }, { translateY: s ? Math.cos(state.value.t * 80) * 5 * s * 3 : 0 }] };
  });

  return (
    <View style={[styles.screen, { backgroundColor: "#7CC6F2" }]}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: phase !== "run" }} />
      <FocusStatusBar style="dark" />
      <Animated.View style={[StyleSheet.absoluteFill, world]} onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={() => (touch.current = null)}>
        {/* sky, the stands along the horizon, and the grass all the way down */}
        <View style={[styles.stands, { top: horizon - H * 0.07, height: H * 0.07 }]} />
        <View style={[styles.crowd, { top: horizon - H * 0.07, height: H * 0.035 }]} />
        <View style={[styles.grass, { top: horizon }]} />
        {Array.from({ length: BANDS }, (_, i) => (
          <Band key={i} i={i} state={state} W={W} fx={fx} horizon={horizon} />
        ))}
        {Array.from({ length: COINS }, (_, i) => (
          <CoinSprite key={`c${i}`} i={i} state={state} W={W} fx={fx} horizon={horizon} />
        ))}
        {Array.from({ length: OBST }, (_, i) => (
          <ObstacleSprite key={`o${i}`} i={i} state={state} W={W} fx={fx} horizon={horizon} />
        ))}
        {Array.from({ length: BOARDS }, (_, i) => (
          <BoardSprite key={`b${i}`} i={i} state={state} W={W} fx={fx} horizon={horizon} />
        ))}
        {Array.from({ length: PICKUPS }, (_, i) => (
          <PickupSprite key={`p${i}`} i={i} state={state} W={W} fx={fx} horizon={horizon} />
        ))}
        <GoalSprite state={state} W={W} fx={fx} horizon={horizon} lanes={goalQ >= 0 ? (questions[goalQ]?.lanes ?? null) : null} />
        <Runner state={state} W={W} fx={fx} horizon={horizon} kit={kit} />
      </Animated.View>

      {/* HUD */}
      <View style={[styles.hud, { top: insets.top + 8 }]} pointerEvents="box-none">
        <Tap onPress={() => router.back()} style={styles.back} accessibilityLabel={t("close")}>
          <Icon name="chevron.left" size={17} color={C.text} fallback="‹" />
        </Tap>
        <View style={{ flex: 1 }} />
        <View style={styles.pill}>
          <Text style={styles.pillText}>{score}</Text>
        </View>
        {mult > 1 && (
          <View style={[styles.pill, { backgroundColor: C.green }]}>
            <Text style={[styles.pillText, { color: "white" }]}>×{mult}</Text>
          </View>
        )}
        <View style={[styles.pill, { backgroundColor: "#FEF3C7" }]}>
          <Image source={TAKTIK.ui.coin} style={{ width: 20, height: 20 }} />
          <Text style={styles.pillText}>{coins}</Text>
        </View>
      </View>

      {/* power-ups running: a ring that empties as the time runs out */}
      <View style={[styles.powers, { top: insets.top + 54 + (ask ? 96 : 0) }]} pointerEvents="none">
        {([0, 1, 3] as PowerKind[]).map((k) => {
          const left = k === 0 ? powers.boots : k === 1 ? powers.magnet : powers.double;
          if (left <= 0) return null;
          return <PowerChip key={k} kind={k} share={left / POWER_S[k]} />;
        })}
        {powers.armband > 0 && <PowerChip kind={2} share={1} />}
      </View>
      {toast && (
        <Animated.View key={toast.id} entering={ZoomIn.duration(180)} exiting={FadeOut.duration(200)} style={styles.toast} pointerEvents="none">
          <Text style={[styles.toastText, { color: toast.color }]}>{toast.text}</Text>
        </Animated.View>
      )}

      {/* the goal's question, while it's coming up */}
      {phase === "run" && ask && goalQ >= 0 && questions[goalQ] && (
        <Animated.View entering={FadeInDown.duration(200)} exiting={FadeOut.duration(150)} style={[styles.question, { top: insets.top + 56 }]} pointerEvents="none">
          <Text style={styles.qLabel}>{t("rushGoalAsk")}</Text>
          <Text style={styles.qText}>{questions[goalQ].text}</Text>
        </Animated.View>
      )}
      {flash && (
        <Animated.View key={flash.id} entering={ZoomIn.duration(220)} exiting={FadeOut.duration(200)} style={styles.flash} pointerEvents="none">
          <Text style={[styles.flashText, { color: flash.goal ? C.green : C.red }]}>{flash.goal ? t("rushGoal") : t("rushSaved")}</Text>
          {flash.goal && flash.mult > 1 && <Text style={styles.flashMult}>×{flash.mult}</Text>}
        </Animated.View>
      )}

      {phase === "ready" && (
        <View style={styles.center} pointerEvents="none">
          <Text style={styles.big}>{t("rushTap")}</Text>
          <Text style={styles.small}>{t("rushHow")}</Text>
        </View>
      )}
      {phase === "over" && final && (
        <View style={[StyleSheet.absoluteFill, styles.overlay]}>
          <View style={styles.card}>
            <Text style={styles.big}>{t("rushOver")}</Text>
            <Text style={styles.score}>{final.score}</Text>
            {newBest && <Text style={[styles.small, { color: C.greenMid, fontWeight: "800" }]}>{t("rushNewBest")}</Text>}
            <Text style={styles.small}>
              {final.metres} m · {final.coins} {t("rushCoins")}
            </Text>
            <Button title={t("rushAgain")} icon="arrow.clockwise" onPress={start} style={{ alignSelf: "stretch", marginTop: 12 }} />
            <Button title={t("close")} kind="secondary" onPress={() => router.back()} style={{ alignSelf: "stretch", marginTop: 8 }} />
          </View>
        </View>
      )}
    </View>
  );
}

type View3D = { state: SharedValue<RunState>; W: number; fx: number; horizon: number };

/** world → screen: x / y in metres at world z; null when behind the camera */
function project(s: RunState, x: number, y: number, z: number, W: number, fx: number, horizon: number) {
  "worklet";
  const dz = z - (s.z - CAM_BACK);
  if (dz < 0.6) return null;
  const k = fx / dz;
  return { sx: W / 2 + (x - s.camX) * k, sy: horizon + (CAM_H + s.camY - y) * k, k, dz };
}

/** a mowing stripe of the pitch, with the lane dashes and touchlines */
function Band({ i, state, W, fx, horizon }: View3D & { i: number }) {
  const band = useAnimatedStyle(() => {
    const s = state.value;
    const z0 = Math.floor((s.z - CAM_BACK) / BAND) * BAND + i * BAND;
    const near = project(s, 0, 0, z0, W, fx, horizon);
    const far = project(s, 0, 0, z0 + BAND, W, fx, horizon);
    if (!near || !far) return { opacity: 0 };
    const light = Math.floor(z0 / BAND) % 2 === 0;
    return { opacity: 1, top: far.sy, height: Math.max(1, near.sy - far.sy + 0.5), backgroundColor: light ? "#58B85C" : "#4CAB51" };
  });
  const marks = useAnimatedStyle(() => {
    const s = state.value;
    const z0 = Math.floor((s.z - CAM_BACK) / BAND) * BAND + i * BAND;
    const p = project(s, 0, 0, z0 + BAND * 0.5, W, fx, horizon);
    if (!p) return { opacity: 0 };
    return { opacity: 1, top: p.sy - Math.max(1, p.k * 0.05), height: Math.max(1, p.k * 0.1), left: 0, width: W };
  });
  return (
    <>
      <Animated.View style={[styles.band, band]} />
      <Animated.View style={[styles.marks, marks]} pointerEvents="none">
        <Dash i={i} x={-LANE / 2} wide={0.08} line={false} state={state} W={W} fx={fx} horizon={horizon} />
        <Dash i={i} x={LANE / 2} wide={0.08} line={false} state={state} W={W} fx={fx} horizon={horizon} />
        <Dash i={i} x={-HALF} wide={0.16} line state={state} W={W} fx={fx} horizon={horizon} />
        <Dash i={i} x={HALF} wide={0.16} line state={state} W={W} fx={fx} horizon={horizon} />
      </Animated.View>
    </>
  );
}

/** a lane dash (or a stretch of touchline) on a band */
function Dash({ i, x, wide, line, state, W, fx, horizon }: View3D & { i: number; x: number; wide: number; line: boolean }) {
  const style = useAnimatedStyle(() => {
    const s = state.value;
    const z0 = Math.floor((s.z - CAM_BACK) / BAND) * BAND + i * BAND;
    const p = project(s, x, 0, z0 + BAND * 0.5, W, fx, horizon);
    if (!p) return { opacity: 0 };
    return { opacity: 1, left: p.sx - (wide * p.k) / 2, width: wide * p.k };
  });
  return <Animated.View style={[line ? styles.line : styles.dash, style]} />;
}

/** stand-in looks until the art is in: slide tackle (low, grey), wall (raised, striped), defender (tall), cones (low, orange) */
const OB_LOOK = [
  { w: 1.9, h: 0.55, color: "#8B95A1" },
  { w: 2.2, h: 1.7, color: "#64748B" },
  { w: 1.1, h: 2.0, color: "#DC2626" },
  { w: 1.8, h: 0.5, color: "#FB923C" },
];

function ObstacleSprite({ i, state, W, fx, horizon }: View3D & { i: number }) {
  const style = useAnimatedStyle(() => {
    const s = state.value;
    const o = s.obstacles[i];
    if (!o || o.z < s.z - 1.2) return { opacity: 0 };
    const p = project(s, obstacleX(o, s.z), 0, o.z, W, fx, horizon);
    if (!p || p.dz > 95) return { opacity: 0 };
    const look = OB_LOOK[o.kind];
    // a wall stands raised: its bottom edge sits above the ground, so you roll under
    const lift = o.kind === 1 ? 0.75 : 0;
    const w = look.w * p.k;
    const h = look.h * p.k;
    return {
      opacity: Math.min(1, (95 - p.dz) / 15),
      zIndex: Math.round(2000 - p.dz * 10),
      width: w,
      height: h,
      left: p.sx - w / 2,
      top: p.sy - h - lift * p.k,
      backgroundColor: look.color,
      borderRadius: Math.min(w, h) * 0.18,
    };
  });
  return <Animated.View style={[styles.obstacle, style]} />;
}

/** a blank advertising board standing on a touchline (alternating sides), rushing past */
function BoardSprite({ i, state, W, fx, horizon }: View3D & { i: number }) {
  const style = useAnimatedStyle(() => {
    const s = state.value;
    const span = BOARDS * BOARD_GAP;
    const z = Math.floor((s.z - CAM_BACK) / span) * span + i * BOARD_GAP;
    const zz = z < s.z - CAM_BACK + 0.8 ? z + span : z;
    const side = i % 2 ? 1 : -1;
    const p = project(s, side * (HALF + 0.9), 0, zz, W, fx, horizon);
    if (!p) return { opacity: 0 };
    const w = 3.2 * p.k;
    const h = 0.9 * p.k;
    return { opacity: Math.min(1, (span - p.dz) / 20), zIndex: Math.round(2000 - p.dz * 10), left: p.sx - w / 2, top: p.sy - h, width: w, height: h, backgroundColor: i % 4 < 2 ? "#1D4ED8" : "#F8FAFC" };
  });
  return <Animated.View style={[styles.board, style]} />;
}

/** the goal across all three lanes, an answer over each lane (the right one leads to a goal) */
function GoalSprite({ state, W, fx, horizon, lanes }: View3D & { lanes: string[] | null }) {
  const frame = useAnimatedStyle(() => {
    const s = state.value;
    const g = nextGoalOf(s);
    const p = g ? project(s, 0, 0, g.z, W, fx, horizon) : null;
    if (!g || !p || p.dz > 110) return { opacity: 0 };
    const w = (3 * LANE + 0.6) * p.k;
    const h = 2.7 * p.k;
    return { opacity: Math.min(1, (110 - p.dz) / 15), zIndex: Math.round(2000 - p.dz * 10), left: p.sx - w / 2, top: p.sy - h, width: w, height: h, borderWidth: Math.max(2, 0.14 * p.k) };
  });
  return (
    <Animated.View style={[styles.goal, frame]} pointerEvents="none">
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.goalLane, i > 0 && styles.goalDivider]}>
          {lanes && (
            <View style={styles.goalLabel}>
              <Text style={styles.goalLabelText} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.5}>
                {lanes[i]}
              </Text>
            </View>
          )}
        </View>
      ))}
    </Animated.View>
  );
}

/** a power-up badge on the HUD, its bar emptying with the time left */
function PowerChip({ kind, share }: { kind: PowerKind; share: number }) {
  const look = POWER_LOOK[kind];
  return (
    <View style={[styles.powerChip, { borderColor: look.color }]}>
      <Text style={styles.powerIcon}>{look.icon}</Text>
      <View style={styles.powerTrack}>
        <View style={[styles.powerFill, { width: `${Math.max(0, Math.min(1, share)) * 100}%`, backgroundColor: look.color }]} />
      </View>
    </View>
  );
}

/** a power-up floating over its lane, bobbing and turning */
function PickupSprite({ i, state, W, fx, horizon }: View3D & { i: number }) {
  const [kind, setKind] = useState<PowerKind>(0);
  useAnimatedReaction(
    () => state.value.pickups[i]?.kind ?? -1,
    (k, prev) => {
      if (k !== prev && k >= 0) runOnJS(setKind)(k as PowerKind);
    }
  );
  const style = useAnimatedStyle(() => {
    const s = state.value;
    const p = s.pickups[i];
    if (!p || p.taken || p.z < s.z - 0.4) return { opacity: 0 };
    const bob = Math.sin(s.t * 4 + i) * 0.15;
    const q = project(s, p.lane * LANE, 0.9 + bob, p.z, W, fx, horizon);
    if (!q || q.dz > 80) return { opacity: 0 };
    const size = 1.15 * q.k;
    return {
      opacity: Math.min(1, (80 - q.dz) / 12),
      zIndex: Math.round(2000 - q.dz * 10),
      width: size,
      height: size,
      left: q.sx - size / 2,
      top: q.sy - size / 2,
      borderRadius: size / 2,
      transform: [{ rotate: `${Math.sin(s.t * 3 + i) * 12}deg` }],
    };
  });
  const label = useAnimatedStyle(() => {
    const s = state.value;
    const p = s.pickups[i];
    const q = p ? project(s, 0, 0, p.z, W, fx, horizon) : null;
    return { fontSize: q ? Math.max(6, Math.min(70, q.k * 0.55)) : 6 };
  });
  const look = POWER_LOOK[kind];
  return (
    <Animated.View style={[styles.pickup, { backgroundColor: look.color }, style]}>
      <Animated.Text style={[styles.pickupText, label]}>{look.icon}</Animated.Text>
    </Animated.View>
  );
}

function CoinSprite({ i, state, W, fx, horizon }: View3D & { i: number }) {
  const style = useAnimatedStyle(() => {
    const s = state.value;
    const c = s.coins[i];
    if (!c || c.taken || c.z < s.z - 0.4) return { opacity: 0 };
    const p = project(s, c.lane * LANE, c.y + 0.7, c.z, W, fx, horizon);
    if (!p || p.dz > 80) return { opacity: 0 };
    const size = 0.75 * p.k;
    // spinning: squash the width
    const spin = Math.abs(Math.cos(s.t * 5 + i));
    return {
      opacity: Math.min(1, (80 - p.dz) / 12),
      zIndex: Math.round(2000 - p.dz * 10),
      width: Math.max(2, size * (0.25 + 0.75 * spin)),
      height: size,
      left: p.sx - (size * (0.25 + 0.75 * spin)) / 2,
      top: p.sy - size / 2,
      borderRadius: size / 2,
    };
  });
  return <Animated.View style={[styles.coin, style]} />;
}

function Runner({ state, W, fx, horizon, kit }: View3D & { kit: { body: string; sleeves: string; pattern?: unknown } }) {
  const size = (1.9 * fx) / CAM_BACK;
  const body = useAnimatedStyle(() => {
    const s = state.value;
    const p = project(s, s.x, s.y, s.z, W, fx, horizon)!;
    const ground = project(s, s.x, 0, s.z, W, fx, horizon)!;
    const rolling = s.slide > 0 && s.y === 0;
    const bob = s.dead || s.y > 0 || rolling ? 0 : Math.abs(Math.sin(s.t * 13)) * size * 0.05;
    const fall = s.dead ? Math.min(1, (s.t - s.dead) / 0.35) : 0;
    // a stumble flickers
    const flicker = s.stumble < 0.6 || (s.ghost > 0 && s.boots === 0) ? (Math.floor(s.t * 20) % 2 ? 0.45 : 1) : 1;
    return {
      opacity: flicker,
      zIndex: Math.round(2000 - CAM_BACK * 10),
      left: p.sx - size / 2,
      top: p.sy - size - bob - (ground.sy - p.sy) * 0,
      transform: [{ translateY: size * 0.5 * (rolling ? 0.45 : 0) }, { scaleY: rolling ? 0.55 : 1 }, { rotateX: `${fall * 70}deg` }],
    };
  });
  // power-up looks on the runner: a speed glow with the boots, a gold ring with the armband
  const aura = useAnimatedStyle(() => {
    const s = state.value;
    const p = project(s, s.x, s.y, s.z, W, fx, horizon)!;
    const on = s.boots > 0 || s.armband > 0;
    const d = size * 1.15;
    return {
      opacity: on ? 0.55 + Math.sin(s.t * 12) * 0.15 : 0,
      left: p.sx - d / 2,
      top: p.sy - size * 0.95,
      width: d,
      height: d,
      borderRadius: d / 2,
      borderColor: s.boots > 0 ? "#F97316" : "#FACC15",
      zIndex: Math.round(2000 - CAM_BACK * 10) - 1,
    };
  });
  const shadowStyle = useAnimatedStyle(() => {
    const s = state.value;
    const g = project(s, s.x, 0, s.z, W, fx, horizon)!;
    const k = 1 / (1 + s.y * 0.5);
    return { left: g.sx - (size * 0.55 * k) / 2, top: g.sy - size * 0.08, width: size * 0.55 * k, opacity: 0.35 * k };
  });
  const ball = useAnimatedStyle(() => {
    const s = state.value;
    // just in front of the right boot, between the runner and the camera, so you see it
    const g = project(s, s.x + 0.38, 0, s.z - 0.35, W, fx, horizon)!;
    const bounce = s.y > 0 ? s.y * g.k * 0.85 : Math.abs(Math.sin(s.t * 13 + 1)) * size * 0.05;
    const b = size * 0.22;
    return { zIndex: Math.round(2000 - CAM_BACK * 10) + 5, left: g.sx - b / 2, top: g.sy - b - bounce, width: b, height: b, transform: [{ rotate: `${s.z * 90}deg` }] };
  });
  return (
    <>
      <Animated.View style={[styles.shadow, { height: size * 0.12, borderRadius: size }, shadowStyle]} pointerEvents="none" />
      <Animated.View style={[styles.aura, aura]} pointerEvents="none" />
      <Animated.View style={[styles.runner, { width: size, height: size }, body]} pointerEvents="none">
        <View style={[styles.head, { width: size * 0.26, height: size * 0.26, borderRadius: size * 0.13, marginBottom: -size * 0.05 }]}>
          {/* seen from behind: mostly hair */}
          <View style={[styles.hair, { height: size * 0.2, borderTopLeftRadius: size * 0.13, borderTopRightRadius: size * 0.13, borderBottomLeftRadius: size * 0.06, borderBottomRightRadius: size * 0.06 }]} />
        </View>
        <Jersey body={kit.body} sleeves={kit.sleeves} pattern={kit.pattern as never} numberColor="#fff" number={10} hideNumber size={size * 0.72} variant="crew" />
        <View style={[styles.shorts, { width: size * 0.36, height: size * 0.16 }]} />
        <View style={styles.legs}>
          <View style={[styles.leg, { height: size * 0.14 }]} />
          <View style={[styles.leg, { height: size * 0.14 }]} />
        </View>
      </Animated.View>
      <Animated.Text style={[styles.ball, ball, { fontSize: size * 0.22 }]}>⚽</Animated.Text>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: "hidden" },
  stands: { position: "absolute", left: 0, right: 0, backgroundColor: "#334155" },
  crowd: { position: "absolute", left: 0, right: 0, backgroundColor: "#64748B", opacity: 0.6 },
  grass: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "#4CAB51" },
  board: { position: "absolute", borderRadius: 3, borderBottomWidth: 3, borderBottomColor: "rgba(0,0,0,0.25)" },
  head: { backgroundColor: "#E8B48A", overflow: "hidden", zIndex: 2 },
  hair: { backgroundColor: "#3F2A1D" },
  band: { position: "absolute", left: 0, right: 0 },
  marks: { position: "absolute" },
  dash: { position: "absolute", top: 0, bottom: 0, backgroundColor: "rgba(255,255,255,0.55)", borderRadius: 2 },
  line: { position: "absolute", top: -2, bottom: -2, backgroundColor: "rgba(255,255,255,0.9)" },
  obstacle: { position: "absolute", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(0,0,0,0.12)" },
  coin: { position: "absolute", backgroundColor: "#FACC15", borderWidth: 2, borderColor: "#D97706" },
  runner: { position: "absolute", alignItems: "center", justifyContent: "flex-end" },
  shorts: { backgroundColor: "#111827", borderRadius: 6, marginTop: -6 },
  legs: { flexDirection: "row", gap: 10 },
  leg: { width: 9, backgroundColor: "#F2C9A0", borderRadius: 4, borderBottomWidth: 6, borderBottomColor: "#111" },
  shadow: { position: "absolute", backgroundColor: "#000" },
  ball: { position: "absolute", textAlign: "center" },
  hud: { position: "absolute", left: 12, right: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  back: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.card, alignItems: "center", justifyContent: "center", ...shadow },
  pill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.card, borderRadius: R.chip, paddingHorizontal: 12, height: 36, ...shadow },
  pillText: { fontFamily: F.black, fontSize: 20, color: C.text },
  center: { position: "absolute", left: 0, right: 0, top: "38%", alignItems: "center", gap: 6 },
  big: { fontFamily: F.black, fontSize: 30, color: C.text, textAlign: "center" },
  small: { fontSize: 15, fontWeight: "600", color: C.text2, textAlign: "center" },
  overlay: { backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center", padding: 24 },
  card: { backgroundColor: C.card, borderRadius: R.card, padding: 20, alignItems: "center", alignSelf: "stretch", ...shadow },
  score: { fontFamily: F.black, fontSize: 56, color: C.greenDark },
  pickup: { position: "absolute", alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "white", ...shadow },
  pickupText: { textAlign: "center" },
  aura: { position: "absolute", borderWidth: 6, backgroundColor: "rgba(255,255,255,0.12)" },
  powers: { position: "absolute", right: 12, gap: 6, alignItems: "flex-end" },
  powerChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.card, borderRadius: R.chip, borderWidth: 2, paddingHorizontal: 8, height: 34, ...shadow },
  powerIcon: { fontSize: 16 },
  powerTrack: { width: 46, height: 6, borderRadius: 3, backgroundColor: C.key, overflow: "hidden" },
  powerFill: { height: 6, borderRadius: 3 },
  toast: { position: "absolute", left: 0, right: 0, top: "46%", alignItems: "center" },
  toastText: { fontFamily: F.black, fontSize: 30, textShadowColor: "rgba(255,255,255,0.9)", textShadowRadius: 6, textShadowOffset: { width: 0, height: 0 } },
  goal: { position: "absolute", flexDirection: "row", borderColor: "white", borderBottomWidth: 0, backgroundColor: "rgba(255,255,255,0.18)", borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  goalLane: { flex: 1, alignItems: "center", justifyContent: "flex-start", padding: "4%" },
  goalDivider: { borderLeftWidth: 2, borderLeftColor: "rgba(255,255,255,0.6)", borderStyle: "dashed" },
  goalLabel: { width: "100%", backgroundColor: "white", borderRadius: 8, paddingVertical: 4, paddingHorizontal: 4, ...shadow },
  goalLabelText: { fontFamily: F.display, fontSize: 15, color: C.text, textAlign: "center" },
  question: { position: "absolute", left: 16, right: 16, backgroundColor: C.card, borderRadius: R.card, padding: 14, alignItems: "center", gap: 2, ...shadow },
  qLabel: { fontWeight: "800", fontSize: 12, color: C.greenMid, letterSpacing: 0.5 },
  qText: { fontFamily: F.display, fontSize: 21, color: C.text, textAlign: "center" },
  flash: { position: "absolute", left: 0, right: 0, top: "34%", alignItems: "center" },
  flashText: { fontFamily: F.black, fontSize: 52, textShadowColor: "rgba(0,0,0,0.25)", textShadowRadius: 8, textShadowOffset: { width: 0, height: 2 } },
  flashMult: { fontFamily: F.black, fontSize: 30, color: C.text, backgroundColor: "#FACC15", borderRadius: 12, overflow: "hidden", paddingHorizontal: 12 },
});
