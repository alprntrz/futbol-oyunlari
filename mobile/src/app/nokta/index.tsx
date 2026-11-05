import { router } from "expo-router";

import { GameHub } from "~/components/GameHub";
import { SpotSteps } from "~/components/HowTo";
import { NOKTA } from "~/lib/brand";
import { useI18n } from "~/lib/i18n";
import { GAME } from "~/lib/theme";

/** The Spot: one big Find opponent; a friend room below. */
export default function SpotHome() {
  const { t } = useI18n();
  return (
    <GameHub
      title={t("spName")}
      image={NOKTA.hero}
      bg={GAME.sp.bg}
      tagline={t("spShort")}
      primary={{ label: t("playFind"), icon: "play.fill", fallback: "▶", onPress: () => router.push("/nokta/rastgele") }}
      secondary={[{ label: t("htFriend"), icon: "person.2.fill", fallback: "👥", onPress: () => router.push("/nokta/oda") }]}
      rules={<SpotSteps />}
    />
  );
}
