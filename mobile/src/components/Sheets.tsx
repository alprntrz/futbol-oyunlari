import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import type { Difficulty } from "@/lib/types";

import { useI18n } from "~/lib/i18n";
import type { GameStats } from "~/lib/storage";
import { C, F } from "~/lib/theme";

import { Button, MenuCard } from "./ui";

export function DifficultyPicker({ onPick }: { onPick: (d: Difficulty) => void }) {
  const { t } = useI18n();
  return (
    <View style={{ gap: 12, width: "100%" }}>
      <Text style={styles.section}>{t("chooseDifficulty")}</Text>
      <MenuCard title={t("normal")} subtitle={t("normalDesc")} color={C.indigo} emoji="🙂" onPress={() => onPick("normal")} />
      <MenuCard title={t("hard")} subtitle={t("hardDesc")} color={C.rose} emoji="🔥" onPress={() => onPick("hard")} />
    </View>
  );
}

/** Native iOS page sheet (swipe down to dismiss). */
function PageSheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={{ color: C.indigoLight, fontFamily: F.bold, fontSize: 16 }}>{t("close")}</Text>
          </Pressable>
        </View>
        {children}
      </View>
    </Modal>
  );
}

export function StatsSheet({ stats, visible, onClose }: { stats: GameStats | null; visible: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const s = stats ?? { played: 0, won: 0, streak: 0, bestStreak: 0, lastWonDay: null };
  const items: [number, string][] = [
    [s.played, t("played")],
    [s.played ? Math.round((s.won / s.played) * 100) : 0, t("winRate")],
    [s.streak, t("streak")],
    [s.bestStreak, t("bestStreak")],
  ];
  return (
    <PageSheet visible={visible} onClose={onClose} title={t("stats")}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {items.map(([v, label]) => (
          <View key={label} style={styles.stat}>
            <Text style={styles.statValue}>{v}</Text>
            <Text style={styles.statLabel}>{label}</Text>
          </View>
        ))}
      </View>
      <Button title={t("close")} onPress={onClose} style={{ marginTop: 24 }} />
    </PageSheet>
  );
}

function ExampleRow({ word, marks, note }: { word: string; marks: string; note: string }) {
  return (
    <View style={{ alignItems: "center", gap: 6 }}>
      <View style={{ flexDirection: "row", gap: 4 }}>
        {word.split("").map((ch, i) => {
          const m = marks[i];
          const bg = m === "c" ? C.tileCorrect : m === "p" ? C.tilePresent : m === "a" ? C.tileAbsent : "transparent";
          return (
            <View key={i} style={[styles.exTile, { backgroundColor: bg, borderColor: m === "n" ? "#52525b" : bg }]}>
              <Text style={{ color: m === "p" ? "black" : "white", fontFamily: F.black, fontSize: 18 }}>{ch}</Text>
            </View>
          );
        })}
      </View>
      <Text style={{ color: C.textDim, fontFamily: F.body, fontSize: 13 }}>{note}</Text>
    </View>
  );
}

export function HowToPlaySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <PageSheet visible={visible} onClose={onClose} title={t("howToPlay")}>
      <Text style={{ color: C.textDim, fontFamily: F.body, fontSize: 15, lineHeight: 22, marginBottom: 20 }}>{t("howToPlayText")}</Text>
      <View style={{ gap: 18 }}>
        <ExampleRow word="MESSI" marks="cnnnn" note={t("hintCorrect")} />
        <ExampleRow word="NEUER" marks="nnpnn" note={t("hintPresent")} />
        <ExampleRow word="ONYEL" marks="nnann" note={t("hintAbsent")} />
      </View>
    </PageSheet>
  );
}

const styles = StyleSheet.create({
  section: { color: C.textDim, fontFamily: F.bold, fontSize: 13, textTransform: "uppercase", letterSpacing: 1 },
  sheet: { flex: 1, backgroundColor: C.surface, padding: 20 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  sheetTitle: { color: C.text, fontFamily: F.black, fontSize: 22 },
  stat: { flex: 1, backgroundColor: C.surface2, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  statValue: { color: C.text, fontFamily: F.black, fontSize: 26 },
  statLabel: { color: C.textDim, fontFamily: F.body, fontSize: 11, textAlign: "center" },
  exTile: { width: 40, height: 40, borderWidth: 2, borderRadius: 5, alignItems: "center", justifyContent: "center" },
});
