import { useEffect, useState } from "react";
import { Image, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  FadeOutUp,
  Keyframe,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { REWARD } from "~/lib/brand";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { play } from "~/lib/sound";
import { C, F } from "~/lib/theme";
import { onOverlay, onRewardOpen, onXpAward, type XpAward } from "~/lib/xp";

import { LevelBadge } from "./QuizLevel";
import { Text } from "./Text";

const DROP = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: -24 }, { scale: 0.9 }] },
  60: { opacity: 1, transform: [{ translateY: 4 }, { scale: 1.03 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
}).duration(380);

/** gems that fly into the bar, and when they start / land (ms after the pill drops) */
const GEMS = 6;
const FLY_FROM = 250;
const FLY_MS = 520;
const GEM_GAP = 70;
const LANDED = FLY_FROM + FLY_MS + GEM_GAP * (GEMS - 1);

type Shown = XpAward & { id: number };

/**
 * "+35 XP" after any game: the pill drops in, XP gems burst from the middle of
 * the screen and fly into it one by one, the number counts up as they land and
 * the level bar fills from where it was; a level-up fills the bar, flashes and
 * pops the new level badge. Mounted once in the root layout.
 */
export function XpToast() {
  const [pending, setPending] = useState<Shown | null>(null);
  const [award, setAward] = useState<Shown | null>(null);
  const [overlay, setOverlay] = useState(false);
  const [reward, setReward] = useState(false);

  // several awards before it shows (rare) merge into one pill
  useEffect(
    () =>
      onXpAward((a) => {
        // awards with stats get the full reward screen instead
        if (a.stats) return;
        setPending((p) => ({ ...a, before: p?.before ?? a.before, gained: (p?.gained ?? 0) + a.gained, label: a.label ?? p?.label, id: Date.now() }));
      }),
    []
  );
  useEffect(() => onOverlay(setOverlay), []);
  useEffect(() => onRewardOpen(setReward), []);

  // show once no ceremony covers the screen
  useEffect(() => {
    if (!pending || overlay || reward) return;
    const id = setTimeout(() => {
      setAward(pending);
      setPending(null);
    }, 500);
    return () => clearTimeout(id);
  }, [pending, overlay, reward]);

  useEffect(() => {
    if (!award) return;
    const id = setTimeout(() => setAward(null), award.after.level > award.before.level ? 4200 : 3200);
    return () => clearTimeout(id);
  }, [award]);

  return award ? <Pill key={award.id} award={award} /> : null;
}

function Pill({ award }: { award: Shown }) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const levelled = award.after.level > award.before.level;
  const [shownXp, setShownXp] = useState(0);
  const [badgeLevel, setBadgeLevel] = useState(award.before.level);

  const frac = (x: { into: number; need: number }) => (x.need ? x.into / x.need : 0);
  const bar = useSharedValue(frac(award.before));
  const badge = useSharedValue(1);
  const flash = useSharedValue(0);

  useEffect(() => {
    play("whoosh");
    // the number counts up while the gems land
    const steps = 18;
    let n = 0;
    const count = setInterval(() => {
      n++;
      setShownXp(Math.round((award.gained * n) / steps));
      if (n >= steps) clearInterval(count);
    }, (LANDED - FLY_FROM) / steps);
    const ticks = Array.from({ length: GEMS }, (_, i) => setTimeout(() => haptic.tap(), FLY_FROM + FLY_MS + i * GEM_GAP));
    const done = setTimeout(() => {
      play(levelled ? "levelup" : "coin");
      if (levelled) {
        haptic.success();
        setBadgeLevel(award.after.level);
      }
    }, LANDED);

    // the bar: to the new spot, or full → flash → from empty to the new spot
    const ease = Easing.out(Easing.cubic);
    if (levelled) {
      bar.set(
        withSequence(
          withDelay(FLY_FROM + FLY_MS, withTiming(1, { duration: LANDED - FLY_FROM - FLY_MS, easing: ease })),
          withTiming(0, { duration: 0 }),
          withTiming(frac(award.after), { duration: 500, easing: ease })
        )
      );
      flash.set(withDelay(LANDED, withSequence(withTiming(1, { duration: 120 }), withTiming(0, { duration: 500 }))));
      badge.set(withDelay(LANDED, withSequence(withTiming(1.15, { duration: 160 }), withTiming(1, { duration: 180 }))));
    } else {
      bar.set(withDelay(FLY_FROM + FLY_MS, withTiming(frac(award.after), { duration: LANDED - FLY_FROM - FLY_MS + 150, easing: ease })));
      badge.set(withDelay(LANDED, withSequence(withTiming(1.12, { duration: 120 }), withTiming(1, { duration: 180 }))));
    }
    return () => {
      clearInterval(count);
      ticks.forEach(clearTimeout);
      clearTimeout(done);
    };
  }, [award, levelled, bar, badge, flash]);

  const barStyle = useAnimatedStyle(() => ({ width: `${Math.max(4, bar.get() * 100)}%` }));
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: badge.get() }] }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.get() }));

  const top = insets.top + 8;
  // where the gems land: the bar, roughly in the middle of the pill
  const target = { x: width / 2, y: top + 44 };

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.wrap, { top }]}>
        <Animated.View entering={DROP} exiting={FadeOutUp.duration(250)} style={styles.pill}>
          <Animated.View style={badgeStyle}>
            <LevelBadge level={badgeLevel} size={38} />
          </Animated.View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>
              {levelled && badgeLevel === award.after.level
                ? t("levelUpTo").replace("{n}", String(award.after.level))
                : award.label
                  ? `${t(award.label as Parameters<typeof t>[0])} · +${shownXp} XP`
                  : `+${shownXp} XP`}
            </Text>
            <View style={styles.track}>
              <Animated.View style={[styles.fill, barStyle]} />
              <Animated.View style={[StyleSheet.absoluteFill, styles.flash, flashStyle]} />
            </View>
          </View>
          <Image source={REWARD.xp} style={styles.gemIcon} />
        </Animated.View>
      </View>
      {Array.from({ length: GEMS }, (_, i) => (
        <Gem key={i} i={i} from={{ x: width / 2, y: height * 0.42 }} to={target} />
      ))}
    </View>
  );
}

