import { useEffect, useRef, useState } from "react";
import { Alert, Image, StyleSheet, View } from "react-native";
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

import { SPOT_DIRS, SPOT_KICKS, SPOT_PICK_MS, spotKicker, spotOther, type SpotDir, type SpotKick, type SpotMark } from "@/lib/spot";

import { NOKTA } from "~/lib/brand";
import { haptic, useClockTicks } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { play } from "~/lib/sound";
import type { SpotMatch } from "~/lib/spotMatch";
import { C, F, GAME, R, T } from "~/lib/theme";

import { Text } from "./Text";
import { Button, Icon, Tap } from "./ui";

// where things are in the stadium picture (nokta-pitch.jpg), as fractions of its size
const IMG_RATIO = 768 / 1152;
const GOAL = { width: 0.74, line: 0.505, shotY: 0.4 };
const SPOT = { x: 0.5, y: 0.722 };
const ARROW: Record<SpotDir, string> = { l: "←", c: "↑", r: "→" };
const SHIFT: Record<SpotDir, number> = { l: -1, c: 0, r: 1 };
const BACK = { duration: 520, easing: Easing.inOut(Easing.sin) };
const PICK_ICON = { l: "arrow.left", c: "arrow.up", r: "arrow.right" } as const;

/** One player's kicks: green scored, red missed, hollow still to come. */
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

/** The stadium from behind the spot; keeper and ball slide flat (no 3D: see PossessionBoard). */
function Pitch({ w, h, kicker, shot, dive, reveal, outcome, good }: { w: number; h: number; kicker: SpotMark; shot: SpotDir | null; dive: SpotDir | null; reveal: boolean; outcome: string | null; good: boolean }) {
  // the picture covers the box, centred
  const imgW = Math.max(w, h * IMG_RATIO);
  const imgH = imgW / IMG_RATIO;
  const imgX = (w - imgW) / 2;
  const imgY = (h - imgH) / 2;
  const third = (GOAL.width * imgW) / 3;
  const keeperH = imgH * 0.2;
  const ball = imgW * 0.1;
  const ballTop = imgY + SPOT.y * imgH - ball * 0.82;
  const keeperX = useSharedValue(0);
  const keeperTilt = useSharedValue(0);
  const ballX = useSharedValue(0);
  const ballY = useSharedValue(0);
  const ballScale = useSharedValue(1);

  useEffect(() => {
    // the kick glides out and settles; everything drifts back slowly for the next one
    const keeperMove = reveal ? { duration: 780, easing: Easing.bezier(0.22, 1, 0.36, 1) } : BACK;
    const flight = reveal ? { duration: 680, easing: Easing.bezier(0.3, 0.1, 0.2, 1) } : BACK;
    keeperX.set(withDelay(reveal ? 70 : 0, withTiming(reveal && dive ? SHIFT[dive] * third * 0.9 : 0, keeperMove)));
    keeperTilt.set(withDelay(reveal ? 70 : 0, withTiming(reveal && dive ? SHIFT[dive] * 40 : 0, keeperMove)));
    ballX.set(withTiming(reveal && shot ? SHIFT[shot] * third : 0, flight));
    ballY.set(withTiming(reveal && shot ? imgY + GOAL.shotY * imgH - ballTop : 0, flight));
    ballScale.set(withTiming(reveal && shot ? 0.55 : 1, flight));
  }, [reveal, shot, dive, third, imgY, imgH, ballTop, keeperX, keeperTilt, ballX, ballY, ballScale]);

  const keeperStyle = useAnimatedStyle(() => ({ transform: [{ translateX: keeperX.get() }, { rotate: `${keeperTilt.get()}deg` }] }));
  const ballStyle = useAnimatedStyle(() => ({ transform: [{ translateX: ballX.get() }, { translateY: ballY.get() }, { scale: ballScale.get() }] }));

  return (
    <View style={{ width: w, height: h }}>
      <Image source={NOKTA.pitch} style={{ position: "absolute", left: imgX, top: imgY, width: imgW, height: imgH }} />
      <Animated.View pointerEvents="none" style={[styles.sprite, { left: w / 2 - keeperH / 2, top: imgY + GOAL.line * imgH - keeperH, width: keeperH, height: keeperH }, keeperStyle]}>
        <Image source={NOKTA.keeper[spotOther(kicker)]} style={{ width: keeperH, height: keeperH }} resizeMode="contain" />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.sprite, { left: w / 2 - ball / 2, top: ballTop, width: ball, height: ball }, ballStyle]}>
        <Image source={NOKTA.ball} style={{ width: ball, height: ball }} resizeMode="contain" />
      </Animated.View>
      {outcome && (
        <Animated.View entering={FadeIn.delay(480).duration(320)} exiting={FadeOut.duration(220)} pointerEvents="none" style={[styles.banner, { top: imgY + 0.56 * imgH, backgroundColor: good ? C.green : C.red }]}>
          <Text style={styles.bannerText}>{outcome}</Text>
        </Animated.View>
      )}
    </View>
  );
}

