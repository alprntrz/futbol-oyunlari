import { router, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MenuCard, Pill, Tap } from "~/components/ui";
import { useI18n } from "~/lib/i18n";
import { C, F } from "~/lib/theme";

export default function Home() {
  const { t, locale, setLocale } = useI18n();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
      <Stack.Screen options={{ headerShown: false, title: t("appName") }} />
      <View style={styles.top}>
        <Tap onPress={() => setLocale(locale === "tr" ? "en" : "tr")} style={styles.lang}>
          <Text style={styles.langText}>{locale === "tr" ? "EN" : "TR"}</Text>
        </Tap>
      </View>

      <View style={styles.hero}>
        <Text style={{ fontSize: 56 }}>⚽</Text>
        <Text style={styles.title}>{t("appName")}</Text>
      </View>

      <View style={{ gap: 14 }}>
        <MenuCard title={t("missingXI")} subtitle={t("missingXITagline")} emoji="🥅" color={C.emerald} onPress={() => router.push("/eksik-11")}>
          <View style={styles.pills}>
            <Pill label={t("daily")} color={C.indigo} />
            <Pill label={t("onlineRace")} color="#059669" />
          </View>
        </MenuCard>
        <MenuCard title={t("tikiTakaName")} subtitle={t("tikiTakaTagline")} emoji="❌" color={C.rose} onPress={() => router.push("/tiki-taka-toe")}>
          <View style={styles.pills}>
            <Pill label={t("twoPlayers")} color={C.rose} />
          </View>
        </MenuCard>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16 },
  top: { flexDirection: "row", justifyContent: "flex-end" },
  lang: { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  langText: { color: C.textDim, fontFamily: F.black, fontSize: 13 },
  hero: { alignItems: "center", marginTop: 24, marginBottom: 36, gap: 14 },
  title: { color: C.text, fontFamily: F.pixel, fontSize: 20, textAlign: "center", lineHeight: 30 },
  pills: { flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" },
});
