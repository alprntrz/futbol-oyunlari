import { Image, StyleSheet, View } from "react-native";

import { avatarById } from "~/lib/avatar";

/** Round avatar: the preset character on its tinted circle. */
export function Avatar({ id, size = 56, ring }: { id: string | null | undefined; nick?: string; size?: number; ring?: string }) {
  const a = avatarById(id);
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: a.bg },
        ring ? { borderWidth: Math.max(2, size / 18), borderColor: ring } : null,
      ]}
    >
      {/* the bust sits on the bottom edge of the circle */}
      <Image source={a.image} style={{ width: size * 0.92, height: size * 0.92, marginTop: size * 0.08 }} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: "center", justifyContent: "flex-end", overflow: "hidden" },
});
