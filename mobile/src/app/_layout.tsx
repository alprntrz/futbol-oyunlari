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

import { AppErrorScreen, UpdateRequired } from "~/components/AppError";
import { EloToast } from "~/components/EloToast";
import { InviteBanner } from "~/components/InviteBanner";
import { PlayerMenuHost } from "~/components/PlayerMenu";
import { useUpdateRequired } from "~/lib/appHealth";
import { RatingAsk } from "~/lib/rating";
import { RemindersSync } from "~/lib/reminders";
import { RewardScreen } from "~/components/RewardScreen";
import { XpToast } from "~/components/XpToast";
import { initAccount } from "~/lib/account";
import "~/lib/playStreak"; // counts finished games from app start
import { ONBOARDING } from "~/lib/features";
import { I18nProvider } from "~/lib/i18n";
import { initSounds } from "~/lib/sound";
import { loadXp } from "~/lib/xp";
import { C, F } from "~/lib/theme";

SplashScreen.preventAutoHideAsync();

// a screen that throws shows a friendly page (and sends an anonymous report) instead of a white screen
export const ErrorBoundary = AppErrorScreen;

/** Tabs live in (tabs); every game screen is pushed full-screen on top. */
export default function RootLayout() {
  const [loaded] = useFonts({
    BarlowCondensed_600SemiBold,
    BarlowCondensed_800ExtraBold,
    BarlowCondensed_800ExtraBold_Italic,
    BarlowCondensed_900Black,
  });
  const updateFrom = useUpdateRequired();

  useEffect(() => {
    if (!loaded) return;
    SplashScreen.hideAsync();
    initSounds();
    // restore the account session (if any), sync XP, pay the daily sign-in bonus
    initAccount();
    // Onboarding (app/onboarding.tsx): new installs only (no XP yet), so players updating from 1.0 never see it
    if (ONBOARDING)
      Promise.all([AsyncStorage.getItem("onboarded-v1"), loadXp()]).then(([done, xp]) => {
        if (!done && xp.xp === 0) router.push("/onboarding");
      });
  }, [loaded]);

  if (!loaded) return null;

  if (updateFrom !== null)
    return (
      <I18nProvider>
        <StatusBar style="dark" />
        <UpdateRequired store={updateFrom} />
      </I18nProvider>
    );

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
      <EloToast />
      <InviteBanner />
      <RemindersSync />
      <RatingAsk />
      <PlayerMenuHost />
    </I18nProvider>
  );
}
