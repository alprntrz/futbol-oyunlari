import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { RONDO_PAIR_TARGET } from "@/lib/rondo";

import { ChoiceSheet, GameHub, HubSetting } from "~/components/GameHub";
import { RondoPairSteps, RondoSteps } from "~/components/HowTo";
import { RONDO } from "~/lib/brand";
import { useI18n } from "~/lib/i18n";
import { useRondoMode } from "~/lib/rondoMode";
import { GAME } from "~/lib/theme";

/** Rondo: one big Find opponent; a friend room below; the mode (one club in turns, or the two-club race) as a setting. */
export default function RondoHome() {
  const { t } = useI18n();
  const [mode, setMode] = useRondoMode();
  const [picking, setPicking] = useState(false);
  const pair = mode === "pair";
  return (
    <>
      <GameHub
        title="Rondo"
        image={RONDO.hero}
        bg={GAME.rd.bg}
        tagline={pair ? t("rdPairShort") : t("rdShort")}
        primary={{ label: t("playFind"), icon: "play.fill", fallback: "▶", onPress: () => router.push({ pathname: "/rondo/rastgele", params: { mode } }) }}
        secondary={[{ label: t("htFriend"), icon: "person.2.fill", fallback: "👥", onPress: () => router.push({ pathname: "/rondo/oda", params: { mode } }) }]}
        settings={<HubSetting label={t("rdMode")} value={pair ? t("rdModePair") : t("rdModeClub")} onPress={() => setPicking(true)} />}
        rules={
          <View style={{ gap: 20 }}>
            <RondoSteps />
            <RondoPairSteps target={RONDO_PAIR_TARGET} />
          </View>
        }
      />
      <ChoiceSheet
        visible={picking}
        title={t("rdMode")}
        value={mode}
        onPick={setMode}
        onClose={() => setPicking(false)}
        options={[
          { value: "club", label: t("rdModeClub"), hint: t("rdModeClubHint") },
          { value: "pair", label: t("rdModePair"), hint: t("rdModePairHint") },
        ]}
      />
    </>
  );
}
