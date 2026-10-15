import { useEffect, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, View, type ImageSourcePropType } from "react-native";

import { evaluateGuess } from "@/lib/wordle";

import { BRAND } from "~/lib/brand";
import { useI18n } from "~/lib/i18n";
import { C, F, T } from "~/lib/theme";

import { Tile } from "./LetterTile";
import { Text } from "./Text";

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

// Demo: the answer is PIRLO; first guess PEDRO (P and O right, R elsewhere), then PIRLO.
const DEMO_ANSWER = "PIRLO";
const DEMO_GUESSES = ["PEDRO", "PIRLO"];
const TYPE_MS = 170;

/** Self-playing example: types two guesses into a row of tiles and flips them. */
export function DemoBoard({ dark }: { dark?: boolean }) {
  const [rows, setRows] = useState<string[]>([]);
  const [typing, setTyping] = useState("");
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let at = 400;
    const schedule = (fn: () => void, wait: number) => {
      at += wait;
      timers.push(setTimeout(fn, at));
    };
    schedule(() => {
      setRows([]);
      setTyping("");
    }, 0);
    DEMO_GUESSES.forEach((g, gi) => {
      for (let i = 1; i <= g.length; i++) schedule(() => setTyping(g.slice(0, i)), TYPE_MS);
      schedule(() => {
        setRows((r) => [...r, g]);
        setTyping("");
      }, 350);
      schedule(() => {}, gi === 0 ? 1300 : 2400);
    });
    schedule(() => setCycle((c) => c + 1), 0);
    return () => timers.forEach(clearTimeout);
  }, [cycle]);

  const empty = rows.length < DEMO_GUESSES.length;
  return (
    <View style={[styles.demo, dark && { backgroundColor: "transparent" }]}>
      {rows.map((g, ri) => (
        <View key={`${cycle}-${ri}`} style={styles.demoRow}>
          {g.split("").map((ch, i) => (
            <Tile key={i} ch={ch} mark={evaluateGuess(g, DEMO_ANSWER)[i]} size={42} flipIndex={i} />
          ))}
        </View>
      ))}
      {empty && (
        <View style={styles.demoRow}>
          {DEMO_ANSWER.split("").map((_, i) => (
            <Tile key={i} ch={typing[i] ?? ""} size={42} dark={dark} />
          ))}
        </View>
      )}
    </View>
  );
}

/** A how-to step: our art on a quiet tile, an optional title, and the explanation. */
export function Rule({ image, title, desc }: { image: ImageSourcePropType; title?: string; desc: string }) {
  return (
    <View style={styles.rule}>
      <View style={styles.ruleIcon}>
        <Image source={image} style={styles.ruleArt} accessible={false} />
      </View>
      <View style={{ flex: 1, justifyContent: "center" }}>
        {title ? <Text style={T.headline}>{title}</Text> : null}
        <Text style={[T.body, title ? { marginTop: 1 } : null]}>{desc}</Text>
      </View>
    </View>
  );
}

export function MissingXISteps() {
  const { t } = useI18n();
  return (
    <View style={{ gap: 16 }}>
      <DemoBoard />
      <View style={{ alignItems: "center" }}>
        <TileLegend />
      </View>
      <Rule image={BRAND.how.tapShirt} title={t("step1")} desc={t("step1Desc")} />
      <Rule image={BRAND.how.typeSurname} title={t("step2")} desc={t("step2Desc")} />
    </View>
  );
}

export function TikiSteps() {
  const { t } = useI18n();
  return (
    <View style={{ gap: 16 }}>
      <Rule image={BRAND.how.grid} title={t("tikiTakaName")} desc={t("ttStep1")} />
      <Rule image={BRAND.how.namePlayer} title={t("ttPlaceholder").replace("…", "")} desc={t("ttStep2")} />
      <Rule image={BRAND.how.threeRow} title="X O" desc={t("ttStep3")} />
    </View>
  );
}

/** Rules as numbered steps, for games without step art. */
export function NumberedRules({ items, note }: { items: string[]; note?: string }) {
  return (
    <View style={{ gap: 12 }}>
      {items.map((text, i) => (
        <View key={i} style={styles.numbered}>
          <View style={styles.num}>
            <Text style={styles.numText}>{i + 1}</Text>
          </View>
          <Text style={[T.body, { flex: 1 }]}>{text}</Text>
        </View>
      ))}
      {note ? <Text style={T.caption}>{note}</Text> : null}
    </View>
  );
}

export function QuizSteps() {
  const { t } = useI18n();
  return (
    <View style={{ gap: 16 }}>
      <Rule image={BRAND.how.questions} desc={t("qzRule1")} />
      <Rule image={BRAND.how.speed} desc={t("qzRule2")} />
      <Rule image={BRAND.how.players} desc={t("qzRule3")} />
    </View>
  );
}

export function PossessionSteps() {
  const { t } = useI18n();
  return (
    <View style={{ gap: 16 }}>
      <Rule image={BRAND.how.clock} desc={t("ppRule1")} />
      <Rule image={BRAND.how.hexes} desc={t("ppRule2")} />
    </View>
  );
}

export function DuelSteps() {
  const { t } = useI18n();
  return <NumberedRules items={[t("dzRule1"), t("dzRule2"), t("dzRule3"), t("dzRule4")]} note={t("dzDataNote")} />;
}

export function TaktikSteps() {
  const { t } = useI18n();
  return <NumberedRules items={[t("ttkRule1"), t("ttkRule2"), t("ttkRule3"), t("ttkRule4"), t("ttkRule5")]} />;
}

export function BingoSteps() {
  const { t } = useI18n();
  return <NumberedRules items={[t("bingoRule1"), t("bingoRule2")]} />;
}

export function MysterySteps() {
  const { t } = useI18n();
  return <NumberedRules items={[t("myIntro")]} />;
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
  demo: { alignItems: "center", gap: 6, minHeight: 2 * 42 + 6, paddingVertical: 8, backgroundColor: C.bg, borderRadius: 16 },
  demoRow: { flexDirection: "row", gap: 5 },
  rule: { flexDirection: "row", gap: 12, alignItems: "center" },
  ruleIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#EEF2EF", alignItems: "center", justifyContent: "center" },
  ruleArt: { width: 40, height: 40 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 14, height: 14, borderRadius: 4 },
  numbered: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  num: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.greenSoft, alignItems: "center", justifyContent: "center" },
  numText: { fontFamily: F.display, fontSize: 14, color: C.greenDark },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20 },
});
