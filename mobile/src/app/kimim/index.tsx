import { router } from "expo-router";

import { GameHub } from "~/components/GameHub";
import { WhoAmISteps } from "~/components/HowTo";
import { BRAND } from "~/lib/brand";
import { useI18n } from "~/lib/i18n";
import { GAME } from "~/lib/theme";

/** Who Am I?: one big Find opponent; a friend room below. */
export default function WhoAmIHome() {
  const { t } = useI18n();
  return (
    <GameHub
      title={t("wmName")}
      image={BRAND.icon.mystery}
      bg={GAME.wm.bg}
      tagline={t("wmShort")}
      primary={{ label: t("playFind"), icon: "play.fill", fallback: "▶", onPress: () => router.push("/kimim/rastgele") }}
      secondary={[{ label: t("htFriend"), icon: "person.2.fill", fallback: "👥", onPress: () => router.push("/kimim/oda") }]}
      rules={<WhoAmISteps />}
    />
  );
}
