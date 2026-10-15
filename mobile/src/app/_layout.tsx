import {
  BarlowCondensed_600SemiBold,
  BarlowCondensed_800ExtraBold,
  BarlowCondensed_800ExtraBold_Italic,
  BarlowCondensed_900Black,
  useFonts,
} from "@expo-google-fonts/barlow-condensed";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { InviteBanner } from "~/components/InviteBanner";
import { RewardScreen } from "~/components/RewardScreen";
import { XpToast } from "~/components/XpToast";
import { initAccount } from "~/lib/account";
import "~/lib/playStreak"; // counts finished games from app start
import { ONBOARDING } from "~/lib/features";
import { I18nProvider } from "~/lib/i18n";
import { initSounds } from "~/lib/sound";
import { C, F } from "~/lib/theme";

SplashScreen.preventAutoHideAsync();

/** Tabs live in (tabs); every game screen is pushed full-screen on top. */
export default function RootLayout() {
  const [loaded] = useFonts({
    BarlowCondensed_600SemiBold,
    BarlowCondensed_800ExtraBold,
    BarlowCondensed_800ExtraBold_Italic,
    BarlowCondensed_900Black,
  });

  useEffect(() => {
    if (!loaded) return;
    SplashScreen.hideAsync();
    initSounds();
    // restore the account session (if any), sync XP, pay the daily sign-in bonus
    initAccount();
    // Onboarding (app/onboarding.tsx) is held back for v2 (lib/features.ts)
    if (ONBOARDING)
      AsyncStorage.getItem("onboarded-v1").then((done) => {
        if (!done) router.push("/onboarding");
      });
  }, [loaded]);

  if (!loaded) return null;

  return (
    <I18nProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: C.bg },
          headerTintColor: C.text,
          headerTitleStyle: { fontFamily: F.display, fontSize: 22 },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: C.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, presentation: "fullScreenModal", animation: "fade" }} />
        <Stack.Screen name="oyna" options={{ headerShown: false, presentation: "fullScreenModal", animation: "slide_from_bottom" }} />
      </Stack>
      <RewardScreen />
      <XpToast />
      <InviteBanner />
    </I18nProvider>
  );
}
