import { router, Stack } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { teamsWithMatches, type Team } from "@/lib/teams";
import { normalizeAnswer } from "@/lib/wordle";

import { Text } from "~/components/Text";
import { Card, Icon, Page, SectionLabel, Tap } from "~/components/ui";
import { useI18n } from "~/lib/i18n";
import { C, R, T } from "~/lib/theme";

/** Searchable list of every team with enough matches; tap → practice with that team. */
export default function TeamPicker() {
  const { t, locale } = useI18n();
  const teams = useMemo(() => teamsWithMatches(3), []);
  const [query, setQuery] = useState("");

  const label = (team: Team) => (locale === "en" ? team.en : team.name);
  const q = normalizeAnswer(query);
  const shown = q ? teams.filter((tm) => normalizeAnswer(tm.name).includes(q) || normalizeAnswer(tm.en).includes(q)) : teams;
  const clubs = shown.filter((tm) => !tm.national);
  const nations = shown.filter((tm) => tm.national);

  const open = (team: Team) => router.push({ pathname: "/eksik-11/pratik", params: { takim: team.name } });

  const list = (items: Team[]) => (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      {items.map((team, i) => (
        <Tap key={team.name} onPress={() => open(team)} style={[styles.row, i > 0 && styles.divider]}>
          <View style={[styles.swatch, { backgroundColor: team.kit.body }]}>
            <View style={[styles.swatchSleeve, { backgroundColor: team.kit.sleeves }]} />
          </View>
          <Text style={[T.headline, { flex: 1 }]} numberOfLines={1}>
            {label(team)}
          </Text>
          <Text style={T.caption}>
            {team.matches.length} {t("matchesWord")}
          </Text>
          <Icon name="chevron.right" size={13} color={C.text3} fallback="›" />
        </Tap>
      ))}
    </Card>
  );

  return (
    <Page>
      <Stack.Screen options={{ title: t("byTeam") }} />
      <Text style={[T.body, { marginBottom: 12 }]}>{t("byTeamDesc")}</Text>
      <View style={styles.search}>
        <Icon name="magnifyingglass" size={16} color={C.text3} fallback="🔎" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("searchTeam")}
          placeholderTextColor={C.text3}
          autoCorrect={false}
          clearButtonMode="while-editing"
          style={styles.searchInput}
        />
      </View>

      {clubs.length > 0 && (
        <>
          <SectionLabel>{t("clubs")}</SectionLabel>
          {list(clubs)}
        </>
      )}
      {nations.length > 0 && (
        <>
          <SectionLabel>{t("nationalTeams")}</SectionLabel>
          {list(nations)}
        </>
      )}
      {shown.length === 0 && <Text style={[T.body, { textAlign: "center", marginTop: 32 }]}>{t("noMatches")}</Text>}
    </Page>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.card, borderRadius: R.button, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 16, color: C.text },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  swatch: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", overflow: "hidden", justifyContent: "flex-end" },
  swatchSleeve: { height: 9 },
});
