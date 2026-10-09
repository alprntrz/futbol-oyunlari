import { Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type ViewStyle } from "react-native";

import { haptic } from "~/lib/haptics";
import { C, F } from "~/lib/theme";

/** Pressable that shrinks slightly and ticks a haptic when touched. */
export function Tap({
  style,
  onPress,
  silent,
  ...rest
}: PressableProps & { style?: StyleProp<ViewStyle>; silent?: boolean }) {
  return (
    <Pressable
      {...rest}
      onPress={(e) => {
        if (!silent) haptic.press();
        onPress?.(e);
      }}
      style={({ pressed }) => [style, pressed && !rest.disabled && { transform: [{ scale: 0.97 }], opacity: 0.85 }]}
    />
  );
}

export function Button({
  title,
  onPress,
  color = C.indigo,
  outline,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  color?: string;
  outline?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Tap
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        outline ? { borderWidth: 1.5, borderColor: C.border } : { backgroundColor: color },
        disabled && { opacity: 0.5 },
        style,
      ]}
    >
      <Text style={[styles.buttonText, outline && { color: C.textDim }]}>{title}</Text>
    </Tap>
  );
}

/** Big tappable card used for menus (game list, modes, difficulty). */
export function MenuCard({
  title,
  subtitle,
  emoji,
  color,
  onPress,
  children,
}: {
  title: string;
  subtitle?: string;
  emoji?: string;
  color: string;
  onPress: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Tap onPress={onPress} style={[styles.card, { borderColor: color + "99", backgroundColor: color + "26" }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        {emoji ? <Text style={{ fontSize: 34 }}>{emoji}</Text> : null}
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{title}</Text>
          {subtitle ? <Text style={styles.cardSub}>{subtitle}</Text> : null}
          {children}
        </View>
        <Text style={{ color: C.textMute, fontSize: 22 }}>›</Text>
      </View>
    </Tap>
  );
}

export function Pill({ label, color }: { label: string; color: string }) {
  return (
    <View style={{ backgroundColor: color, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 }}>
      <Text style={{ color: "white", fontFamily: F.bold, fontSize: 11 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: "white", fontFamily: F.black, fontSize: 15 },
  card: { borderRadius: 18, borderWidth: 1.5, padding: 18 },
  cardTitle: { color: C.text, fontFamily: F.black, fontSize: 19 },
  cardSub: { color: C.textDim, fontFamily: F.body, fontSize: 13, marginTop: 2 },
});
