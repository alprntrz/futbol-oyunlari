import { MaterialSymbols_600SemiBold_Filled } from "@expo-google-fonts/material-symbols/600SemiBold_Filled";
import { SymbolView, type AndroidSymbol, type SymbolViewProps } from "expo-symbols";
import semiBold from "expo-symbols/androidWeights/semiBold";
import { Image, Platform, Pressable, ScrollView, StyleSheet, View, type ImageSourcePropType, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { haptic } from "~/lib/haptics";
import { C, F, R, shadow, T } from "~/lib/theme";

import { Text } from "./Text";

type SymbolName = SymbolViewProps["name"];

/**
 * The Material Symbol drawn on Android for each SF Symbol the app uses (expo-symbols draws
 * Material Symbols there). A name missing here falls back to the emoji / text.
 */
const MATERIAL: Record<string, AndroidSymbol> = {
  "10.circle.fill": "filter_9_plus",
  "20.circle.fill": "filter_9_plus",
  "antenna.radiowaves.left.and.right": "sensors",
  "arrow.clockwise": "refresh",
  "arrow.down.circle.fill": "download",
  "arrow.down": "arrow_downward",
  "arrow.left.arrow.right": "swap_horiz",
  "arrow.right": "arrow_forward",
  "arrow.right.circle.fill": "arrow_circle_right",
  "arrow.triangle.2.circlepath": "sync",
  "arrow.up": "arrow_upward",
  "arrow.up.right": "north_east",
  "arrow.uturn.left": "undo",
  "bell.fill": "notifications",
  "ellipsis.circle": "more_horiz",
  hourglass: "hourglass_top",
  "wifi.slash": "wifi_off",
  calendar: "event",
  checkmark: "check",
  "checkmark.circle.fill": "check_circle",
  "checkmark.seal.fill": "verified",
  "chevron.left": "chevron_left",
  "chevron.right": "chevron_right",
  clock: "schedule",
  "clock.arrow.circlepath": "history",
  "crown.fill": "workspace_premium",
  "delete.left": "backspace",
  "equal.circle": "drag_handle",
  "exclamationmark.triangle.fill": "warning",
  "face.smiling": "sentiment_satisfied",
  "figure.run": "directions_run",
  "flag.checkered": "sports_score",
  "flag.fill": "flag",
  "flame.circle.fill": "local_fire_department",
  "flame.fill": "local_fire_department",
  "forward.fill": "fast_forward",
  "gift.fill": "redeem",
  "hand.raised.fill": "front_hand",
  "hand.tap.fill": "touch_app",
  "hand.thumbsup.fill": "thumb_up",
  "hexagon.fill": "hexagon",
  "house.fill": "home",
  iphone: "smartphone",
  lightbulb: "lightbulb",
  "lightbulb.fill": "lightbulb",
  "lock.fill": "lock",
  "lock.shield.fill": "encrypted",
  magnifyingglass: "search",
  "paperplane.fill": "send",
  pencil: "edit",
  "person.2.fill": "group",
  "person.3.fill": "groups",
  "person.crop.circle": "account_circle",
  "person.fill": "person",
  photo: "image",
  "play.circle.fill": "play_circle",
  "play.fill": "play_arrow",
  plus: "add",
  questionmark: "question_mark",
  "questionmark.circle": "help",
  "rectangle.portrait.and.arrow.right": "logout",
  "rectangle.stack.fill": "stack",
  "shield.fill": "shield",
  "shoe.fill": "steps",
  shuffle: "shuffle",
  snowflake: "ac_unit",
  soccerball: "sports_soccer",
  sparkles: "auto_awesome",
  "sportscourt.fill": "stadium",
  "square.and.arrow.up": "ios_share",
  "square.grid.2x2.fill": "grid_view",
  "square.grid.3x3.fill": "apps",
  "square.stack.fill": "layers",
  "star.fill": "star",
  "stopwatch.fill": "timer",
  target: "target",
  "textformat.abc": "abc",
  "trophy.fill": "emoji_events",
  "tshirt.fill": "apparel",
  xmark: "close",
  "xmark.circle.fill": "cancel",
  "xmark.shield.fill": "gpp_bad",
};

/** the filled Material Symbols, for the SF Symbols that are filled ("….fill"), like iOS draws them */
const FILLED = { name: "MaterialSymbols_600SemiBold_Filled", font: MaterialSymbols_600SemiBold_Filled };

/** SF Symbol on iOS, the matching Material Symbol on Android, else the emoji/text fallback. */
export function Icon({ name, size = 20, color = C.text, fallback }: { name: SymbolName; size?: number; color?: string; fallback?: string }) {
  const android = typeof name === "string" ? MATERIAL[name] : undefined;
  return (
    <SymbolView
      name={typeof name === "string" ? (android ? { ios: name, android } : name) : name}
      size={size}
      tintColor={color}
      weight={{ ios: "semibold", android: typeof name === "string" && name.includes(".fill") ? FILLED : semiBold }}
      fallback={<Text style={{ fontSize: size * 0.9, color }}>{fallback ?? "•"}</Text>}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

/** Pressable with a light press-in scale and a haptic tick. */
export function Tap({ style, onPress, silent, ...rest }: PressableProps & { style?: StyleProp<ViewStyle>; silent?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      {...rest}
      accessibilityState={{ disabled: !!rest.disabled, ...rest.accessibilityState }}
      onPress={(e) => {
        if (!silent) haptic.press();
        onPress?.(e);
      }}
      style={({ pressed }) => [style, pressed && !rest.disabled && { transform: [{ scale: 0.98 }], opacity: 0.9 }]}
    />
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Scrollable page on the grey background. */
export function Page({ children, scroll = true, topInset = false }: { children: React.ReactNode; scroll?: boolean; topInset?: boolean }) {
  const insets = useSafeAreaInsets();
  // a scrolling page gets the status bar (and the tab bar) inset from iOS itself ("automatic"); only a fixed one adds it by hand
  // (Android has no automatic inset: a tab page there pads below the status bar itself)
  const pad = { paddingHorizontal: 16, paddingTop: topInset && (!scroll || Platform.OS === "android") ? insets.top + 12 : 12, paddingBottom: insets.bottom + 32 };
  if (!scroll) return <View style={[{ flex: 1, backgroundColor: C.bg }, pad]}>{children}</View>;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: C.bg }}
        contentContainerStyle={[pad, { flexGrow: 1, alignItems: "center" }]}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        {/* game screens fade their content in under the push; tabs appear as they are */}
        <Animated.View entering={topInset ? undefined : FadeIn.duration(220)} style={{ width: "100%", maxWidth: 560 }}>
          {children}
        </Animated.View>
      </ScrollView>
      {/* Tab screens have no header: keep scrolled content out from under the status bar */}
      {topInset && <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top, backgroundColor: C.bg }} />}
    </View>
  );
}

