import { Stack } from "expo-router";

import { HelpButton } from "~/components/HelpButton";
import { TikiSteps } from "~/components/HowTo";
import { ModeGrid, type Mode } from "~/components/ModeGrid";
import { Text } from "~/components/Text";
import { Card, Page, SectionLabel } from "~/components/ui";
import { useI18n } from "~/lib/i18n";
import { C, T } from "~/lib/theme";

/** Hat-trick hub: four ways to play. */
export default function HatTrickHome() {
  const { t } = useI18n();
  const modes: Mode[] = [
    {
      icon: "person.2.fill",
      fallback: "👥",
      title: t("htFriend"),
      desc: t("htFriendDesc"),
      href: "/hat-trick/oda",
      color: C.greenMid,
      soft: C.greenSoft,
    },
    {
      icon: "antenna.radiowaves.left.and.right",
      fallback: "📡",
      title: t("htRandom"),
      desc: t("htRandomDesc"),
      href: "/hat-trick/rastgele",
      color: C.blue,
      soft: C.blueSoft,
    },
    {
      icon: "iphone",
      fallback: "📱",
      title: t("htSame"),
      desc: t("htSameDesc"),
      href: "/hat-trick/yerel",
      color: C.coral,
      soft: C.coralSoft,
    },
    {
      icon: "person.fill",
      fallback: "👤",
      title: t("htSolo"),
      desc: t("htSoloDesc"),
      href: "/hat-trick/tek",
      color: "#B7791F",
      soft: C.amberSoft,
    },
  ];

  return (
    <Page>
      <Stack.Screen
        options={{
          title: t("tikiTakaName"),
          headerRight: () => <HelpButton game="tiki" />,
        }}
      />
      <Text style={T.title}>{t("tikiTakaName")}</Text>
      <Text style={[T.body, { marginTop: 4 }]}>{t("tikiTakaTagline")}</Text>

      <SectionLabel>{t("htModes")}</SectionLabel>
      <ModeGrid modes={modes} />

      <SectionLabel>{t("howToPlay")}</SectionLabel>
      <Card style={{ padding: 20 }}>
        <TikiSteps />
      </Card>
    </Page>
  );
}