/** Score on top, the pitch, three big buttons: one decision on screen at a time. */
export function SpotBoard({ m, footer }: { m: SpotMatch; footer?: React.ReactNode }) {
  const { t } = useI18n();
  const [size, setSize] = useState({ w: 0, h: 0 });
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
  const good = !!last && (last.kicker === m.mark) === last.goal;
  const told = useRef(m.kicks.length);
  useEffect(() => {
    if (m.kicks.length < told.current) told.current = 0;
    if (m.phase !== "reveal" || !last || told.current === m.kicks.length) return;
    told.current = m.kicks.length;
    if (last.goal) play("goal");
    else play(good ? "correct" : "wrong");
    if (good) haptic.success();
    else haptic.warning();
  }, [m.phase, m.kicks.length, last, good]);

  const rival = spotOther(m.mark);
  const tape = iKick ? m.kicks.filter((k) => k.kicker === m.mark).map((k) => k.dive) : m.kicks.filter((k) => k.kicker === rival).map((k) => k.shot);
  const outcome = !reveal ? null : last.shot === null ? t("spNoShot") : last.goal ? t("spGoal") : t("spSaved");
  const prompt = reveal ? "" : m.mine ? t("spWaiting") : t(iKick ? "spPickShot" : "spPickDive");
  const label = { l: t("spLeft"), c: t("spCenter"), r: t("spRight") };
  const forfeit = () =>
    Alert.alert(t("htForfeitAsk"), t("htForfeitAskDesc"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("htForfeit"), style: "destructive", onPress: m.forfeit },
    ]);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.score}>
        <View style={styles.side}>
          <Text style={styles.name} numberOfLines={1}>
            {t("you")}
          </Text>
          <KickDots kicks={m.kicks} mark={m.mark} />
        </View>
        <Text style={styles.goals}>
          {m.score.me} – {m.score.them}
        </Text>
        <View style={[styles.side, { alignItems: "flex-end" }]}>
          <Text style={styles.name} numberOfLines={1}>
            {m.opponent?.nick || t("opponent")}
          </Text>
          <KickDots kicks={m.kicks} mark={rival} />
        </View>
      </View>

      <View style={styles.pitch} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {size.w > 0 && <Pitch w={size.w} h={size.h} kicker={kicker} shot={reveal ? last.shot : null} dive={reveal ? last.dive : null} reveal={reveal} outcome={outcome} good={good} />}
      </View>

      {live ? (
        <>
          <View style={styles.promptRow}>
            <Text style={styles.prompt} numberOfLines={1}>
              {sudden ? `${t("spSudden")} · ` : ""}
              {prompt}
            </Text>
            {secs !== null && <Text style={styles.secs}>{secs}</Text>}
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${((secs ?? 0) * 1000 * 100) / SPOT_PICK_MS}%` }]} />
          </View>
          <View style={styles.picks}>
            {SPOT_DIRS.map((d) => (
              <Tap
                key={d}
                disabled={!canPick}
                onPress={() => m.pick(d)}
                accessibilityRole="button"
                accessibilityLabel={label[d]}
                accessibilityState={{ selected: m.mine === d, disabled: !canPick }}
                style={[styles.pick, m.mine === d && styles.pickOn, !canPick && m.mine !== d && { opacity: 0.45 }]}
              >
                <Icon name={PICK_ICON[d]} size={24} color="white" fallback={ARROW[d]} />
                <Text style={styles.pickText}>{label[d]}</Text>
              </Tap>
            ))}
          </View>
          <View style={styles.foot}>
            <Text style={T.caption} numberOfLines={1}>
              {t(iKick ? "spTapeDives" : "spTapeShots")}: {tape.length ? tape.slice(-6).map((d) => (d ? ARROW[d] : "·")).join(" ") : "–"}
            </Text>
            <Tap onPress={forfeit} accessibilityRole="button" accessibilityLabel={t("htForfeit")}>
              <Text style={styles.leave}>{t("htForfeit")}</Text>
            </Tap>
          </View>
        </>
      ) : (
        footer
      )}
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

const INK = GAME.sp.ink;

const styles = StyleSheet.create({
  score: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10, paddingVertical: 10, paddingHorizontal: 16, borderRadius: R.card, backgroundColor: INK },
  side: { flex: 1, gap: 5 },
  name: { fontSize: 15, fontWeight: "700", color: "white" },
  dots: { flexDirection: "row", gap: 4 },
  dot: { width: 11, height: 11, borderRadius: 6, borderWidth: 1.5, borderColor: "rgba(255, 255, 255, 0.6)" },
  goals: { fontFamily: F.black, fontSize: 34, lineHeight: 38, color: "white" },
  pitch: { flex: 1, borderRadius: R.card, overflow: "hidden" },
  sprite: { position: "absolute" },
  banner: { position: "absolute", alignSelf: "center", paddingHorizontal: 22, paddingVertical: 6, borderRadius: R.button },
  bannerText: { fontFamily: F.black, fontSize: 34, lineHeight: 38, color: "white" },
  promptRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 12 },
  prompt: { flex: 1, fontFamily: F.display, fontSize: 21, color: C.text },
  secs: { fontFamily: F.black, fontSize: 22, color: C.text, fontVariant: ["tabular-nums"] },
  track: { height: 6, borderRadius: 3, backgroundColor: "#E3E8E4", overflow: "hidden", marginTop: 6 },
  fill: { height: 6, borderRadius: 3, backgroundColor: INK },
  picks: { flexDirection: "row", gap: 8, marginTop: 10 },
  pick: { flex: 1, height: 78, alignItems: "center", justifyContent: "center", gap: 2, borderRadius: R.card, backgroundColor: INK },
  pickOn: { backgroundColor: "#CA8A04" },
  pickText: { fontFamily: F.display, fontSize: 19, lineHeight: 22, color: "white" },
  foot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 10, marginBottom: 4 },
  leave: { fontSize: 14, fontWeight: "700", color: C.red, paddingVertical: 6, paddingLeft: 10 },
});
