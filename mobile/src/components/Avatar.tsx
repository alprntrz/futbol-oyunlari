import { StyleSheet, View } from "react-native";

import { avatarById } from "~/lib/avatar";
import { F } from "~/lib/theme";

import { Text } from "./Text";

/** Round avatar: the preset's colours with the nickname's first letter. */
export function Avatar({ id, nick, size = 56, ring }: { id: string | null | undefined; nick: string; size?: number; ring?: string }) {
  const a = avatarById(id);
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: a.bg },
        ring ? { borderWidth: Math.max(2, size / 18), borderColor: ring } : null,
      ]}
    >
      <Text allowFontScaling={false} style={[styles.letter, { color: a.fg, fontSize: size * 0.48, lineHeight: size * 0.6 }]}>
        {(nick.trim()[0] ?? "?").toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: "center", justifyContent: "center" },
  letter: { fontFamily: F.black, textAlign: "center" },
});
