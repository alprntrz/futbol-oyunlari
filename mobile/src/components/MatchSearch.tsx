import { useEffect, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, Keyframe } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { rankOf } from "@/lib/levels";

import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { loadAvatar } from "~/lib/avatar";
import { loadNick, randomNick } from "~/lib/nick";
import { F } from "~/lib/theme";
import { loadXp } from "~/lib/xp";

import { Avatar } from "./Avatar";
import { TierChip } from "./Rank";
import { Text } from "./Text";
import { Button } from "./ui";

const RED = "#E8414F";
const BLUE = "#3B6FE8";

const flick = new Keyframe({
  0: { opacity: 0, transform: [{ translateX: 160 }, { skewX: "-8deg" }] },
  100: { opacity: 1, transform: [{ translateX: 0 }, { skewX: "-8deg" }] },
}).duration(110);
const lockIn = new Keyframe({
  0: { transform: [{ scale: 1.35 }, { skewX: "-8deg" }] },
  60: { transform: [{ scale: 0.94 }, { skewX: "-8deg" }] },
  100: { transform: [{ scale: 1 }, { skewX: "-8deg" }] },
}).duration(380);

/**
 * Looking for an opponent (Draft Showdown style): red top half where made-up
 * player cards flick past like a slot machine, blue bottom half with your own
 * card. `found` locks the top card on the real opponent.
 */
export function MatchSearch({ found, onCancel }: { found: { nick: string; tier?: number | null } | null; onCancel: () => void }) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [shown, setShown] = useState(randomNick);
  const [tick, setTick] = useState(0);
  const [me, setMe] = useState<{ nick: string; avatar: string | null; tier: number }>({ nick: "", avatar: null, tier: 0 });
  const [dots, setDots] = useState(1);

  useEffect(() => {
    Promise.all([loadNick(), loadAvatar(), loadXp()]).then(([nick, avatar, xp]) => setMe({ nick, avatar, tier: rankOf(xp.level).index }));
  }, []);

  // names flick past until someone is found
  useEffect(() => {
    if (found) return;
    const id = setInterval(() => {
      setShown(randomNick());
      setTick((n) => n + 1);
      haptic.tap();
    }, 520);
    return () => clearInterval(id);
  }, [found]);
  useEffect(() => {
    if (found) return;
    const id = setInterval(() => setDots((d) => (d % 3) + 1), 450);
    return () => clearInterval(id);
  }, [found]);

  const card = (name: string, color: string, avatar: string | null, tier: number | null | undefined) => (
    <View style={[styles.card, { backgroundColor: color }]}>
      <View style={styles.avatar}>
        <Avatar id={avatar} size={46} />
      </View>
      <View style={{ flexShrink: 1, gap: 4 }}>
        <Text style={styles.cardName} numberOfLines={1}>
          {name}
        </Text>
        {tier != null && <TierChip tier={tier} />}
      </View>
    </View>
  );

  return (
    <View style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: RED }]} />
      <View style={[styles.blue, { width: width * 1.6, height, left: -width * 0.3, top: height * 0.47 }]} />

      <View style={[styles.slot, { top: height * 0.24 }]}>
        {found ? (
          <Animated.View key="found" entering={lockIn}>
            {card(found.nick, "#C42E3C", null, found.tier)}
          </Animated.View>
        ) : (
          <Animated.View key={tick} entering={flick}>
            {card(shown, "#B23A48", null, null)}
          </Animated.View>
        )}
      </View>

      <Animated.View entering={FadeIn.delay(150)} style={[styles.vsWrap, { top: height * 0.41 }]}>
        <Text style={styles.vs}>VS</Text>
      </Animated.View>

      <View style={[styles.slot, { top: height * 0.58 }]}>
        <View style={{ transform: [{ skewX: "-8deg" }] }}>{card(me.nick || t("you"), "#2A55C9", me.avatar, me.tier)}</View>
      </View>

      <View style={[styles.bottom, { bottom: insets.bottom + 24 }]}>
        <Text style={styles.status}>{found ? t("htMatchFound") : `${t("htSearching").replace(/…$/, "")}${".".repeat(dots)}`}</Text>
        {!found && <Button title={t("cancel")} kind="secondary" onPress={onCancel} style={{ alignSelf: "stretch" }} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  blue: { position: "absolute", backgroundColor: BLUE, transform: [{ rotate: "-9deg" }] },
  slot: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 230,
    maxWidth: 300,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 22,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.9)",
  },
  avatar: { width: 52, height: 52, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.9)", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  cardName: { fontFamily: F.black, fontSize: 24, color: "white" },
  vsWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  vs: { fontFamily: F.black, fontSize: 64, color: "white", textShadowColor: "rgba(0,0,0,0.3)", textShadowOffset: { width: 0, height: 5 }, textShadowRadius: 0 },
  bottom: { position: "absolute", left: 24, right: 24, alignItems: "center", gap: 16 },
  status: { fontFamily: F.display, fontSize: 22, color: "white" },
});
