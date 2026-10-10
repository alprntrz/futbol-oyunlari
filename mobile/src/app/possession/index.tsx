import { Stack } from "expo-router";
import { View } from "react-native";

import { ModeList, type Mode } from "~/components/ModeGrid";
import { Text } from "~/components/Text";
import { Card, Icon, Page, SectionLabel } from "~/components/ui";
import { useI18n } from "~/lib/i18n";
import { C, T } from "~/lib/theme";

/** Possession Play hub: friend online, random opponent, same screen. */
export default function PossessionHome() {
  const { t } = useI18n();
  const modes: Mode[] = [
    {
      icon: "person.2.fill",
      fallback: "👥",
      title: t("htFriend"),
      desc: t("htFriendDesc"),
      href: "/possession/oda",
      color: C.greenMid,
      soft: C.greenSoft,
    },
    {
      icon: "antenna.radiowaves.left.and.right",
      fallback: "📡",
      title: t("htRandom"),
      desc: t("htRandomDesc"),
      href: "/possession/rastgele",
      color: C.blue,
      soft: C.blueSoft,
    },
    {
      icon: "iphone",
      fallback: "📱",
      title: t("htSame"),
      desc: t("ppSameDesc"),
      href: "/possession/yerel",
      color: C.coral,
      soft: C.coralSoft,
    },
  ];

  return (
    <Page>
      <Stack.Screen options={{ title: t("ppName") }} />
      <Text style={T.title}>{t("ppName")}</Text>
      <Text style={[T.body, { marginTop: 4 }]}>{t("ppTagline")}</Text>

      <SectionLabel>{t("htModes")}</SectionLabel>
      <ModeList modes={modes} />

      <SectionLabel>{t("howToPlay")}</SectionLabel>
      <Card style={{ gap: 12 }}>
        {[t("ppRule1"), t("ppRule2")].map((r) => (
          <View key={r} style={{ flexDirection: "row", gap: 10 }}>
            <Icon name="hexagon.fill" size={16} color={C.greenMid} fallback="⬢" />
            <Text style={[T.body, { flex: 1 }]}>{r}</Text>
          </View>
        ))}
      </Card>
    </Page>
  );
}
