import { useEffect, useState } from "react";
import { Image, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { Easing, FadeIn, FadeInDown, FadeOut, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import type { Manager } from "@/lib/taktik/types";

import { AVATARS } from "~/lib/avatar";
import { TAKTIK } from "~/lib/brand";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { play } from "~/lib/sound";
import { F } from "~/lib/theme";

import { Avatar } from "../Avatar";
import { Text } from "../Text";
import { Tap } from "../ui";

/** house managers' avatars: picked from each name, stepping on so no two share one */
function avatarsOf(managers: Manager[], meId: number) {
  const used = new Set<number>();
  const out = new Map<number, string>();
  for (const m of managers) {
    if (m.id === meId) continue;
    let h = 0;
    for (const ch of m.name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    let k = h % AVATARS.length;
    while (used.has(k) && used.size < AVATARS.length) k = (k + 1) % AVATARS.length;
    used.add(k);
    out.set(m.id, AVATARS[k].id);
  }
  return out;
}

const COACH_ART = { pass: TAKTIK.coach.pass, bus: TAKTIK.coach.bus, press: TAKTIK.coach.press } as const;

/** each card "loads" at its own pace, like the reference game's lobby; all are full by FULL_MS */
const FULL_MS = 1900;
const FLIP_AT = FULL_MS + 250;
const FLIP_MS = 420;
const DONE_AT = FLIP_AT + 8 * 60 + FLIP_MS + 1100;

/**
 * Start of a new Pitch Chess game: the eight managers as a 2×4 grid of cards
 * filling up, then every card turns over to the manager's style card. Tap to
 * skip; it closes by itself.
 */
export function LobbyIntro({ managers, meId, onDone }: { managers: Manager[]; meId: number; onDone: () => void }) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cardW = Math.min(170, (width - 32 - 3 * 8) / 4);
  const [flipped, setFlipped] = useState(false);
  const [avatars] = useState(() => avatarsOf(managers, meId));

  useEffect(() => {
    play("whoosh");
    const a = setTimeout(() => {
      setFlipped(true);
      haptic.tap();
    }, FLIP_AT);
    const b = setTimeout(onDone, DONE_AT);
    return () => (clearTimeout(a), clearTimeout(b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(260)} style={StyleSheet.absoluteFill}>
      <Tap silent onPress={onDone} style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]} accessibilityLabel={t("ttkIntroSkip")}>
        <Svg style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="glow" cx="50%" cy="42%" r="70%">
              <Stop offset="0" stopColor="#1F7A45" />
              <Stop offset="1" stopColor="#04170C" />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#glow)" />
        </Svg>
        <Text style={styles.title}>{t(flipped ? "ttkIntroStyles" : "ttkIntroTitle")}</Text>
        <Text style={styles.sub}>{t("ttkIntroSub")}</Text>
        <View style={styles.grid}>
          {managers.map((m, i) => (
            <ManagerCard key={m.id} m={m} me={m.id === meId} avatar={avatars.get(m.id) ?? null} i={i} width={cardW} flipped={flipped} />
          ))}
        </View>
        <Text style={styles.skip}>{t("ttkIntroSkip")}</Text>
      </Tap>
    </Animated.View>
  );
}

function ManagerCard({ m, me, avatar, i, width, flipped }: { m: Manager; me: boolean; avatar: string | null; i: number; width: number; flipped: boolean }) {
  const { t } = useI18n();
  const height = width * 1.42;
  const load = useSharedValue(0);
  const turn = useSharedValue(0);
  // a loading pace per card, so they fill unevenly but all finish together
  const pace = 0.45 + ((i * 37) % 50) / 100;

  useEffect(() => {
    load.set(withTiming(1, { duration: FULL_MS, easing: Easing.bezier(pace, 0.1, 1 - pace, 0.9) }));
  }, [load, pace]);
  useEffect(() => {
    if (flipped) turn.set(withDelay(i * 60, withTiming(1, { duration: FLIP_MS, easing: Easing.inOut(Easing.cubic) })));
  }, [flipped, i, turn]);

  const bar = useAnimatedStyle(() => ({ width: `${load.get() * 100}%` }));
  // the front turns away in the first half, the back turns in for the second
  const front = useAnimatedStyle(() => ({ opacity: turn.get() < 0.5 ? 1 : 0, transform: [{ perspective: 800 }, { rotateY: `${turn.get() * 180}deg` }] }));
  const back = useAnimatedStyle(() => ({ opacity: turn.get() >= 0.5 ? 1 : 0, transform: [{ perspective: 800 }, { rotateY: `${turn.get() * 180 - 180}deg` }] }));

  const ring = me ? "#FACC15" : "rgba(255,255,255,0.6)";
  return (
    <Animated.View entering={FadeInDown.delay(i * 70).duration(240)} style={{ width, height }}>
      {/* front: the manager */}
      <Animated.View style={[styles.card, { width, height, borderColor: me ? "#FACC15" : "rgba(167,243,208,0.55)" }, front]}>
        <View style={styles.cardArt}>
          <Avatar id={avatar} me={me} size={width * 0.62} ring={ring} />
        </View>
        <Text allowFontScaling={false} style={[styles.name, me && { color: "#FDE68A" }]} numberOfLines={1} adjustsFontSizeToFit>
          {me ? t("you") : m.name}
        </Text>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, me && { backgroundColor: "#FACC15" }, bar]} />
        </View>
      </Animated.View>
      {/* back: the manager's style */}
      <Animated.View style={[styles.card, styles.cardBack, { width, height, borderColor: me ? "#FACC15" : "rgba(167,243,208,0.55)" }, back]}>
        <Image source={COACH_ART[m.coach]} style={{ width: width * 0.78, height: width * 0.78 }} resizeMode="contain" />
        <Text allowFontScaling={false} style={styles.style} numberOfLines={2} adjustsFontSizeToFit>
          {t(`ttkCoach_${m.coach}`)}
        </Text>
        <Text allowFontScaling={false} style={[styles.owner, me && { color: "#FDE68A" }]} numberOfLines={1} adjustsFontSizeToFit>
          {me ? t("you") : m.name}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  title: { fontFamily: F.black, fontSize: 34, color: "white", textAlign: "center" },
  sub: { color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: "600", textAlign: "center", marginTop: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 24 },
  card: {
    position: "absolute",
    top: 0,
    left: 0,
    borderRadius: 14,
    borderWidth: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    paddingBottom: 9,
    paddingHorizontal: 6,
    backfaceVisibility: "hidden",
  },
  cardBack: { backgroundColor: "rgba(6,78,59,0.85)", justifyContent: "center", gap: 4 },
  cardArt: { flex: 1, alignItems: "center", justifyContent: "center" },
  name: { fontFamily: F.display, fontSize: 15, color: "white", marginTop: 4 },
  track: { alignSelf: "stretch", height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.15)", overflow: "hidden", marginTop: 6 },
  fill: { height: 5, borderRadius: 3, backgroundColor: "#4ADE80" },
  style: { fontFamily: F.display, fontSize: 14, lineHeight: 15, color: "white", textAlign: "center" },
  owner: { fontSize: 10.5, fontWeight: "700", color: "rgba(255,255,255,0.65)" },
  skip: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "600", marginTop: 24 },
});
