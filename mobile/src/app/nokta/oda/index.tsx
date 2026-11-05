import { OnlineLobby } from "~/components/OnlineLobby";
import { useI18n } from "~/lib/i18n";

/** The Spot with a friend: open a room or join by code. */
export default function SpotLobby() {
  const { t } = useI18n();
  return <OnlineLobby game="sp" title={t("spName")} createPayload={() => ({})} roomHref={(code) => ({ pathname: "/nokta/oda/[code]", params: { code } })} />;
}
