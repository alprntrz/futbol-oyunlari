import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { C } from "~/lib/theme";

/** Scrollable screen body under the native header. */
export function Screen({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  const insets = useSafeAreaInsets();
  const pad = { paddingHorizontal: 12, paddingTop: 12, paddingBottom: insets.bottom + 24 };
  if (!scroll) return <View style={[{ flex: 1, backgroundColor: C.bg }, pad]}>{children}</View>;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={[pad, { alignItems: "center", flexGrow: 1 }]}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ width: "100%", maxWidth: 520, alignItems: "center" }}>{children}</View>
    </ScrollView>
  );
}
