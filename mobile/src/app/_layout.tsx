import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { I18nProvider } from "~/lib/i18n";
import { C } from "~/lib/theme";

/** Tabs live in (tabs); every game screen is pushed full-screen on top. */
export default function RootLayout() {
  return (
    <I18nProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: C.bg },
          headerTintColor: C.text,
          headerTitleStyle: { fontWeight: "700" },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: C.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </I18nProvider>
  );
}
