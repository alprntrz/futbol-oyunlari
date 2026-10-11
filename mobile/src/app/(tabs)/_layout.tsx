import { NativeTabs } from "expo-router/unstable-native-tabs";

import { BRAND } from "~/lib/brand";
import { useI18n } from "~/lib/i18n";
import { C } from "~/lib/theme";

export default function TabsLayout() {
  const { t } = useI18n();
  return (
    <NativeTabs tintColor={C.greenMid}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t("tabHome")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="oyunlar">
        <NativeTabs.Trigger.Label>{t("tabGames")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={BRAND.tab.games} renderingMode="template" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="istatistik">
        <NativeTabs.Trigger.Label>{t("tabProfile")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="ayarlar">
        <NativeTabs.Trigger.Label>{t("tabSettings")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={BRAND.tab.settings} renderingMode="template" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
