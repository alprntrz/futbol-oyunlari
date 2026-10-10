import type { SymbolViewProps } from "expo-symbols";
import { router, Stack, type Href } from "expo-router";
import { StyleSheet, View } from "react-native";

import { HelpButton } from "~/components/HelpButton";
import { TikiSteps } from "~/components/HowTo";
import { Text } from "~/components/Text";
import { Card, Icon, Page, SectionLabel, Tap } from "~/components/ui";
import { useI18n } from "~/lib/i18n";
import { C, F, R, T } from "~/lib/theme";

/** Hat-trick hub: four ways to play, as a 2×2 grid of cards. */
export default function HatTrickHome() {
  const { t } = useI18n();
  const modes: { icon: SymbolViewProps["name"]; fallback: string; title: string; desc: string; href: Href; color: string; soft: string }[] = [
    { icon: "person.2.fill", fallback: "👥", title: t("htFriend"), desc: t("htFriendDesc"), href: "/hat-trick/oda", color: C.greenMid, soft: C.greenSoft },
    { icon: "antenna.radiowaves.left.and.right", fallback: "📡", title: t("htRandom"), desc: t("htRandomDesc"), href: "/hat-trick/rastgele", color: C.blue, soft: C.blueSoft },
    { icon: "iphone", fallback: "📱", title: t("htSame"), desc: t("htSameDesc"), href: "/hat-trick/yerel", color: C.coral, soft: C.coralSoft },
    { icon: "person.fill", fallback: "👤", title: t("htSolo"), desc: t("htSoloDesc"), href: "/hat-trick/tek", color: "#B7791F", soft: C.amberSoft },
  ];

  return (
    <Page>
      <Stack.Screen options={{ title: t("tikiTakaName"), headerRight: () => <HelpButton game="tiki" /> }} />
      <Text style={T.title}>{t("tikiTakaName")}</Text>
      <Text style={[T.body, { marginTop: 4 }]}>{t("tikiTakaTagline")}</Text>

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
      <Card style={{ padding: 20 }}>
        <TikiSteps />
      </Card>
    </Page>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: {
    width: "47.9%",
    minHeight: 170,
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
