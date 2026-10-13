import { useEffect, useState } from "react";
import { Modal, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, FadeOut, Keyframe, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from "react-native-reanimated";

import { BREAK_AFTER_MS, SERIES_TARGET } from "~/lib/hattrick";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { play } from "~/lib/sound";
import { F } from "~/lib/theme";

import { Text } from "./Text";
import { Icon } from "./ui";

/** Which side a heart / bonus belongs to on the break screen. */
type Side = "me" | "opp";

const RED = "#E8414F";
const BLUE = "#3B6FE8";

const fromLeft = new Keyframe({
  0: { transform: [{ translateX: -420 }] },
  100: { transform: [{ translateX: 0 }] },
}).duration(380);
const fromRight = new Keyframe({
  0: { transform: [{ translateX: 420 }] },
  100: { transform: [{ translateX: 0 }] },
}).duration(380);
const SLAM = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 2.2 }, { rotate: "-6deg" }] },
  60: { opacity: 1, transform: [{ scale: 0.92 }, { rotate: "1deg" }] },
  100: { opacity: 1, transform: [{ scale: 1 }, { rotate: "0deg" }] },
}).duration(420);

/**
 * Between two games of a series (Draft Showdown style): the screen splits red
 * (opponent, top) and blue (you, bottom), the loser's heart breaks, then the
 * next game number slams in, with the comeback bonus if someone has one.
 * Shown over the board until the next game starts.
 */
export function SeriesBreak({
  me,
  opponent,
  hearts,
  loser,
  game,
  comeback,
}: {
  me: string;
  opponent: string;
  /** hearts left after this game, per side */
  hearts: Record<Side, number>;
  /** who just lost a heart (null: a draw) */
  loser: Side | null;
  /** number of the game about to start */
  game: number;
  comeback: Side | null;
}) {
  const { t } = useI18n();
  const { width, height } = useWindowDimensions();
  const [stage, setStage] = useState(0); // 0 sides in, 1 heart breaks, 2 game banner

  useEffect(() => {
    const a = setTimeout(() => {
      setStage(1);
      if (loser) {
        haptic.warning();
        play("wrong");
      }
    }, 700);
    const b = setTimeout(() => {
      setStage(2);
      haptic.success();
      play("pop");
    }, 1500);
    return () => (clearTimeout(a), clearTimeout(b));
  }, [loser]);

  const row = (side: Side) => (
    <View style={styles.hearts}>
      {Array.from({ length: SERIES_TARGET }, (_, k) => {
        // the heart lost just now is still drawn alive until it breaks
        const justLost = side === loser && k === hearts[side];
        const alive = k < hearts[side] || (justLost && stage === 0);
        return justLost ? <BreakingHeart key={k} broken={stage >= 1} /> : <Heart key={k} alive={alive} />;
      })}
    </View>
  );

  const card = (name: string, side: Side) => (
    <View style={[styles.card, { backgroundColor: side === "me" ? "#2A55C9" : "#C42E3C" }]}>
      <Text style={styles.cardName} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
    <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(220)} style={[StyleSheet.absoluteFill, styles.wrap]}>
      {/* the diagonal split: red on top, a tilted blue sheet underneath */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: RED }]} />
      <View style={[styles.blue, { width: width * 1.6, height: height, left: -width * 0.3, top: height * 0.5 }]} />

      <Animated.View entering={fromLeft} style={[styles.side, { top: height * 0.2 }]}>
        {card(opponent, "opp")}
        {row("opp")}
      </Animated.View>
      <Animated.View entering={fromRight} style={[styles.side, { top: height * 0.6 }]}>
        {card(me, "me")}
        {row("me")}
      </Animated.View>

      {stage >= 2 && (
        <View style={[styles.center, { top: height * 0.43 }]} pointerEvents="none">
          <Animated.View entering={SLAM}>
            <Text style={styles.game}>{t("htGameN").replace("{n}", String(game))}</Text>
          </Animated.View>
          {comeback && (
            <Animated.View entering={SLAM.delay(260)} style={styles.ribbon}>
              <Icon name="bolt.fill" size={14} color="#3B2A05" fallback="⚡" />
              <Text style={styles.ribbonText}>
                {t("htComeback")}
                {comeback === "me" ? `: ${t("htComebackDesc")}` : ` → ${opponent}`}
              </Text>
            </Animated.View>
          )}
        </View>
      )}
    </Animated.View>
    </Modal>
  );
}

