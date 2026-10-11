import { Stack } from "expo-router";
import { Rule } from "~/components/HowTo";
import { ModeList, type Mode } from "~/components/ModeGrid";
import { Text } from "~/components/Text";
import { Card, Page, SectionLabel } from "~/components/ui";
import { BRAND } from "~/lib/brand";
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
      image: BRAND.mode.friend,
      color: C.greenMid,
      soft: C.greenSoft,
    },
    {
      icon: "antenna.radiowaves.left.and.right",
      fallback: "📡",
      title: t("htRandom"),
      desc: t("htRandomDesc"),
      href: "/possession/rastgele",
      image: BRAND.mode.random,
      color: C.blue,
      soft: C.blueSoft,
    },
    {
      icon: "iphone",
      fallback: "📱",
      title: t("htSame"),
      desc: t("ppSameDesc"),
      href: "/possession/yerel",
      image: BRAND.mode.same,
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
      <Card style={{ gap: 14 }}>
        <Rule image={BRAND.how.clock} desc={t("ppRule1")} />
        <Rule image={BRAND.how.hexes} desc={t("ppRule2")} />
      </Card>
    </Page>
  );
}
