import { NativeTabs } from "expo-router/unstable-native-tabs";

import { useI18n } from "~/lib/i18n";
import { C } from "~/lib/theme";

export default function TabsLayout() {
  const { t } = useI18n();
  return (
    <NativeTabs tintColor={C.green}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t("tabGames")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="soccerball" md="sports_soccer" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="istatistik">
        <NativeTabs.Trigger.Label>{t("tabStats")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.bar.fill" md="bar_chart" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="ayarlar">
        <NativeTabs.Trigger.Label>{t("tabSettings")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape.fill" md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
