import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";

import { dayNumber } from "@/lib/daily";

import { HeaderIcons } from "~/components/HeaderIcons";
import { Screen } from "~/components/Screen";
import { HowToPlaySheet, StatsSheet } from "~/components/Sheets";
import { MenuCard } from "~/components/ui";
import { useI18n } from "~/lib/i18n";
import { loadStats, type GameStats } from "~/lib/storage";
import { C } from "~/lib/theme";

export default function MissingXIHome() {
  const { t } = useI18n();
  const [help, setHelp] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [stats, setStats] = useState<GameStats | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadStats().then(setStats);
    }, [])
  );

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: t("missingXI"),
          headerRight: () => <HeaderIcons onHelp={() => setHelp(true)} onStats={() => setStatsOpen(true)} />,
        }}
      />
      <View style={{ gap: 12, width: "100%" }}>
        <MenuCard
          title={`${t("daily")} #${dayNumber() % 1000}`}
          subtitle={t("dailyDesc")}
          emoji="📅"
          color={C.indigo}
          onPress={() => router.push("/eksik-11/gunluk")}
        />
        <MenuCard title={t("practice")} subtitle={t("practiceDesc")} emoji="🎯" color={C.emerald} onPress={() => router.push({ pathname: "/eksik-11/pratik", params: { havuz: "global" } })} />
        <MenuCard title={t("turkishTeams")} subtitle={t("turkishDesc")} emoji="🇹🇷" color={C.rose} onPress={() => router.push({ pathname: "/eksik-11/pratik", params: { havuz: "turkiye" } })} />
        <MenuCard title={t("onlineRace")} subtitle={t("raceDesc")} emoji="🏁" color="#d97706" onPress={() => router.push("/eksik-11/oda")} />
      </View>
      <HowToPlaySheet visible={help} onClose={() => setHelp(false)} />
      <StatsSheet stats={stats} visible={statsOpen} onClose={() => setStatsOpen(false)} />
    </Screen>
  );
}
