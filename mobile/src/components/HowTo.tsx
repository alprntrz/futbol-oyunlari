import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { BRAND } from "~/lib/brand";
import { useI18n } from "~/lib/i18n";
import { C, T } from "~/lib/theme";

/** Small green / yellow / grey legend explaining the tile colours. */
export function TileLegend({ compact }: { compact?: boolean }) {
  const { t } = useI18n();
  const items: [string, string][] = [
    [C.tileCorrect, t("legendCorrect")],
    [C.tilePresent, t("legendPresent")],
    [C.tileAbsent, t("legendAbsent")],
  ];
  return (
    <View style={[styles.legend, compact && { gap: 12 }]}>
      {items.map(([color, label]) => (
        <View key={label} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: color }]} />
          <Text style={[T.caption, { color: C.text2 }]}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

function Step({ n, title, desc, children }: { n: number; title: string; desc: string; children?: React.ReactNode }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNum}>
        <Text style={styles.stepNumText}>{n}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={T.headline}>{title}</Text>
        <Text style={[T.body, { marginTop: 2 }]}>{desc}</Text>
        {children}
      </View>
    </View>
  );
}

export function MissingXISteps() {
  const { t } = useI18n();
  return (
    <View style={{ gap: 18 }}>
      <Image source={BRAND.illus.howto} style={styles.howto} resizeMode="contain" />
      <Step n={1} title={t("step1")} desc={t("step1Desc")} />
      <Step n={2} title={t("step2")} desc={t("step2Desc")} />
      <Step n={3} title={t("step3")} desc={t("step3Desc")}>
        <View style={{ marginTop: 10 }}>
          <TileLegend />
        </View>
      </Step>
    </View>
  );
}

export function TikiSteps() {
  const { t } = useI18n();
  return (
    <View style={{ gap: 18 }}>
      <Step n={1} title={t("tikiTakaName")} desc={t("ttStep1")} />
      <Step n={2} title={t("ttPlaceholder").replace("…", "")} desc={t("ttStep2")} />
      <Step n={3} title="X · O" desc={t("ttStep3")} />
    </View>
  );
}

/** Native page sheet with a title and a Close action. */
export function InfoSheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.card }}>
        <View style={styles.sheetHeader}>
          <Text style={T.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={{ color: C.green, fontSize: 17, fontWeight: "600" }}>{t("close")}</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4 }}>{children}</ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  howto: { width: "100%", height: 130 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 14, height: 14, borderRadius: 4 },
  step: { flexDirection: "row", gap: 14 },
  stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.greenSoft, alignItems: "center", justifyContent: "center" },
  stepNumText: { color: C.greenDark, fontWeight: "800", fontSize: 14 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20 },
});
