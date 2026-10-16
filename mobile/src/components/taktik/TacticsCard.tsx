import { Image, StyleSheet, View, type ImageSourcePropType } from "react-native";
import Animated, { Easing, useAnimatedStyle, withTiming } from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import type { AugmentId } from "@/lib/taktik/types";

import { TAKTIK } from "~/lib/brand";
import { useI18n } from "~/lib/i18n";
import { F } from "~/lib/theme";

import { Text } from "../Text";
import { Tap } from "../ui";

/** what a tactics card is about: how the match is played, who is in the squad, or a helping hand */
type Kind = "tactic" | "squad" | "support";

const KIND: Record<AugmentId, Kind> = {
  gegenpress: "tactic",
  bus: "tactic",
  longball: "tactic",
  wings: "tactic",
  academy: "squad",
  signing: "squad",
  legend: "squad",
  intl: "squad",
  cash: "support",
  crowd: "support",
};

/** card face per kind: gradient top → bottom, the frame, and the tag */
const FACE: Record<Kind, { top: string; bottom: string; frame: string; tag: string }> = {
  tactic: { top: "#6366F1", bottom: "#1E1B4B", frame: "#A5B4FC", tag: "#C7D2FE" },
  squad: { top: "#22C55E", bottom: "#052E16", frame: "#86EFAC", tag: "#BBF7D0" },
  support: { top: "#F59E0B", bottom: "#451A03", frame: "#FCD34D", tag: "#FDE68A" },
};

/** stand-in art until the card illustrations are in (TAKTIK.aug) */
const EMOJI: Record<AugmentId, string> = {
  gegenpress: "⚡",
  bus: "🚌",
  longball: "🎯",
  wings: "🪽",
  academy: "🌱",
  signing: "✍️",
  legend: "👑",
  intl: "🌍",
  cash: "💰",
  crowd: "📣",
};

export type CardState = "idle" | "picked" | "faded";

/**
 * A tall tactics card, as in the reference game's power-card pick: art on top,
 * name and what it does below, on a face coloured by its kind. The picked card
 * grows a little and lights up; the others dim.
 */
export function TacticsCard({ id, width, state = "idle", onPress }: { id: AugmentId; width: number; state?: CardState; onPress?: () => void }) {
  const { t } = useI18n();
  const kind = KIND[id];
  const face = FACE[kind];
  const height = width * 1.72;
  // the card art (docs/design/taktik-kart-brief.md → scripts/taktik-card-assets.py); missing ones keep an emoji
  const art = (TAKTIK as { aug?: Partial<Record<AugmentId, ImageSourcePropType>> }).aug?.[id];

  const style = useAnimatedStyle(() => ({
    opacity: withTiming(state === "faded" ? 0.35 : 1, { duration: 220 }),
    transform: [{ scale: withTiming(state === "picked" ? 1.07 : state === "faded" ? 0.95 : 1, { duration: 260, easing: Easing.out(Easing.cubic) }) }],
  }));

  return (
    <Animated.View style={[style, state === "picked" && { shadowColor: face.frame, shadowOpacity: 0.9, shadowRadius: 16, shadowOffset: { width: 0, height: 0 } }]}>
      <Tap onPress={onPress} disabled={!onPress} style={[styles.card, { width, height, borderColor: state === "picked" ? "white" : face.frame }]} accessibilityLabel={`${t(`ttkA_${id}`)}. ${t(`ttkAd_${id}`)}`}>
        <Svg style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={`g-${id}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={face.top} />
              <Stop offset="1" stopColor={face.bottom} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#g-${id})`} />
        </Svg>
        <View style={[styles.tag, { backgroundColor: face.tag }]}>
          <Text allowFontScaling={false} style={[styles.tagText, { color: face.bottom }]}>
            {t(`ttkKind_${kind}`)}
          </Text>
        </View>
        <View style={[styles.art, { height: width * 0.78 }]}>
          {art ? (
            <Image source={art} style={{ width: width * 0.78, height: width * 0.78 }} resizeMode="contain" />
          ) : (
            <Text allowFontScaling={false} style={{ fontSize: width * 0.36 }}>
              {EMOJI[id]}
            </Text>
          )}
        </View>
        <Text allowFontScaling={false} style={styles.name} numberOfLines={2} adjustsFontSizeToFit>
          {t(`ttkA_${id}`)}
        </Text>
        <Text allowFontScaling={false} style={styles.desc} numberOfLines={4}>
          {t(`ttkAd_${id}`)}
        </Text>
      </Tap>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 2, overflow: "hidden", alignItems: "center", paddingHorizontal: 8, paddingTop: 8, paddingBottom: 10 },
  tag: { alignSelf: "center", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  art: { alignSelf: "stretch", alignItems: "center", justifyContent: "center", marginTop: 6, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.12)" },
  name: { fontFamily: F.display, fontSize: 19, lineHeight: 20, color: "white", textAlign: "center", marginTop: 8 },
  desc: { fontSize: 11.5, lineHeight: 15, fontWeight: "600", color: "rgba(255,255,255,0.88)", textAlign: "center", marginTop: 4 },
});

/** The tactics cards a manager has taken, as small chips (art + what it does), shown on the board and at the match. */
export function TacticsChips({ ids, dark, align = "flex-start" }: { ids: AugmentId[]; dark?: boolean; align?: "flex-start" | "center" | "flex-end" }) {
  const { t } = useI18n();
  if (!ids.length) return null;
  const arts = (TAKTIK as { aug?: Partial<Record<AugmentId, ImageSourcePropType>> }).aug ?? {};
  return (
    <View style={[chip.row, { justifyContent: align }]}>
      {ids.map((id) => {
        const face = FACE[KIND[id]];
        return (
          <View key={id} style={[chip.chip, { backgroundColor: dark ? "rgba(255,255,255,0.1)" : "white", borderColor: face.frame }]}>
            {arts[id] ? (
              <Image source={arts[id]} style={chip.art} />
            ) : (
              <Text allowFontScaling={false} style={{ fontSize: 13 }}>
                {EMOJI[id]}
              </Text>
            )}
            <Text allowFontScaling={false} style={[chip.text, { color: dark ? "white" : "#0E1A14" }]} numberOfLines={1}>
              {t(`ttkAs_${id}`)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const chip = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, borderWidth: 1.5, paddingLeft: 3, paddingRight: 9, paddingVertical: 2 },
  art: { width: 22, height: 22 },
  text: { fontSize: 12, fontWeight: "800" },
});
