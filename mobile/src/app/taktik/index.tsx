import { router, Stack } from "expo-router";
import { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import { COACHES } from "@/lib/taktik/engine";
import type { CoachId } from "@/lib/taktik/types";

import { softIn } from "~/components/motion";
import { Text } from "~/components/Text";
import { Button, Card, Icon, Page, SectionLabel, Tap } from "~/components/ui";
import { TAKTIK } from "~/lib/brand";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { startTaktik, useTaktik } from "~/lib/taktik";
import { C, F, T } from "~/lib/theme";

/** Taktik Tahtası: how it works, pick a manager style, start (or carry on). */
export default function TaktikHome() {
  const { t } = useI18n();
  const { lobby } = useTaktik();
  const [coach, setCoach] = useState<CoachId>("pass");
  const ongoing = !!lobby && !lobby.over && lobby.managers[0].place === null;

  const start = async () => {
    haptic.success();
    await startTaktik(coach);
    router.push("/taktik/oyun");
  };

  const rules = [t("ttkRule1"), t("ttkRule2"), t("ttkRule3"), t("ttkRule4"), t("ttkRule5")];

  return (
    <Page>
      <Stack.Screen options={{ title: t("ttkName") }} />
      <View style={styles.hero}>
        <Image source={TAKTIK.hero} style={styles.heroArt} />
        <Text style={[T.title, { textAlign: "center" }]}>{t("ttkName")}</Text>
        <Text style={[T.body, { textAlign: "center" }]}>{t("ttkIntro")}</Text>
      </View>

      {ongoing && (
        <Button title={t("ttkResume")} icon="play.fill" onPress={() => router.push("/taktik/oyun")} style={{ marginTop: 16 }} />
      )}

      <Card style={{ marginTop: 16, gap: 10 }}>
        {rules.map((r, i) => (
          <Animated.View key={i} entering={softIn(i)} style={styles.rule}>
            <View style={styles.ruleNum}>
              <Text style={styles.ruleNumText}>{i + 1}</Text>
            </View>
            <Text style={[T.body, { flex: 1 }]}>{r}</Text>
          </Animated.View>
        ))}
      </Card>

      <SectionLabel>{t("ttkPickCoach")}</SectionLabel>
      <View style={{ gap: 10 }}>
        {COACHES.map((c) => {
          const on = c === coach;
          return (
            <Tap
              key={c}
              onPress={() => setCoach(c)}
              style={[styles.coach, on && styles.coachOn]}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${t(`ttkCoach_${c}`)}. ${t(`ttkCoachD_${c}`)}`}
            >
              <Image source={TAKTIK.coach[c]} style={styles.coachArt} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={T.headline}>{t(`ttkCoach_${c}`)}</Text>
                <Text style={T.caption}>{t(`ttkCoachD_${c}`)}</Text>
              </View>
              {on && <Icon name="checkmark.circle.fill" size={24} color={C.green} fallback="✓" />}
            </Tap>
          );
        })}
      </View>

      <Button title={ongoing ? t("ttkNewGame") : t("ttkStart")} kind={ongoing ? "secondary" : "primary"} icon="play.fill" onPress={start} style={{ marginTop: 18 }} />
    </Page>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", gap: 6 },
  heroArt: { width: 180, height: 180 },
  rule: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  ruleNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.greenSoft, alignItems: "center", justifyContent: "center", marginTop: 1 },
  ruleNumText: { fontFamily: F.display, fontSize: 15, color: C.greenDark },
  coach: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 18, backgroundColor: C.card, borderWidth: 2, borderColor: "transparent" },
  coachOn: { borderColor: C.green },
  coachArt: { width: 56, height: 56 },
});
