import { router, Stack } from "expo-router";
import { StyleSheet } from "react-native";

import { Text } from "~/components/Text";
import { Card, Page, Row } from "~/components/ui";
import { BRAND } from "~/lib/brand";
import { useI18n } from "~/lib/i18n";
import { T } from "~/lib/theme";

/** Missing 11 hub: unlimited practice or a chosen team's matches (the daily one is on the Games tab). */
export default function MissingXIHome() {
  const { t } = useI18n();
  return (
    <Page>
      <Stack.Screen options={{ title: t("missingXI") }} />
      <Text style={T.title}>{t("missingXI")}</Text>
      <Text style={[T.body, { marginTop: 4 }]}>{t("xiHubDesc")}</Text>
      <Card style={styles.list}>
        <Row image={BRAND.icon.practice} title={t("practice")} subtitle={t("practiceDesc")} onPress={() => router.push("/eksik-11/pratik")} />
        <Row image={BRAND.icon.team} title={t("byTeam")} subtitle={t("byTeamDesc")} last onPress={() => router.push("/eksik-11/takimlar")} />
      </Card>
    </Page>
  );
}

const styles = StyleSheet.create({ list: { marginTop: 16, padding: 0, overflow: "hidden" } });