/** One XP gem: pops out around the middle of the screen, then flies into the bar. */
function Gem({ i, from, to }: { i: number; from: { x: number; y: number }; to: { x: number; y: number } }) {
  const size = 30;
  // a fixed spread per gem so they don't all start on one spot
  const angle = (i / GEMS) * Math.PI * 2 + 0.4;
  const spread = { x: Math.cos(angle) * 70, y: Math.sin(angle) * 50 };
  const x = useSharedValue(from.x);
  const y = useSharedValue(from.y);
  const s = useSharedValue(0);
  const o = useSharedValue(0);

  useEffect(() => {
    const start = FLY_FROM + i * GEM_GAP;
    o.set(withDelay(i * 30, withSequence(withTiming(1, { duration: 120 }), withDelay(start + FLY_MS - 150, withTiming(0, { duration: 120 })))));
    s.set(withDelay(i * 30, withSequence(withTiming(1, { duration: 160 }), withDelay(start - 200, withTiming(0.55, { duration: FLY_MS })))));
    x.set(
      withSequence(
        withTiming(from.x + spread.x, { duration: 220, easing: Easing.out(Easing.quad) }),
        withDelay(start - 220 + i * 30, withTiming(to.x, { duration: FLY_MS, easing: Easing.in(Easing.cubic) }))
      )
    );
    y.set(
      withSequence(
        withTiming(from.y + spread.y, { duration: 220, easing: Easing.out(Easing.quad) }),
        withDelay(start - 220 + i * 30, withTiming(to.y, { duration: FLY_MS, easing: Easing.in(Easing.quad) }))
      )
    );
  }, [i, from.x, from.y, to.x, to.y, spread.x, spread.y, x, y, s, o]);

  const style = useAnimatedStyle(() => ({
    opacity: o.get(),
    transform: [{ translateX: x.get() - size / 2 }, { translateY: y.get() - size / 2 }, { scale: s.get() }],
  }));
  return <Animated.Image source={REWARD.xp} style={[styles.gem, { width: size, height: size }, style]} />;
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16, alignItems: "center", zIndex: 100 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    width: "100%",
    maxWidth: 360,
    backgroundColor: C.card,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  title: { fontFamily: F.display, fontSize: 20, color: C.text, fontVariant: ["tabular-nums"] },
  track: { height: 10, borderRadius: 5, backgroundColor: "#E3E8E4", marginTop: 5, overflow: "hidden" },
  fill: { height: 10, borderRadius: 5, backgroundColor: C.green },
  flash: { backgroundColor: "#FDE68A", borderRadius: 5 },
  gemIcon: { width: 30, height: 30 },
  gem: { position: "absolute", left: 0, top: 0, zIndex: 101 },
});
