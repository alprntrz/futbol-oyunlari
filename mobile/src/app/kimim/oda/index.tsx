import { OnlineLobby } from "~/components/OnlineLobby";
import { useI18n } from "~/lib/i18n";

/** Who Am I? with a friend: open a room (the server picks the hidden player) or join by code. */
export default function WhoAmILobby() {
  const { t } = useI18n();
  return <OnlineLobby game="wm" title={t("wmName")} createPayload={() => ({})} roomHref={(code) => ({ pathname: "/kimim/oda/[code]", params: { code } })} />;
}
