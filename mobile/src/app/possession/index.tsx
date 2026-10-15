import { router } from "expo-router";

import { GameHub } from "~/components/GameHub";
import { PossessionSteps } from "~/components/HowTo";
import { BRAND } from "~/lib/brand";
import { useI18n } from "~/lib/i18n";
import { GAME } from "~/lib/theme";

/** Possession Play: one big Find opponent; friend / same phone below. */
export default function PossessionHome() {
  const { t } = useI18n();
  return (
    <GameHub
      title={t("ppName")}
      image={BRAND.icon.possession}
      bg={GAME.pp.bg}
      tagline={t("ppShort")}
      primary={{ label: t("playFind"), icon: "play.fill", fallback: "▶", onPress: () => router.push("/possession/rastgele") }}
      secondary={[
        { label: t("htFriend"), icon: "person.2.fill", fallback: "👥", onPress: () => router.push("/possession/oda") },
        { label: t("htSame"), icon: "iphone", fallback: "📱", onPress: () => router.push("/possession/yerel") },
      ]}
      rules={<PossessionSteps />}
    />
  );
}
