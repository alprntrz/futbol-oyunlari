import { Nunito_600SemiBold, Nunito_800ExtraBold, Nunito_900Black, useFonts } from "@expo-google-fonts/nunito";
import { PressStart2P_400Regular } from "@expo-google-fonts/press-start-2p";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { I18nProvider } from "~/lib/i18n";
import { C, F } from "~/lib/theme";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({ PressStart2P_400Regular, Nunito_600SemiBold, Nunito_800ExtraBold, Nunito_900Black });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <I18nProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: C.bg },
          headerTintColor: C.text,
          headerTitleStyle: { fontFamily: F.black },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: C.bg },
        }}
      />
    </I18nProvider>
  );
}
