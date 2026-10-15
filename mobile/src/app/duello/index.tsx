import { router, Stack } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";

import { cardById } from "@/lib/duel";

import { DuelCardView } from "~/components/duel/DuelCardView";
import { Text } from "~/components/Text";
import { Button, Card, Icon, Page, SectionLabel } from "~/components/ui";
import { useDuel } from "~/lib/duel";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { C, F, T } from "~/lib/theme";

/** Card Duel home: today's theme, my hand, and the ways to play. */
export default function DuelHome() {
  const { t } = useI18n();
  const { hand, theme, ready, daily } = useDuel();
  const go = (href: Parameters<typeof router.push>[0]) => {
    haptic.tap();
    router.push(href);
  };

  return (
    <Page>
      <Stack.Screen options={{ title: t("dzName") }} />
      <Text style={T.title}>{t("dzName")}</Text>
      <Text style={[T.body, { marginTop: 6 }]}>{t("dzIntro")}</Text>

      <Card style={styles.theme}>
        <Icon name="flag.checkered" size={20} color={C.greenDark} fallback="🏁" />
        <View style={{ flex: 1 }}>
          <Text style={T.caption}>{t("dzTheme")}</Text>
          <Text style={styles.themeText}>{t(`dzTheme_${theme.id}`)}</Text>
        </View>
      </Card>

      <SectionLabel>{t("dzHand")}</SectionLabel>
      {ready ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 6 }}>
          {hand.map((id) => (
            <DuelCardView key={id} card={cardById(id) ?? null} width={78} />
          ))}
        </ScrollView>
      ) : (
        <Text style={T.body}>{t("dzNoHand")}</Text>
      )}
      <Button title={t(ready ? "dzRedraft" : "dzDraft")} icon="square.stack.fill" kind={ready ? "secondary" : "primary"} onPress={() => go("/duello/draft")} style={{ marginTop: 10 }} />

      {ready && (
        <View style={{ gap: 10, marginTop: 18 }}>
          <Button title={t("dzPlayRandom")} icon="person.2.fill" onPress={() => go("/duello/rastgele")} />
          <Button
            title={daily ? t("dzDailyDone").replace("{a}", String(daily.mine)).replace("{b}", String(daily.theirs)) : t("dzDaily")}
            icon="calendar"
            kind="gold"
            disabled={!!daily}
            onPress={() => go({ pathname: "/duello/mac", params: { mode: "daily" } })}
          />
          <Button title={t("dzPractice")} icon="figure.run" kind="secondary" onPress={() => go({ pathname: "/duello/mac", params: { mode: "practice" } })} />
        </View>
      )}

      <Card style={{ marginTop: 22, gap: 10 }}>
        {(["dzRule1", "dzRule2", "dzRule3", "dzRule4"] as const).map((k, i) => (
          <View key={k} style={styles.rule}>
            <View style={styles.ruleNum}>
              <Text style={styles.ruleNumText}>{i + 1}</Text>
            </View>
            <Text style={[T.body, { flex: 1 }]}>{t(k)}</Text>
          </View>
        ))}
      </Card>
      <Text style={[T.caption, { marginTop: 10 }]}>{t("dzDataNote")}</Text>
    </Page>
  );
}

const styles = StyleSheet.create({
  theme: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16 },
  themeText: { fontFamily: F.display, fontSize: 20, color: C.text },
  rule: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  ruleNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.greenSoft, alignItems: "center", justifyContent: "center" },
  ruleNumText: { fontFamily: F.display, fontSize: 14, color: C.greenDark },
});
