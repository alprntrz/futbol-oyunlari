import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInDown, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Locale, TKey } from "@/lib/strings";
import { WM_CLUBS, WM_COUNTRIES, WM_DECADES, WM_HONOURS, WM_LEAGUES, WM_MAX_TURNS, WM_POSITIONS, type WmKind, type WmQuestion } from "@/lib/whoami";

import { KIMIM } from "~/lib/brand";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import type { WmMatch } from "~/lib/whoamiMatch";
import { C, F, GAME, R, T, shadow } from "~/lib/theme";

import { PlayerSearchSheet } from "./PlayerSearchSheet";
import { Text } from "./Text";
import { Button, Icon, Tap } from "./ui";

const KINDS: WmKind[] = ["club", "country", "league", "pos", "honour", "born"];

/** The menu entries of a kind: [question, label on the chip]. */
function optionsOf(kind: WmKind, locale: Locale, t: (k: TKey) => string): { q: WmQuestion; label: string }[] {
  const L = (x: { tr: string; en: string }) => (locale === "tr" ? x.tr : x.en);
  switch (kind) {
    case "club":
      return WM_CLUBS.map((c) => ({ q: { kind, id: c.id }, label: L(c) })).sort((a, b) => a.label.localeCompare(b.label));
    case "country":
      return WM_COUNTRIES.map((c) => ({ q: { kind, id: c.id }, label: L(c) })).sort((a, b) => a.label.localeCompare(b.label));
    case "league":
      return WM_LEAGUES.map((l) => ({ q: { kind, id: l.id }, label: L(l.name) }));
    case "pos":
      return WM_POSITIONS.map((id) => ({ q: { kind, id }, label: t(`posName_${id}`) }));
    case "honour":
      return WM_HONOURS.map((c) => ({ q: { kind, id: c.id }, label: L(c) }));
    case "born":
      return WM_DECADES.map((id) => ({ q: { kind, id }, label: `${id}–${Number(id) + 9}` }));
  }
}

/** A question as a sentence ("Did he play for Inter?"). */
export function wmQuestionText(q: WmQuestion, locale: Locale, t: (k: TKey) => string): string {
  const label = optionsOf(q.kind, locale, t).find((o) => o.q.id === q.id)?.label ?? q.id;
  if (q.kind === "born") return t("wmQ_born").replace("{x}", q.id).replace("{y}", String(Number(q.id) + 9));
  return t(`wmQ_${q.kind}`).replace("{x}", label);
}

/**
 * The Who Am I? match screen, the same online and against the house player: lives and whose
 * turn, the log both players see (yours green, theirs coral), and Ask / Guess on your turn.
 */
