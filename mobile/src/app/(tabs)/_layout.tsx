import { NativeTabs } from "expo-router/unstable-native-tabs";

import { BRAND } from "~/lib/brand";
import { useI18n } from "~/lib/i18n";
import { C } from "~/lib/theme";

/** Five tabs with our own 3D icons: shown in colour when selected, grey otherwise ("original", not tinted). */
export default function TabsLayout() {
  const { t } = useI18n();
  return (
    <NativeTabs tintColor={C.greenMid}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t("tabHome")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={BRAND.tab.home} renderingMode="original" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="oyunlar">
        <NativeTabs.Trigger.Label>{t("tabGames")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={BRAND.tab.games} renderingMode="original" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="lig">
        <NativeTabs.Trigger.Label>{t("tabLeague")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={BRAND.tab.league} renderingMode="original" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="istatistik">
        <NativeTabs.Trigger.Label>{t("tabProfile")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={BRAND.tab.profile} renderingMode="original" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="ayarlar">
        <NativeTabs.Trigger.Label>{t("tabSettings")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={BRAND.tab.settings} renderingMode="original" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
