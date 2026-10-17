import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Image } from "react-native";

import { COACHES } from "@/lib/taktik/engine";
import type { CoachId } from "@/lib/taktik/types";

import { ChoiceSheet, GameHub, HubSetting } from "~/components/GameHub";
import { TaktikSteps } from "~/components/HowTo";
import { TAKTIK } from "~/lib/brand";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { GAME } from "~/lib/theme";
import { rejoinLeft, startTaktik, useTaktik } from "~/lib/taktik";

/**
 * Pitch Chess: one big Start; the manager style is a setting with a default; rules behind "?".
 * No "continue later": just after leaving a lobby there's a minute to get back in (counting down), then it's gone.
 */
export default function TaktikHome() {
  const { t } = useI18n();
  const { version } = useTaktik();
  const [coach, setCoach] = useState<CoachId>("pass");
  const [picking, setPicking] = useState(false);
  const [left, setLeft] = useState(rejoinLeft);
  const ongoing = left > 0;
  // re-read once the saved game has loaded (or changed), then count down every second while a seat is held
  // (an expired game is dropped by lib/taktik on the next load or by the game screen; here it just stops showing)
  useEffect(() => {
    const read = () => {
      const ms = rejoinLeft();
      setLeft(ms);
      return ms;
    };
    if (read() <= 0) return;
    const id = setInterval(read, 1000);
    return () => clearInterval(id);
  }, [version]);

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
          ? { label: t("ttkRejoin").replace("{s}", String(Math.ceil(left / 1000))), icon: "arrow.uturn.left", fallback: "↩", onPress: () => router.push("/taktik/oyun") }
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