export function WhoAmIBoard({ m, footer }: { m: WmMatch; footer?: React.ReactNode }) {
  const { t, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(() => Date.now());
  const [asking, setAsking] = useState(false);
  const [guessing, setGuessing] = useState(false);
  const [kind, setKind] = useState<WmKind>("club");
  const list = useRef<ScrollView>(null);

  useEffect(() => {
    if (!m.deadline) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [m.deadline]);

  // sheets close when the turn moves on (out of time, or the game ended)
  const [lastTurn, setLastTurn] = useState(m.turns);
  if (lastTurn !== m.turns) {
    setLastTurn(m.turns);
    setAsking(false);
    setGuessing(false);
  }

  const count = m.log.length;
  useEffect(() => {
    if (!count) return;
    list.current?.scrollToEnd({ animated: true });
    const last = m.log[count - 1];
    if ("guess" in last && !last.right && last.mine) haptic.error();
    else if (!last.mine) haptic.tap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  const asked = useMemo(() => new Set(m.log.flatMap((e) => ("q" in e ? [`${e.q.kind}:${e.q.id}`] : []))), [m.log]);
  const wrong = useMemo(() => new Set(m.log.flatMap((e) => ("guess" in e && !e.right ? [e.guess] : []))), [m.log]);
  const left = m.deadline ? Math.max(0, m.deadline - now) : 0;
  const secs = Math.ceil(left / 1000);
  const frac = m.turnMs ? Math.min(1, left / m.turnMs) : 0;

  const confirmForfeit = () =>
    Alert.alert(t("rdForfeitTitle"), t("rdForfeitBody"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("htForfeit"), style: "destructive", onPress: m.forfeit },
    ]);

  // lives: heart-shaped balls, a lost one faded
  const hearts = (n: number, right = false) => (
    <View style={{ flexDirection: "row", gap: 3, justifyContent: right ? "flex-end" : "flex-start" }} accessibilityLabel={`${n}/3`}>
      {[0, 1, 2].map((i) => (
        <Image key={i} source={KIMIM.life} style={[styles.life, i >= n && { opacity: 0.18 }]} resizeMode="contain" />
      ))}
    </View>
  );

  const result = !m.over
    ? null
    : m.draw
      ? t("wmDraw")
      : m.endReason === "forfeit"
        ? t(m.won ? "wmForfeitWon" : "wmForfeitLost")
        : m.endReason === "hearts"
          ? t(m.won ? "wmWonHearts" : "wmLostHearts")
          : t(m.won ? "wmWonNamed" : "wmLostNamed");

  return (
    <View style={{ flex: 1 }}>
      {/* lives, then whose turn and the clock */}
      <View style={styles.sides}>
        <View style={styles.side}>
          <Text style={[styles.sideName, { color: C.greenDark }]}>{t("you")}</Text>
          {hearts(m.hearts.me)}
        </View>
        <View style={[styles.side, { alignItems: "flex-end" }]}>
          <Text style={[styles.sideName, { color: C.coral }]} numberOfLines={1}>
            {m.opponent?.nick || t("opponent")}
          </Text>
          {hearts(m.hearts.them, true)}
        </View>
      </View>
      {!m.over && (
        <>
          <View style={styles.turnRow}>
            <Text style={[styles.turn, { color: m.myTurn ? C.greenMid : C.coral }]}>{m.myTurn ? t("rdYourTurn") : t("rdTheirTurn")}</Text>
            <Text style={T.caption}>{t("wmTurnsLeft").replace("{n}", String(Math.max(0, WM_MAX_TURNS - m.turns)))}</Text>
            {m.deadline > 0 && <Text style={[styles.secs, secs <= 5 && { color: C.red }]}>{secs}s</Text>}
          </View>
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${frac * 100}%`, backgroundColor: m.myTurn ? C.green : C.coral }, secs <= 5 && { backgroundColor: C.red }]} />
          </View>
        </>
      )}

      {/* the shared log */}
      <ScrollView ref={list} style={{ flex: 1 }} contentContainerStyle={styles.log}>
        {m.log.length === 0 && !m.over && <Text style={[T.body, { textAlign: "center", color: C.text2, marginTop: 24 }]}>{m.myTurn ? t("wmStartYou") : t("wmStartThem")}</Text>}
        {m.log.map((e, i) => (
          <Animated.View key={i} entering={FadeInDown.duration(180)} style={[styles.entry, e.mine ? styles.entryMine : styles.entryTheirs]}>
            {"q" in e ? (
              <>
                <Text style={styles.entryText}>{wmQuestionText(e.q, locale, t)}</Text>
                <Text style={[styles.answer, { color: e.yes ? C.greenMid : C.red }]}>{e.yes ? t("wmYes") : t("wmNo")}</Text>
              </>
            ) : "guess" in e ? (
              <>
                <Text style={styles.entryText}>{t("wmGuessLine").replace("{x}", e.guess)}</Text>
                <Icon name={e.right ? "checkmark.circle.fill" : "xmark.circle.fill"} size={18} color={e.right ? C.greenMid : C.red} />
              </>
            ) : (
              <Text style={[styles.entryText, { color: C.text3 }]}>{t("wmTimeout")}</Text>
            )}
          </Animated.View>
        ))}
        {m.over && (
          <Animated.View entering={ZoomIn.duration(220)} style={styles.result}>
            <Text style={[styles.resultTitle, { color: m.draw ? C.text : m.won ? C.greenMid : C.red }]}>{result}</Text>
            {m.hidden && <Text style={T.body}>{t("wmWasHidden").replace("{x}", m.hidden)}</Text>}
          </Animated.View>
        )}
        {footer}
      </ScrollView>

      {!m.over && (
        <View style={{ paddingBottom: insets.bottom ? 0 : 8 }}>
          <View style={styles.actions}>
            <Button title={t("wmAsk")} icon="questionmark.bubble.fill" disabled={!m.myTurn} onPress={() => (haptic.tap(), setAsking(true))} style={{ flex: 1 }} />
            <Button title={t("wmGuess")} icon="person.fill.questionmark" kind="secondary" disabled={!m.myTurn} onPress={() => (haptic.tap(), setGuessing(true))} style={{ flex: 1 }} />
          </View>
          <Tap onPress={confirmForfeit} style={styles.forfeit} accessibilityRole="button">
            <Icon name="flag.fill" size={13} color={C.text3} />
            <Text style={styles.forfeitText}>{t("htForfeit")}</Text>
          </Tap>
        </View>
      )}

      {/* the question menu */}
      <Modal statusBarTranslucent navigationBarTranslucent visible={asking} transparent animationType="slide" onRequestClose={() => setAsking(false)}>
        <Pressable style={styles.backdrop} onPress={() => setAsking(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.grabber} />
          <Text style={[T.title, { marginBottom: 10 }]}>{t("wmPickQuestion")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
            {KINDS.map((k) => (
              <Tap key={k} onPress={() => setKind(k)} style={[styles.tab, kind === k && { backgroundColor: GAME.wm.ink }]} accessibilityRole="tab" accessibilityState={{ selected: kind === k }}>
                <Text style={[styles.tabText, kind === k && { color: "white" }]}>{t(`wmCat_${k}`)}</Text>
              </Tap>
            ))}
          </ScrollView>
          <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={styles.chips}>
            {optionsOf(kind, locale, t).map((o) => {
              const done = asked.has(`${o.q.kind}:${o.q.id}`);
              return (
                <Tap
                  key={o.q.id}
                  disabled={done}
                  onPress={() => {
                    haptic.press();
                    setAsking(false);
                    m.ask(o.q);
                  }}
                  style={[styles.chip, done && { opacity: 0.35 }]}
                >
                  <Text style={styles.chipText}>{o.label}</Text>
                </Tap>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      <PlayerSearchSheet
        visible={guessing}
        caption={t("wmGuessCaption")}
        used={wrong}
        accept={() => true}
        onSubmit={(p, typed) => {
          setGuessing(false);
          // a name we don't know is a wrong guess too (it costs a life)
          const name = p?.name ?? typed.trim();
          if (name) m.guess(name);
        }}
        onClose={() => setGuessing(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sides: { flexDirection: "row", gap: 12, marginBottom: 8 },
  side: { flex: 1, gap: 4 },
  sideName: { fontFamily: F.display, fontSize: 20 },
  life: { width: 22, height: 19 },
  turnRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 6 },
  turn: { fontFamily: F.display, fontSize: 20 },
  secs: { fontFamily: F.black, fontSize: 22, color: C.text },
  bar: { height: 8, borderRadius: 4, backgroundColor: C.border, overflow: "hidden", marginTop: 6 },
  barFill: { height: 8, borderRadius: 4 },
  log: { gap: 6, paddingVertical: 12 },
  entry: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: R.inner, maxWidth: "92%" },
  entryMine: { alignSelf: "flex-start", backgroundColor: C.greenSoft },
  entryTheirs: { alignSelf: "flex-end", backgroundColor: C.coralSoft },
  entryText: { fontSize: 15, fontWeight: "700", color: C.text, flexShrink: 1 },
  answer: { fontFamily: F.black, fontSize: 15 },
  result: { alignItems: "center", gap: 6, backgroundColor: C.card, borderRadius: R.card, padding: 18, marginTop: 10, ...shadow },
  resultTitle: { fontFamily: F.display, fontSize: 30 },
  actions: { flexDirection: "row", gap: 10 },
  forfeit: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "center", paddingVertical: 10, paddingHorizontal: 12 },
  forfeitText: { color: C.text3, fontWeight: "700", fontSize: 13 },
  backdrop: { flex: 1, backgroundColor: "rgba(11,18,32,0.35)" },
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 16, paddingTop: 8 },
  grabber: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: "#D5DAE1", marginBottom: 14 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  tabText: { fontFamily: F.display, fontSize: 16, color: C.text },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: R.inner, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  chipText: { fontSize: 15, fontWeight: "700", color: C.text },
});

/** End of the match: rematch / a new opponent. */
export function WhoAmIEnd({ m, onNew }: { m: WmMatch; onNew?: () => void }) {
  const { t } = useI18n();
  if (!m.over) return null;
  return (
    <Animated.View entering={FadeIn.delay(300)} style={{ gap: 10, marginTop: 14 }}>
      {m.rematch ? <Button title={t("htRematch")} icon="arrow.clockwise" onPress={m.rematch} /> : !m.peerLeft && <Text style={[T.body, { textAlign: "center" }]}>{t("htWaitRematch")}</Text>}
      {onNew && <Button title={t("htNewGame")} kind="secondary" icon="play.fill" onPress={onNew} />}
    </Animated.View>
  );
}
