import Constants from "expo-constants";
import { useState } from "react";
import { Text, View } from "react-native";

import { InfoSheet, MissingXISteps, TikiSteps } from "~/components/HowTo";
import { Card, Page, Row, SectionLabel, Segmented } from "~/components/ui";
import { BRAND } from "~/lib/brand";
import { useI18n } from "~/lib/i18n";
import { C, T } from "~/lib/theme";

export default function SettingsTab() {
  const { t, locale, setLocale } = useI18n();
  const [sheet, setSheet] = useState<"xi" | "tiki" | null>(null);

  return (
    <Page topInset>
      <Text style={T.largeTitle}>{t("tabSettings")}</Text>

      <SectionLabel>{t("settingsLanguage")}</SectionLabel>
      <Segmented
        value={locale}
        onChange={setLocale}
        options={[
          { value: "tr", label: "Türkçe" },
          { value: "en", label: "English" },
        ]}
      />

      <SectionLabel>{t("howToPlay")}</SectionLabel>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <Row image={BRAND.icon.team} title={t("missingXI")} onPress={() => setSheet("xi")} />
        <Row image={BRAND.icon.tiki} title={t("tikiTakaName")} onPress={() => setSheet("tiki")} last />
      </Card>

      <SectionLabel>{t("about")}</SectionLabel>
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={[T.body, { color: C.text }]}>{t("version")}</Text>
          <Text style={T.body}>{Constants.expoConfig?.version ?? "1.0.0"}</Text>
        </View>
      </Card>

      <InfoSheet visible={sheet === "xi"} onClose={() => setSheet(null)} title={t("missingXI")}>
        <MissingXISteps />
      </InfoSheet>
      <InfoSheet visible={sheet === "tiki"} onClose={() => setSheet(null)} title={t("tikiTakaName")}>
        <TikiSteps />
      </InfoSheet>
    </Page>
  );
}
