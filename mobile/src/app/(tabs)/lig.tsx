import { useState } from "react";
import { StyleSheet } from "react-native";

import { Text } from "~/components/Text";
import { Page, Segmented } from "~/components/ui";
import { useI18n } from "~/lib/i18n";
import { C, F } from "~/lib/theme";

import { LeagueBody } from "../lig";
import { LeaderboardsBody } from "../siralamalar";

/** League tab: this week's league race first, the all-time boards next to it. */
export default function LeagueTab() {
  const { t } = useI18n();
  const [view, setView] = useState<"week" | "all">("week");
  return (
    <Page topInset>
      <Text style={styles.title}>{t("tabLeague")}</Text>
      <Segmented
        value={view}
        onChange={setView}
        options={[
          { value: "week", label: t("lgWeekly") },
          { value: "all", label: t("lgAllTime") },
        ]}
      />
      {view === "week" ? <LeagueBody /> : <LeaderboardsBody />}
    </Page>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: F.display, fontSize: 34, lineHeight: 36, color: C.text, marginTop: 2, marginBottom: 12 },
});
