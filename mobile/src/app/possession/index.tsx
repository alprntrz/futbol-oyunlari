import { router } from "expo-router";
import { View } from "react-native";

import { GameHub } from "~/components/GameHub";
import { Rule } from "~/components/HowTo";
import { BRAND } from "~/lib/brand";
import { useI18n } from "~/lib/i18n";

/** Possession Play: one big Find opponent; friend / same phone below. */
export default function PossessionHome() {
  const { t } = useI18n();
  return (
    <GameHub
      title={t("ppName")}
      image={BRAND.icon.possession}
      bg="#DCFCE7"
      tagline={t("ppShort")}
      primary={{ label: t("playFind"), icon: "play.fill", fallback: "▶", onPress: () => router.push("/possession/rastgele") }}
      secondary={[
        { label: t("htFriend"), icon: "person.2.fill", fallback: "👥", onPress: () => router.push("/possession/oda") },
        { label: t("htSame"), icon: "iphone", fallback: "📱", onPress: () => router.push("/possession/yerel") },
      ]}
      rules={
        <View style={{ gap: 14 }}>
          <Rule image={BRAND.how.clock} desc={t("ppRule1")} />
          <Rule image={BRAND.how.hexes} desc={t("ppRule2")} />
        </View>
      }
    />
  );
}
