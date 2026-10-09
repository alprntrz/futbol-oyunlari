import { Pressable, Text, View } from "react-native";

import { C } from "~/lib/theme";

export function HeaderIcons({ onHelp, onStats }: { onHelp: () => void; onStats: () => void }) {
  return (
    <View style={{ flexDirection: "row", gap: 18 }}>
      <Pressable onPress={onHelp} hitSlop={10}>
        <Text style={{ color: C.text, fontSize: 18 }}>❓</Text>
      </Pressable>
      <Pressable onPress={onStats} hitSlop={10}>
        <Text style={{ color: C.text, fontSize: 18 }}>📊</Text>
      </Pressable>
    </View>
  );
}
