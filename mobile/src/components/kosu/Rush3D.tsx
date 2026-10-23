import UnityView from "@azesmway/react-native-unity";
import { Stack, router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Platform, StyleSheet, View, type GestureResponderEvent } from "react-native";
import Animated, { FadeIn, FadeOut, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { POWER_S, type PowerKind } from "@/lib/kosu/engine";
import { rushWords } from "@/lib/kosu/names";

import { CLUB_KITS } from "~/components/HatTrickBoard";
import { POWER_LOOK, PowerChip } from "~/components/kosu/Rush2D";
import { useShareCard } from "~/components/ShareCard";
import { FocusStatusBar } from "~/components/StadiumHeader";
import { Text } from "~/components/Text";
import { Button, Icon, Tap } from "~/components/ui";
import { KOSU } from "~/lib/brand";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { recordRun, useFavClub } from "~/lib/kosu";
import { questEvent } from "~/lib/quests";
import { play } from "~/lib/sound";
import { C, F, R, shadow } from "~/lib/theme";
import { useXpAward } from "~/lib/xp";

/** what the game (unity/DribblingRush, Bridge.cs) sends */
type FromGame =
  | { t: "ready" }
  | { t: "hud"; score: number; coins: number; mult: number; boots: number; magnet: number; double: number; armband: number; jet?: number; spring?: number; word?: string; got?: number; words?: number; m: number }
  | { t: "ev"; e: "coin" | "bump" | "dead" | "power" | "saved" | "letter" | "word"; k?: number; mult?: number; name?: string }
  | { t: "over"; score: number; coins: number; metres: number; words?: number };

/** the object in the Unity scene that takes the app's commands */
const GAME = "RushGame";

/**
 * Unity on Android can't start a second player in the same process (Unity 6: "UnityFoldingFeaturesWrapper.init()
 * should be called only once"), so the package's unload on unmount would leave the game blank until the app
 * restarts. There the player is kept and paused instead (plugins/withUnity.js hands it to the next view); iOS unloads
 * and reloads fine. fullScreen={false} keeps Unity from hiding the status bar for the rest of the app.
 */
class GameView extends UnityView {
  componentWillUnmount() {
    if (Platform.OS !== "android") super.componentWillUnmount();
  }
}

/**
 * Dribbling Rush in 3D: the run is drawn by the Unity player (unity/DribblingRush, embedded with
 * @azesmway/react-native-unity); the rules there are a port of src/lib/kosu/engine.ts (with `extras`). This screen
 * keeps everything around it: swipes, HUD, the name being spelt, result, XP, quests, sounds and haptics.
 */
export default function Rush3D() {
  const { t } = useI18n();
  const { share: shareCard, card: shareView } = useShareCard();
  const insets = useSafeAreaInsets();
  const [club] = useFavClub();
  const kit = CLUB_KITS[club] ?? { body: "#16A34A", sleeves: "#16A34A" };
  const unity = useRef<GameView>(null);

  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<"ready" | "run" | "over">("ready");
  const [hud, setHud] = useState({ score: 0, coins: 0, mult: 1, boots: 0, magnet: 0, double: 0, armband: 0, jet: 0, spring: 0, word: "", got: 0, words: 0 });
  const [final, setFinal] = useState<{ score: number; coins: number; metres: number } | null>(null);
  const [newBest, setNewBest] = useState(false);
  const [runNo, setRunNo] = useState(0);
  const [flash, setFlash] = useState<{ id: number; name: string; mult: number } | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string; color: string } | null>(null);

  const send = (method: "Cmd" | "Swipe", msg: string) => unity.current?.postMessage(GAME, method, msg);

  // the player boots in the background; ask until it answers (its first "ready" can come before we listen)
  useEffect(() => {
    if (ready) return;
    const id = setInterval(() => unity.current?.postMessage(GAME, "Cmd", '{"t":"ping"}'), 400);
    return () => clearInterval(id);
  }, [ready]);

  // Android: the one Unity player lives for the whole app run (see GameView), so it sleeps while this screen is away
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return;
      unity.current?.resumeUnity();
      return () => unity.current?.pauseUnity(true);
    }, [])
  );

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 1200);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 1300);
    return () => clearTimeout(id);
  }, [flash]);

  const end = (sc: number, coins: number, metres: number, words: number) => {
    setFinal({ score: sc, coins, metres });
    const best = recordRun(sc);
    setNewBest(best);
    if (best) setTimeout(() => play("levelup"), 950);
    // every finished name raises the multiplier (it never drops in the 3D game)
    questEvent("rush_mult", Math.min(5, 1 + words));
    questEvent("rush_metres", metres);
    setTimeout(() => setPhase("over"), 450);
  };

  const onMessage = (raw: string) => {
    let m: FromGame;
    try {
      m = JSON.parse(raw) as FromGame;
    } catch {
      return;
    }
    if (m.t === "ready") {
      // the start line, in the favourite club's kit
      if (!ready) send("Cmd", JSON.stringify({ t: "menu", body: kit.body, sleeves: kit.sleeves, num: "10" }));
      setReady(true);
    }
    else if (m.t === "hud")
      setHud({ score: m.score, coins: m.coins, mult: m.mult, boots: m.boots, magnet: m.magnet, double: m.double, armband: m.armband, jet: m.jet ?? 0, spring: m.spring ?? 0, word: m.word ?? "", got: m.got ?? 0, words: m.words ?? 0 });
    else if (m.t === "over") end(m.score, m.coins, m.metres, m.words ?? 0);
    else if (m.t === "ev") {
      if (m.e === "coin") haptic.tap();
      else if (m.e === "bump") haptic.warning();
      else if (m.e === "dead") {
        haptic.error();
        play("whistle");
      } else if (m.e === "letter") {
        haptic.success();
        play("pop");
      } else if (m.e === "word") {
        setFlash({ id: Date.now(), name: m.name ?? "", mult: m.mult ?? 1 });
        haptic.success();
        play("goal");
      } else if (m.e === "power") {
        haptic.success();
        play("power");
        const look = POWER_LOOK[(m.k ?? 0) as PowerKind];
        setToast({ id: Date.now(), text: t(look.name), color: look.color });
      } else if (m.e === "saved") {
        haptic.warning();
        setToast({ id: Date.now(), text: t("rushArmbandUsed"), color: "#CA8A04" });
      } else if (m.e === "splash") {
        haptic.warning();
        setToast({ id: Date.now(), text: t("rushSplash"), color: "#0284C7" });
      }
    }
  };

  useXpAward(phase === "over" && !!final, final ? `run-${runNo}-${final.score}` : null, "bonus", final ? Math.min(40, 5 + Math.floor(final.score / 60)) : 0, { practice: true, label: "Dribbling Rush" });

  const start = () => {
    if (!ready) return;
    setHud({ score: 0, coins: 0, mult: 1, boots: 0, magnet: 0, double: 0, armband: 0, jet: 0, spring: 0, word: "", got: 0, words: 0 });
    setToast(null);
    setFlash(null);
    setFinal(null);
    setNewBest(false);
    send(
      "Cmd",
      JSON.stringify({
        t: "start",
        seed: Math.floor(Math.random() * 2 ** 31),
        body: kit.body,
        sleeves: kit.sleeves,
        num: "10",
        // footballers' names to spell with the letters on the pitch, in this order
        words: rushWords(),
      })
    );
    setPhase("run");
    setRunNo((n) => n + 1);
  };

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
    send("Swipe", Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
  };


  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: phase !== "run" }} />
      <FocusStatusBar style="dark" />
      <GameView ref={unity} fullScreen={false} style={StyleSheet.absoluteFill} onUnityMessage={(e) => onMessage(e.nativeEvent.message)} />
      <View style={StyleSheet.absoluteFill} onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={() => (touch.current = null)} />

      {/* HUD */}
      <View style={[styles.hud, { top: insets.top + 8 }]} pointerEvents="box-none">
        <Tap onPress={() => router.back()} style={styles.back} accessibilityLabel={t("close")}>
          <Icon name="chevron.left" size={17} color={C.text} fallback="‹" />
        </Tap>
        <View style={{ flex: 1 }} />
        <View style={styles.pill}>
          <Image source={KOSU.hudDistance} style={{ width: 26, height: 15 }} />
          <Text style={styles.pillText}>{hud.score}</Text>
        </View>
        {hud.mult > 1 && (
          <View style={[styles.pill, { backgroundColor: C.green }]}>
            <Text style={[styles.pillText, { color: "white" }]}>×{hud.mult}</Text>
          </View>
        )}
        <View style={[styles.pill, { backgroundColor: "#FEF3C7" }]}>
          <Image source={KOSU.coin} style={{ width: 20, height: 21 }} />
          <Text style={styles.pillText}>{hud.coins}</Text>
        </View>
      </View>

      {/* power-ups running: a bar that empties as the time runs out */}
      {/* the footballer's name being spelt: the letters collected so far light up */}
      {phase === "run" && hud.word !== "" && (
        <View style={[styles.spell, { top: insets.top + 52 }]} pointerEvents="none">
          <Text style={styles.spellLabel}>{t("rushSpell")}</Text>
          <View style={styles.spellRow}>
            {hud.word.split("").map((ch, i) => (
              <View key={`${hud.word}-${i}`} style={[styles.tile, i < hud.got && styles.tileOn]}>
                <Text style={[styles.tileText, i < hud.got && styles.tileTextOn]}>{ch}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={[styles.powers, { top: insets.top + 54 + (phase === "run" && hud.word ? 70 : 0) }]} pointerEvents="none">
        {([4, 5, 0, 1, 3] as PowerKind[]).map((k) => {
          const left = k === 0 ? hud.boots : k === 1 ? hud.magnet : k === 3 ? hud.double : k === 4 ? hud.jet : hud.spring;
          if (left <= 0) return null;
          return <PowerChip key={k} kind={k} share={left / POWER_S[k]} />;
        })}
        {hud.armband > 0 && <PowerChip kind={2} share={1} />}
      </View>
      {toast && (
        <Animated.View key={toast.id} entering={ZoomIn.duration(180)} exiting={FadeOut.duration(200)} style={styles.toast} pointerEvents="none">
          <Text style={[styles.toastText, { color: toast.color }]}>{toast.text}</Text>
        </Animated.View>
      )}

      {flash && (
        <Animated.View key={flash.id} entering={ZoomIn.duration(220)} exiting={FadeOut.duration(200)} style={styles.flash} pointerEvents="none">
          <Text style={[styles.flashText, { color: C.green }]}>{flash.name}</Text>
          <Text style={styles.flashSub}>{t("rushNameDone")}</Text>
          {flash.mult > 1 && <Text style={styles.flashMult}>×{flash.mult}</Text>}
        </Animated.View>
      )}

      {phase === "ready" && ready && (
        <Animated.View entering={FadeIn.duration(250)} style={styles.center} pointerEvents="none">
          <View style={styles.startCard}>
            <Text style={styles.big}>{t("rushTap")}</Text>
            <Text style={styles.small}>{t("rushHow3D")}</Text>
          </View>
        </Animated.View>
      )}
      {!ready && (
        <Animated.View exiting={FadeOut.duration(300)} style={[StyleSheet.absoluteFill, styles.loading]} pointerEvents="none">
          <Image source={KOSU.hero} style={styles.hero} resizeMode="contain" />
          <ActivityIndicator color={C.text} />
          <Text style={styles.small}>{t("rushLoading")}</Text>
        </Animated.View>
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
            <Button
              title={t("share")}
              icon="square.and.arrow.up"
              kind="secondary"
              onPress={() =>
                shareCard({
                  game: "rush",
                  name: "Dribbling Rush",
                  tag: newBest ? t("rushNewBest") : undefined,
                  rows: [],
                  art: KOSU.hero,
                  score: String(final.score),
                  detail: `${final.metres} m · ${final.coins} ${t("rushCoins")}`,
                  text: `Dribbling Rush ⚽ ${final.score}${newBest ? ` (${t("rushNewBest")})` : ""}\n${final.metres} m · ${final.coins} ${t("rushCoins")}`,
                })
              }
              style={{ alignSelf: "stretch", marginTop: 8 }}
            />
            <Button title={t("close")} kind="secondary" onPress={() => router.back()} style={{ alignSelf: "stretch", marginTop: 8 }} />
          </View>
        </View>
      )}
      {shareView}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#7CC4F2", overflow: "hidden" },
  hud: { position: "absolute", left: 12, right: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  back: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.card, alignItems: "center", justifyContent: "center", ...shadow },
  pill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.card, borderRadius: R.chip, paddingHorizontal: 12, height: 36, ...shadow },
  pillText: { fontFamily: F.black, fontSize: 20, color: C.text },
  center: { position: "absolute", left: 24, right: 24, top: "30%", alignItems: "center" },
  startCard: { backgroundColor: "rgba(255,255,255,0.92)", borderRadius: R.card, paddingVertical: 16, paddingHorizontal: 18, gap: 6, alignItems: "center", ...shadow },
  big: { fontFamily: F.black, fontSize: 30, color: C.text, textAlign: "center" },
  small: { fontSize: 15, fontWeight: "600", color: C.text2, textAlign: "center" },
  loading: { backgroundColor: "#7CC4F2", alignItems: "center", justifyContent: "center", gap: 14, padding: 24 },
  hero: { width: "70%", height: 220 },
  overlay: { backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center", padding: 24 },
  card: { backgroundColor: C.card, borderRadius: R.card, padding: 20, alignItems: "center", alignSelf: "stretch", ...shadow },
  score: { fontFamily: F.black, fontSize: 56, color: C.greenDark },
  powers: { position: "absolute", right: 12, gap: 6, alignItems: "flex-end" },
  toast: { position: "absolute", left: 0, right: 0, top: "46%", alignItems: "center" },
  toastText: { fontFamily: F.black, fontSize: 30, textShadowColor: "rgba(255,255,255,0.9)", textShadowRadius: 6, textShadowOffset: { width: 0, height: 0 } },
  spell: { position: "absolute", alignSelf: "center", alignItems: "center", gap: 4, backgroundColor: "rgba(15,23,42,0.78)", borderRadius: 14, paddingHorizontal: 10, paddingTop: 5, paddingBottom: 8 },
  spellLabel: { fontWeight: "900", fontSize: 11, color: "#FACC15", letterSpacing: 1 },
  spellRow: { flexDirection: "row", gap: 4 },
  tile: { width: 30, height: 36, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 2, borderColor: "rgba(255,255,255,0.5)", alignItems: "center", justifyContent: "center" },
  tileOn: { backgroundColor: "#FACC15", borderColor: "#0E74E6" },
  tileText: { fontFamily: F.black, fontSize: 20, color: "rgba(255,255,255,0.55)" },
  tileTextOn: { color: "#0F172A" },
  flash: { position: "absolute", left: 0, right: 0, top: "34%", alignItems: "center" },
  flashText: { fontFamily: F.black, fontSize: 52, textShadowColor: "rgba(0,0,0,0.25)", textShadowRadius: 8, textShadowOffset: { width: 0, height: 2 } },
  flashSub: { fontFamily: F.black, fontSize: 22, color: "white", textShadowColor: "rgba(0,0,0,0.35)", textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } },
  flashMult: { fontFamily: F.black, fontSize: 30, color: C.text, backgroundColor: "#FACC15", borderRadius: 12, overflow: "hidden", paddingHorizontal: 12 },
});
