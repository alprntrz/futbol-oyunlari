import { router } from "expo-router";
import { useState } from "react";
import { Image } from "react-native";

import { COACHES } from "@/lib/taktik/engine";
import type { CoachId } from "@/lib/taktik/types";

import { ChoiceSheet, GameHub, HubSetting } from "~/components/GameHub";
import { TaktikSteps } from "~/components/HowTo";
import { TAKTIK } from "~/lib/brand";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { GAME } from "~/lib/theme";
import { startTaktik, useTaktik } from "~/lib/taktik";

/** Pitch Chess: one big Start (or Continue); the manager style is a setting with a default; rules behind "?". */
export default function TaktikHome() {
  const { t } = useI18n();
  const { lobby } = useTaktik();
  const [coach, setCoach] = useState<CoachId>("pass");
  const [picking, setPicking] = useState(false);
  const ongoing = !!lobby && !lobby.over && lobby.managers[0].place === null;

  const start = async () => {
    haptic.success();
    await startTaktik(coach);
    router.push("/taktik/oyun");
  };

  return (
    <GameHub
      title={t("ttkName")}
      image={TAKTIK.hero}
      bg={GAME.tt.bg}
      tagline={t("ttkShort")}
      primary={
        ongoing
          ? { label: t("ttkResume"), icon: "play.fill", fallback: "▶", onPress: () => router.push("/taktik/oyun") }
          : { label: t("ttkStart"), icon: "play.fill", fallback: "▶", onPress: start }
      }
      secondary={ongoing ? [{ label: t("ttkNewGame"), icon: "arrow.clockwise", fallback: "↻", onPress: start }] : []}
      settings={<HubSetting label={t("ttkCoachShort")} value={t(`ttkCoach_${coach}`)} onPress={() => setPicking(true)} />}
      rules={<TaktikSteps />}
    >
      <ChoiceSheet
        visible={picking}
        title={t("ttkPickCoach")}
        value={coach}
        options={COACHES.map((c) => ({ value: c, label: t(`ttkCoach_${c}`), hint: t(`ttkCoachD_${c}`), left: <Image source={TAKTIK.coach[c]} style={{ width: 44, height: 44 }} /> }))}
        onPick={setCoach}
        onClose={() => setPicking(false)}
      />
    </GameHub>
  );
}
