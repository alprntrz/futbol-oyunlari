import { useState } from "react";

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
  const [league] = useHtLeague();
  return (
    <OnlineLobby
      game="ht"
      title={t("tikiTakaName")}
      createPayload={() => ({ grid: gridToIds(dealGrid(league)), steals, league })}
      roomHref={(code) => ({ pathname: "/hat-trick/oda/[code]", params: { code } })}
      createOptions={
        <>
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