/** Darker shade of each button colour: the edge the face sits on. */
const EDGE = { primary: "#0F7A35", secondary: "#D3DBD6", danger: "#F3B5B5", ghost: "transparent", gold: "#CA8A04" } as const;
const DEPTH = 4;

/**
 * Chunky game button: a face sitting on a darker edge, pressed down into it on
 * touch (the face drops by the edge height). Ghost buttons stay flat.
 */
export function Button({
  title,
  onPress,
  kind = "primary",
  icon,
  left,
  right,
  small,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  kind?: "primary" | "secondary" | "danger" | "ghost" | "gold";
  icon?: SymbolName;
  /** an image (or anything) before / after the title, e.g. a coin next to a price */
  left?: React.ReactNode;
  right?: React.ReactNode;
  /** the compact size for toolbars and rows: lower face, thinner edge */
  small?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const bg = { primary: C.green, secondary: C.card, danger: C.redSoft, ghost: "transparent", gold: "#FACC15" }[kind];
  const fg = { primary: "white", secondary: C.text, danger: C.red, ghost: C.text2, gold: "#3B2A05" }[kind];
  const depth = kind === "ghost" ? 0 : small ? 3 : DEPTH;
  // padding and height belong to the face; layout (margins, flex, width) to the outer edge
  const { padding, paddingHorizontal, paddingVertical, paddingLeft, paddingRight, paddingTop, paddingBottom, minHeight, ...outer } = StyleSheet.flatten(style) ?? {};
  const inner = Object.fromEntries(
    Object.entries({ padding, paddingHorizontal, paddingVertical, paddingLeft, paddingRight, paddingTop, paddingBottom, minHeight }).filter(([, v]) => v !== undefined)
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityLabel={title}
      disabled={disabled}
      onPress={() => {
        haptic.press();
        onPress();
      }}
      // pressed: the face drops onto the edge (edge padding moves from below to above, behind the face)
      style={({ pressed }) => [
        { borderRadius: small ? 12 : R.button, backgroundColor: EDGE[kind] },
        pressed && !disabled ? { paddingTop: depth, backgroundColor: "transparent" } : { paddingBottom: depth },
        disabled && { opacity: 0.45 },
        outer,
      ]}
    >
      {() => (
        <View
          style={[
            styles.button,
            small && styles.buttonSmall,
            inner,
            { backgroundColor: bg },
            kind === "secondary" && { borderWidth: 1, borderColor: C.border },
          ]}
        >
          {icon ? <Icon name={icon} size={small ? 14 : 17} color={fg} /> : null}
          {left}
          <Text style={[styles.buttonText, small && styles.buttonTextSmall, { color: fg }]}>{title}</Text>
          {right}
        </View>
      )}
    </Pressable>
  );
}

/** List row: illustrated icon (or coloured symbol badge), title, description, chevron. */
export function Row({
  image,
  icon,
  iconFallback,
  color = C.text,
  soft = C.bg,
  title,
  subtitle,
  onPress,
  last,
}: {
  image?: ImageSourcePropType;
  icon?: SymbolName;
  iconFallback?: string;
  color?: string;
  soft?: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Tap onPress={onPress} style={styles.row}>
      {image ? (
        <Image source={image} style={styles.rowImage} accessibilityIgnoresInvertColors accessible={false} />
      ) : (
        <View style={[styles.badge, { backgroundColor: soft }]}>{icon ? <Icon name={icon} size={20} color={color} fallback={iconFallback} /> : null}</View>
      )}
      <View style={[styles.rowText, !last && styles.rowDivider]}>
        <View style={{ flex: 1 }}>
          <Text style={T.headline}>{title}</Text>
          {subtitle ? <Text style={[T.body, { fontSize: 14, marginTop: 2 }]}>{subtitle}</Text> : null}
        </View>
        <Icon name="chevron.right" size={14} color={C.text3} fallback="›" />
      </View>
    </Tap>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={[T.heading, { marginTop: 26, marginBottom: 10, marginLeft: 2 }]}>{children}</Text>;
}

/** iOS-style segmented control. */
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              haptic.tap();
              onChange(o.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && { color: C.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ label, color, soft, icon }: { label: string; color: string; soft: string; icon?: SymbolName }) {
  return (
    <View style={[styles.chip, { backgroundColor: soft }]}>
      {icon ? <Icon name={icon} size={12} color={color} /> : null}
      <Text style={{ color, fontSize: 13, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: R.card, padding: 16, ...shadow },
  button: {
    flexGrow: 1,
    minHeight: 48,
    borderRadius: R.button,
    paddingHorizontal: 18,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { fontFamily: F.display, fontSize: 20, letterSpacing: 0.3 },
  // small buttons sit in toolbars and under cards: they never stretch (in a column without a set height flexGrow would run to the bottom of the screen)
  buttonSmall: { flexGrow: 0, minHeight: 36, paddingHorizontal: 12, gap: 6, borderRadius: 12 },
  buttonTextSmall: { fontSize: 17 },
  row: { flexDirection: "row", alignItems: "center", paddingLeft: 14, gap: 14 },
  badge: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  rowImage: { width: 44, height: 44, marginHorizontal: -2 },
  rowText: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14, paddingRight: 14 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  segmented: { flexDirection: "row", backgroundColor: C.key, borderRadius: 12, padding: 3 },
  segment: { flex: 1, paddingVertical: 9, paddingHorizontal: 4, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  segmentActive: { backgroundColor: C.card, ...shadow, shadowOpacity: 0.1 },
  segmentText: { fontSize: 14, fontWeight: "700", color: C.text2 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: R.chip, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" },
});
