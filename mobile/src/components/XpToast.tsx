import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeOutUp, Keyframe } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

/**
 * "+35 XP" pill that drops in at the top after any game pays XP, with the level
 * bar filling; a level-up shows the new level. Mounted once in the root layout.
 */
export function XpToast() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [pending, setPending] = useState<(XpAward & { id: number }) | null>(null);
  const [award, setAward] = useState<(XpAward & { id: number }) | null>(null);
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

  // show once no ceremony covers the screen; then play its sound
  useEffect(() => {
    if (!pending || overlay || reward) return;
    const id = setTimeout(() => {
      setAward(pending);
      setPending(null);
      play(pending.after.level > pending.before.level ? "levelup" : "coin");
    }, 600);
    return () => clearTimeout(id);
  }, [pending, overlay, reward]);

  useEffect(() => {
    if (!award) return;
    const id = setTimeout(() => setAward(null), award.after.level > award.before.level ? 4200 : 3000);
    return () => clearTimeout(id);
  }, [award]);

  if (!award) return null;
  const levelled = award.after.level > award.before.level;
  const fraction = award.after.need ? award.after.into / award.after.need : 0;

  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + 8 }]}>
      <Animated.View key={award.id} entering={DROP} exiting={FadeOutUp.duration(250)} style={styles.pill}>
        <LevelBadge level={award.after.level} size={36} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{levelled ? t("levelUpTo").replace("{n}", String(award.after.level)) : award.label ? `${t(award.label as Parameters<typeof t>[0])} · +${award.gained} XP` : `+${award.gained} XP`}</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.max(4, fraction * 100)}%` }]} />
          </View>
        </View>
        {levelled && <Text style={styles.gained}>+{award.gained} XP</Text>}
      </Animated.View>
    </View>
  );
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
  title: { fontFamily: F.display, fontSize: 20, color: C.text },
  gained: { fontFamily: F.display, fontSize: 16, color: C.greenDark },
  track: { height: 8, borderRadius: 4, backgroundColor: "#E3E8E4", marginTop: 4, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4, backgroundColor: C.green },
});
