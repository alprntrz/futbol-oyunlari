import { router, Stack } from "expo-router";
import { View } from "react-native";

import { HelpButton } from "~/components/HelpButton";
import { TikiSteps } from "~/components/HowTo";
import { Text } from "~/components/Text";
import { Card, Page, Row, SectionLabel } from "~/components/ui";
import { useI18n } from "~/lib/i18n";
import { C, T } from "~/lib/theme";

/** Hat-trick hub: pick same-phone or online play. */
export default function HatTrickHome() {
  const { t } = useI18n();
  return (
    <Page>
      <Stack.Screen options={{ title: t("tikiTakaName"), headerRight: () => <HelpButton game="tiki" /> }} />
      <Text style={T.title}>{t("tikiTakaName")}</Text>
      <Text style={[T.body, { marginTop: 4 }]}>{t("tikiTakaTagline")}</Text>

      <SectionLabel>{t("htModes")}</SectionLabel>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <Row
          icon="iphone"
          iconFallback="📱"
          color={C.blue}
          soft={C.blueSoft}
          title={t("htLocal")}
          subtitle={t("htLocalDesc")}
          onPress={() => router.push("/hat-trick/yerel")}
        />
        <Row
          icon="wifi"
          iconFallback="🌐"
          color={C.greenMid}
          soft={C.greenSoft}
          title={t("htOnline")}
          subtitle={t("htOnlineDesc")}
          onPress={() => router.push("/hat-trick/oda")}
          last
        />
      </Card>

      <SectionLabel>{t("howToPlay")}</SectionLabel>
      <Card style={{ padding: 20 }}>
        <View>
          <TikiSteps />
        </View>
      </Card>
    </Page>
  );
}
