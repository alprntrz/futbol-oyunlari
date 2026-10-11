import { OnlineLobby } from "~/components/OnlineLobby";
import { useI18n } from "~/lib/i18n";
import { boardToIds, generateBoard } from "~/lib/possession";

export default function PossessionLobby() {
  const { t } = useI18n();
  return (
    <OnlineLobby
      game="pp"
      title={t("ppName")}
      createPayload={() => ({ board: boardToIds(generateBoard()) })}
      roomHref={(code) => ({ pathname: "/possession/oda/[code]", params: { code } })}
    />
  );
}
