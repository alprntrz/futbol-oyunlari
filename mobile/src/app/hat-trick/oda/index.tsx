import { useState } from "react";

import { LEAGUES, type LeagueId } from "@/lib/leagues";

import { LeaguePicker } from "~/components/LeaguePicker";
import { OnlineLobby } from "~/components/OnlineLobby";
import { Text } from "~/components/Text";
import { Segmented } from "~/components/ui";
import { gridToIds } from "~/lib/hattrick";
import { useI18n } from "~/lib/i18n";
import { dealGrid, useHtLeague } from "~/lib/league";
import { T } from "~/lib/theme";

export default function HatTrickLobby() {
  const { t } = useI18n();
  const [steals, setSteals] = useState(false);
  const [league, setLeague] = useHtLeague();
  return (
    <OnlineLobby
      game="ht"
      title={t("tikiTakaName")}
      createPayload={() => ({ grid: gridToIds(dealGrid(league)), steals, league })}
      roomHref={(code) => ({ pathname: "/hat-trick/oda/[code]", params: { code } })}
      createOptions={
        <>
          {/* the room's league: opened from Home this screen is the only place to pick it */}
          <LeaguePicker items={LEAGUES} value={league} onChange={(id) => setLeague(id as LeagueId)} />
          <Segmented
            value={steals ? "on" : "off"}
            onChange={(v) => setSteals(v === "on")}
            options={[
              { value: "off", label: t("htClassic") },
              { value: "on", label: t("htSteals") },
            ]}
          />
          {steals && <Text style={T.caption}>{t("htStealsDesc")}</Text>}
        </>
      }
    />
  );
}