/** A heart with a white rim, so a red one still reads on the red half. */
function Heart({ alive }: { alive: boolean }) {
  return (
    <View style={styles.heart}>
      <View style={styles.heartRim}>
        <Icon name="heart.fill" size={42} color="white" fallback="♥" />
      </View>
      <Icon name="heart.fill" size={34} color={alive ? "#FF2D4F" : "#1B1B22"} fallback="♥" />
    </View>
  );
}

/** The heart that was just lost: swells, then drops to black with a shake. */
function BreakingHeart({ broken }: { broken: boolean }) {
  const scale = useSharedValue(1);
  const rot = useSharedValue(0);
  useEffect(() => {
    if (!broken) return;
    scale.set(withSequence(withTiming(1.5, { duration: 140 }), withSpring(1, { damping: 8, stiffness: 260 })));
    rot.set(withSequence(withTiming(-14, { duration: 60 }), withTiming(12, { duration: 70 }), withTiming(-8, { duration: 60 }), withDelay(0, withTiming(0, { duration: 80 }))));
  }, [broken, scale, rot]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }, { rotate: `${rot.get()}deg` }] }));
  return (
    <Animated.View style={style}>
      <Heart alive={!broken} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { zIndex: 50, overflow: "hidden" },
  blue: { position: "absolute", backgroundColor: BLUE, transform: [{ rotate: "-9deg" }] },
  side: { position: "absolute", left: 0, right: 0, alignItems: "center", gap: 12 },
  card: {
    minWidth: 200,
    maxWidth: 280,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.9)",
    transform: [{ skewX: "-8deg" }],
    alignItems: "center",
  },
  cardName: { fontFamily: F.black, fontSize: 26, color: "white" },
  hearts: { flexDirection: "row", gap: 6 },
  heart: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  heartRim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  center: { position: "absolute", left: 0, right: 0, alignItems: "center", gap: 10 },
  game: {
    fontFamily: F.black,
    fontSize: 54,
    color: "white",
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 0,
  },
  ribbon: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FACC15", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, maxWidth: "90%" },
  ribbonText: { fontFamily: F.display, fontSize: 16, color: "#3B2A05", flexShrink: 1 },
});

/**
 * Drives the break screen for a series: `ended` = a game just finished and the
 * series goes on. Returns whether to show it (after BREAK_AFTER_MS, so the
 * winning line is seen first) and the number of the next game.
 */
export function useSeriesBreak(winner: string | null, seriesOver: boolean) {
  const ended = !!winner && !seriesOver;
  const [ready, setReady] = useState(false);
  // games played in this series, counted as results come in (draws included)
  const [played, setPlayed] = useState(0);
  const [last, setLast] = useState<string | null>(null);
  if (winner !== last) {
    setLast(winner);
    if (winner) setPlayed((n) => n + 1);
  }
  const [wasOver, setWasOver] = useState(seriesOver);
  if (seriesOver !== wasOver) {
    setWasOver(seriesOver);
    if (!seriesOver) setPlayed(0);
  }
  if (!ended && ready) setReady(false);
  useEffect(() => {
    if (!ended) return;
    const id = setTimeout(() => setReady(true), BREAK_AFTER_MS);
    return () => clearTimeout(id);
  }, [ended]);
  return { show: ended && ready, nextGame: played + 1 };
}
