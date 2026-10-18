import { router } from "expo-router";

import { GameHub } from "~/components/GameHub";
import { RondoSteps } from "~/components/HowTo";
import { RONDO } from "~/lib/brand";
import { useI18n } from "~/lib/i18n";
import { GAME } from "~/lib/theme";

/** Rondo: one big Find opponent; a friend room below. */
export default function RondoHome() {
  const { t } = useI18n();
  return (
    <GameHub
      title="Rondo"
      image={RONDO.icon}
      bg={GAME.rd.bg}
      tagline={t("rdShort")}
      primary={{ label: t("playFind"), icon: "play.fill", fallback: "▶", onPress: () => router.push("/rondo/rastgele") }}
      secondary={[{ label: t("htFriend"), icon: "person.2.fill", fallback: "👥", onPress: () => router.push("/rondo/oda") }]}
      rules={<RondoSteps />}
    />
  );
}
