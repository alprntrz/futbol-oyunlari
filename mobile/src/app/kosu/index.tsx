import { router } from "expo-router";
import { useState } from "react";

import { ALL_CRITERIA } from "@/lib/tiki";

import { ChoiceSheet, GameHub, HubSetting } from "~/components/GameHub";
import { ClubShirt } from "~/components/HatTrickBoard";
import { Text } from "~/components/Text";
import { KOSU } from "~/lib/brand";
import { useI18n } from "~/lib/i18n";
import { useFavClub, useRushBest } from "~/lib/kosu";
import { GAME, T } from "~/lib/theme";

const CLUBS = ALL_CRITERIA.filter((c) => c.kind === "club");

/** Dribbling Rush: one big Play; your club (the runner's kit) as a setting; the best score. */
export default function RushHome() {
  const { t, locale } = useI18n();
  const [club, setClub] = useFavClub();
  const best = useRushBest();
  const [picking, setPicking] = useState(false);
  const name = (id: string) => {
    const c = CLUBS.find((x) => x.id === id);
    return c ? (locale === "tr" ? c.tr : c.en) : id;
  };
  return (
    <GameHub
      title="Dribbling Rush"
      image={KOSU.hero}
      bg={GAME.rush.bg}
      tagline={t("rushShort")}
      primary={{ label: t("rushPlay"), icon: "play.fill", fallback: "▶", onPress: () => router.push("/kosu/oyun") }}
      secondary={[]}
      settings={<HubSetting label={t("rushClub")} value={name(club)} onPress={() => setPicking(true)} />}
    >
      <ChoiceSheet
        visible={picking}
        title={t("rushClub")}
        value={club}
        options={CLUBS.map((c) => ({ value: c.id, label: locale === "tr" ? c.tr : c.en, left: <ClubShirt c={c} size={30} /> }))}
        onPick={setClub}
        onClose={() => setPicking(false)}
      />
      {best > 0 && <Text style={[T.headline, { textAlign: "center", marginTop: 16 }]}>{t("rushBest").replace("{n}", String(best))}</Text>}
    </GameHub>
  );
}
