import { router } from "expo-router";
import { useState } from "react";
import { Image, StyleSheet, View } from "react-native";

import { COACHES } from "@/lib/taktik/engine";
import type { CoachId } from "@/lib/taktik/types";

import { ChoiceSheet, GameHub, HubSetting } from "~/components/GameHub";
import { Text } from "~/components/Text";
import { TAKTIK } from "~/lib/brand";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { startTaktik, useTaktik } from "~/lib/taktik";
import { C, F, T } from "~/lib/theme";

/** Pitch Chess: one big Start (or Continue); the manager style is a setting with a default; rules behind "?". */
export default function TaktikHome() {
  const { t } = useI18n();
  const { lobby } = useTaktik();
  const [coach, setCoach] = useState<CoachId>("pass");
  const [picking, setPicking] = useState(false);
  const ongoing = !!lobby && !lobby.over && lobby.managers[0].place === null;

  const start = async () => {
    haptic.success();
    await startTaktik(coach);
    router.push("/taktik/oyun");
  };
  const rules = [t("ttkRule1"), t("ttkRule2"), t("ttkRule3"), t("ttkRule4"), t("ttkRule5")];

  return (
    <GameHub
      title={t("ttkName")}
      image={TAKTIK.hero}
      bg="#DCFCE7"
      tagline={t("ttkShort")}
      primary={
        ongoing
          ? { label: t("ttkResume"), icon: "play.fill", fallback: "▶", onPress: () => router.push("/taktik/oyun") }
          : { label: t("ttkStart"), icon: "play.fill", fallback: "▶", onPress: start }
      }
      secondary={ongoing ? [{ label: t("ttkNewGame"), icon: "arrow.clockwise", fallback: "↻", onPress: start }] : []}
      settings={<HubSetting label={t("ttkCoachShort")} value={t(`ttkCoach_${coach}`)} onPress={() => setPicking(true)} />}
      rules={
        <View style={{ gap: 10 }}>
          {rules.map((r, i) => (
            <View key={i} style={styles.rule}>
              <View style={styles.ruleNum}>
                <Text style={styles.ruleNumText}>{i + 1}</Text>
              </View>
              <Text style={[T.body, { flex: 1 }]}>{r}</Text>
            </View>
          ))}
        </View>
      }
    >
      <ChoiceSheet
        visible={picking}
        title={t("ttkPickCoach")}
        value={coach}
        options={COACHES.map((c) => ({ value: c, label: t(`ttkCoach_${c}`), hint: t(`ttkCoachD_${c}`), left: <Image source={TAKTIK.coach[c]} style={{ width: 44, height: 44 }} /> }))}
        onPick={setCoach}
        onClose={() => setPicking(false)}
      />
    </GameHub>
  );
}

const styles = StyleSheet.create({
  rule: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  ruleNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.greenSoft, alignItems: "center", justifyContent: "center", marginTop: 1 },
  ruleNumText: { fontFamily: F.display, fontSize: 15, color: C.greenDark },
});
