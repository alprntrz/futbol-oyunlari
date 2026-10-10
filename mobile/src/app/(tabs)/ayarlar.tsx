import Constants from "expo-constants";
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { InfoSheet, MissingXISteps, TikiSteps } from "~/components/HowTo";
import { Text } from "~/components/Text";
import { Card, Page, Row, SectionLabel, Segmented } from "~/components/ui";
import { BRAND } from "~/lib/brand";
import { ONBOARDING } from "~/lib/features";
import { useI18n } from "~/lib/i18n";
import { play, setSoundsOn, soundsOn } from "~/lib/sound";
import { C, T } from "~/lib/theme";

export default function SettingsTab() {
  const { t, locale, setLocale } = useI18n();
  const [sheet, setSheet] = useState<"xi" | "tiki" | null>(null);
  const [sound, setSound] = useState(soundsOn() ? "on" : "off");

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

      <SectionLabel>{t("settingsSound")}</SectionLabel>
      <Segmented
        value={sound}
        onChange={(v) => {
          setSound(v);
          setSoundsOn(v === "on");
          if (v === "on") play("coin");
        }}
        options={[
          { value: "on", label: t("soundOn") },
          { value: "off", label: t("soundOff") },
        ]}
      />

      <SectionLabel>{t("howToPlay")}</SectionLabel>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <Row image={BRAND.icon.team} title={t("missingXI")} onPress={() => setSheet("xi")} />
        <Row image={BRAND.icon.tiki} title={t("tikiTakaName")} onPress={() => setSheet("tiki")} last={!ONBOARDING} />
        {ONBOARDING && <Row icon="sparkles" iconFallback="✨" color={C.greenMid} soft={C.greenSoft} title={t("obReplay")} onPress={() => router.push("/onboarding")} last />}
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
