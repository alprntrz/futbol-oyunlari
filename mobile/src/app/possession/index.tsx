import type { SymbolViewProps } from "expo-symbols";
import { router, Stack, type Href } from "expo-router";
import { StyleSheet, View } from "react-native";

import { Text } from "~/components/Text";
import { Card, Icon, Page, SectionLabel, Tap } from "~/components/ui";
import { useI18n } from "~/lib/i18n";
import { C, F, R, T } from "~/lib/theme";

/** Possession Play hub: friend online, random opponent, same screen. */
export default function PossessionHome() {
  const { t } = useI18n();
  const modes: { icon: SymbolViewProps["name"]; fallback: string; title: string; desc: string; href: Href; color: string; soft: string }[] = [
    { icon: "person.2.fill", fallback: "👥", title: t("htFriend"), desc: t("htFriendDesc"), href: "/possession/oda", color: C.greenMid, soft: C.greenSoft },
    { icon: "antenna.radiowaves.left.and.right", fallback: "📡", title: t("htRandom"), desc: t("htRandomDesc"), href: "/possession/rastgele", color: C.blue, soft: C.blueSoft },
    { icon: "iphone", fallback: "📱", title: t("htSame"), desc: t("ppSameDesc"), href: "/possession/yerel", color: C.coral, soft: C.coralSoft },
  ];

  return (
    <Page>
      <Stack.Screen options={{ title: t("ppName") }} />
      <Text style={T.title}>{t("ppName")}</Text>
      <Text style={[T.body, { marginTop: 4 }]}>{t("ppTagline")}</Text>

      <SectionLabel>{t("htModes")}</SectionLabel>
      <View style={styles.grid}>
        {modes.map((m) => (
          <Tap key={m.title} onPress={() => router.push(m.href)} style={styles.card} accessibilityLabel={`${m.title}. ${m.desc}`}>
            <View style={[styles.icon, { backgroundColor: m.soft }]}>
              <Icon name={m.icon} size={24} color={m.color} fallback={m.fallback} />
            </View>
            <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
              {m.title}
            </Text>
            <Text style={styles.desc}>{m.desc}</Text>
          </Tap>
        ))}
      </View>

      <SectionLabel>{t("howToPlay")}</SectionLabel>
      <Card style={{ gap: 12 }}>
        {[t("ppRule1"), t("ppRule2")].map((r) => (
          <View key={r} style={{ flexDirection: "row", gap: 10 }}>
            <Icon name="hexagon.fill" size={16} color={C.greenMid} fallback="⬡" />
            <Text style={[T.body, { flex: 1 }]}>{r}</Text>
          </View>
        ))}
      </Card>
    </Page>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: {
    width: "47.9%",
    minHeight: 160,
    backgroundColor: C.card,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  icon: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  title: { fontFamily: F.display, fontSize: 22, lineHeight: 24, color: C.text, textAlign: "center" },
  desc: { fontSize: 14, lineHeight: 19, color: C.text2, textAlign: "center" },
});
