import { router, Stack } from "expo-router";
import { StyleSheet, View } from "react-native";

import { XI_CATEGORIES } from "@/lib/leagues";

import { LeagueBadge } from "~/components/LeaguePicker";
import { Text } from "~/components/Text";
import { Card, Icon, Page, Row, SectionLabel, Tap } from "~/components/ui";
import { BRAND } from "~/lib/brand";
import { useI18n } from "~/lib/i18n";
import { C, T } from "~/lib/theme";

/** Missing 11 hub: practice from every match or one category, or pick a team. */
export default function MissingXIHome() {
  const { t, locale } = useI18n();
  return (
    <Page>
      <Stack.Screen options={{ title: t("missingXI") }} />
      <Text style={T.body}>{t("xiHubDesc")}</Text>

      <SectionLabel>{t("xiCategories")}</SectionLabel>
      <Card style={styles.list}>
        {XI_CATEGORIES.map((c, i) => (
          <Tap
            key={c.id}
            onPress={() => router.push({ pathname: "/eksik-11/pratik", params: { kategori: c.id } })}
            style={[styles.row, i > 0 && styles.divider]}
            accessibilityLabel={c.name[locale]}
          >
            <LeagueBadge item={c} />
            <View style={{ flex: 1 }}>
              <Text style={T.headline}>{c.name[locale]}</Text>
              <Text style={T.caption}>
                {c.matches().length} {t("matchesWord")}
              </Text>
            </View>
            <Icon name="chevron.right" size={13} color={C.text3} fallback="›" />
          </Tap>
        ))}
      </Card>

      <SectionLabel>{t("byTeam")}</SectionLabel>
      <Card style={styles.list}>
        <Row image={BRAND.icon.team} title={t("byTeam")} subtitle={t("byTeamDesc")} onPress={() => router.push("/eksik-11/takimlar")} last />
      </Card>
    </Page>
  );
}

const styles = StyleSheet.create({
  list: { padding: 0, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 11 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
});
