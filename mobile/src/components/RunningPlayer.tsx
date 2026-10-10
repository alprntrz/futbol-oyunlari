import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming, type SharedValue } from "react-native-reanimated";

import { Icon } from "./ui";

const STRIDE_MS = 620;
const THIGH = 22;
const SHIN = 22;
const ARM = 22;
const HIP = { x: 66, y: 70 };
const SHOULDER = { x: 70, y: 40 };

/**
 * A footballer dribbling to the right, drawn from simple shapes and animated
 * in place: legs and arms swing, the body bobs, the ball rolls ahead and the
 * pitch markings slide past underneath.
 */
export function RunningPlayer({ shirt = "#16A34A", shorts = "#FFFFFF", ground = "rgba(255,255,255,0.35)" }: { shirt?: string; shorts?: string; ground?: string }) {
  const phase = useSharedValue(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) return;
    phase.set(withRepeat(withTiming(1, { duration: STRIDE_MS, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(phase);
  }, [phase, reduce]);

  const bob = useAnimatedStyle(() => ({ transform: [{ translateY: -Math.abs(Math.sin(phase.get() * Math.PI * 2)) * 4 }] }));
  const ball = useAnimatedStyle(() => {
    const a = phase.get() * Math.PI * 2;
    // touched once a stride: nudged ahead, then it drifts back towards the boot
    return { transform: [{ translateX: Math.sin(a) * 5 }, { translateY: -Math.max(0, Math.sin(a * 2)) * 2 }, { rotate: `${phase.get() * 360}deg` }] };
  });
  const lines = useAnimatedStyle(() => ({ transform: [{ translateX: -phase.get() * 40 }] }));

  return (
    <View style={styles.box} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {/* pitch sliding under the feet */}
      <View style={styles.groundClip}>
        <Animated.View style={[styles.groundRow, lines]}>
          {Array.from({ length: 8 }, (_, i) => (
            <View key={i} style={[styles.dash, { backgroundColor: ground }]} />
          ))}
        </Animated.View>
      </View>
      <View style={styles.shadow} />

      <Animated.View style={[StyleSheet.absoluteFill, bob]}>
        <Leg phase={phase} offset={0.5} color="#2B2B2B" sock={shirt} skin="#D9A273" back />
        <Arm phase={phase} offset={0} skin="#D9A273" sleeve={shirt} back />
        {/* torso, leaning into the run */}
        <View style={[styles.torso, { backgroundColor: shirt }]} />
        <View style={[styles.shorts, { backgroundColor: shorts }]} />
        <View style={styles.neck} />
        <View style={styles.head}>
          <View style={styles.hair} />
        </View>
        <Leg phase={phase} offset={0} color="#111" sock={shirt} skin="#E8B98A" />
        <Arm phase={phase} offset={0.5} skin="#E8B98A" sleeve={shirt} />
      </Animated.View>

      <Animated.View style={[styles.ball, ball]}>
        <View style={styles.ballBg} />
        <Icon name="soccerball" size={22} color="#111" fallback="⚽" />
      </Animated.View>
    </View>
  );
}

function Leg({ phase, offset, color, sock, skin, back }: { phase: SharedValue<number>; offset: number; color: string; sock: string; skin: string; back?: boolean }) {
  const thigh = useAnimatedStyle(() => {
    const a = (phase.get() + offset) * Math.PI * 2;
    return { transform: [{ rotate: `${-Math.sin(a) * 38}deg` }] };
  });
  const shin = useAnimatedStyle(() => {
    const a = (phase.get() + offset) * Math.PI * 2;
    // the knee folds as the leg swings back through, straightens as it reaches forward
    const fold = (1 - Math.sin(a - 0.9)) / 2;
    return { transform: [{ rotate: `${8 + fold * 70}deg` }] };
  });
  return (
    <Animated.View style={[styles.thigh, { backgroundColor: skin, opacity: back ? 0.92 : 1 }, thigh]}>
      <Animated.View style={[styles.shin, shin]}>
        <View style={[styles.sock, { backgroundColor: sock }]} />
        <View style={[styles.boot, { backgroundColor: color }]} />
      </Animated.View>
    </Animated.View>
  );
}

function Arm({ phase, offset, skin, sleeve, back }: { phase: SharedValue<number>; offset: number; skin: string; sleeve: string; back?: boolean }) {
  const style = useAnimatedStyle(() => {
    const a = (phase.get() + offset) * Math.PI * 2;
    return { transform: [{ rotate: `${-Math.sin(a) * 42 - 10}deg` }] };
  });
  return (
    <Animated.View style={[styles.arm, { backgroundColor: skin, opacity: back ? 0.92 : 1 }, style]}>
      <View style={[styles.sleeve, { backgroundColor: sleeve }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: { width: 170, height: 130, alignSelf: "center" },
  groundClip: { position: "absolute", left: 0, right: 0, top: 120, height: 3, overflow: "hidden" },
  groundRow: { flexDirection: "row", gap: 16, width: 400 },
  dash: { width: 24, height: 3, borderRadius: 2 },
  shadow: { position: "absolute", left: 52, top: 117, width: 64, height: 5, borderRadius: 3, backgroundColor: "rgba(0,0,0,0.12)" },

  torso: { position: "absolute", left: SHOULDER.x - 13, top: SHOULDER.y - 6, width: 24, height: 36, borderRadius: 8, transform: [{ rotate: "10deg" }] },
  shorts: { position: "absolute", left: HIP.x - 12, top: HIP.y - 8, width: 24, height: 14, borderRadius: 5, transform: [{ rotate: "8deg" }] },
  neck: { position: "absolute", left: SHOULDER.x + 1, top: SHOULDER.y - 11, width: 7, height: 8, borderRadius: 3, backgroundColor: "#E8B98A" },
  head: { position: "absolute", left: SHOULDER.x - 3, top: SHOULDER.y - 29, width: 19, height: 20, borderRadius: 10, backgroundColor: "#E8B98A", overflow: "hidden" },
  hair: { position: "absolute", left: -2, top: -3, width: 22, height: 9, borderRadius: 5, backgroundColor: "#2A1B12" },

  thigh: { position: "absolute", left: HIP.x - 4.5, top: HIP.y, width: 9, height: THIGH, borderRadius: 5, transformOrigin: "50% 0%" },
  shin: { position: "absolute", left: 0.5, top: THIGH - 4, width: 8, height: SHIN, borderRadius: 4, transformOrigin: "50% 0%" },
  sock: { position: "absolute", left: 0, right: 0, top: 6, bottom: 0, borderRadius: 4 },
  boot: { position: "absolute", left: -1, top: SHIN - 4, width: 15, height: 7, borderRadius: 4 },

  arm: { position: "absolute", left: SHOULDER.x - 3, top: SHOULDER.y - 2, width: 7, height: ARM, borderRadius: 4, transformOrigin: "50% 0%" },
  sleeve: { position: "absolute", left: -1, right: -1, top: 0, height: 9, borderRadius: 4 },

  ball: { position: "absolute", left: 112, top: 98, width: 22, height: 22, alignItems: "center", justifyContent: "center" },
  ballBg: { position: "absolute", width: 20, height: 20, borderRadius: 10, backgroundColor: "white" },
});
