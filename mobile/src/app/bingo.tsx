import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Share, StyleSheet, View } from "react-native";
import Animated, { FadeIn, Keyframe } from "react-native-reanimated";

import { dayNumber } from "@/lib/daily";
import type { Criterion } from "@/lib/tiki";

import { CriterionBadge } from "~/components/HatTrickBoard";
import { Text } from "~/components/Text";
import { Button, Card, Icon, Page, Tap } from "~/components/ui";
import { bingoForDay, CARD_SIZE } from "~/lib/bingo";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { C, F, R, shadow, T } from "~/lib/theme";

const key = (day: number) => `bingo-${day}`;

interface BingoRun {
  placed: (string | null)[];
  /** index of the current footballer in the day's stream (= footballers used) */
  index: number;
  wildcardUsed: boolean;
}

const POP = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.6 }] },
  55: { opacity: 1, transform: [{ scale: 1.12 }] },
  100: { opacity: 1, transform: [{ scale: 1 }] },
}).duration(260);

const surname = (name: string) => name.trim().split(/\s+/).slice(-1)[0];
const initials = (name: string) => {
  const t = name.trim().split(/\s+/);
  return ((t[0]?.[0] ?? "") + (t.length > 1 ? t[t.length - 1][0] : "")).toUpperCase();
};

/** Football Bingo: one shared card and footballer order per day. */
export default function Bingo() {
  const { t, locale } = useI18n();
  const day = dayNumber();
  const { card, stream } = useMemo(() => bingoForDay(day), [day]);
  const [run, setRun] = useState<BingoRun | null | undefined>(undefined);
  const [wildcardOn, setWildcardOn] = useState(false);
  const [flash, setFlash] = useState<{ text: string; ok: boolean } | null>(null);
  const [wrongSquare, setWrongSquare] = useState<number | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(key(day))
      .then((raw) => setRun(raw ? (JSON.parse(raw) as BingoRun) : null))
      .catch(() => setRun(null));
  }, [day]);

  useEffect(() => {
    if (run) AsyncStorage.setItem(key(day), JSON.stringify(run)).catch(() => {});
  }, [run, day]);

  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 1800);
    return () => clearTimeout(id);
  }, [flash]);

  useEffect(() => {
    if (wrongSquare === null) return;
    const id = setTimeout(() => setWrongSquare(null), 700);
    return () => clearTimeout(id);
  }, [wrongSquare]);

  const label = (c: Criterion) => (locale === "tr" ? c.tr : c.en);

  if (run === undefined) return <Page>{null}</Page>;

  if (!run) {
    return (
      <Page>
        <Stack.Screen options={{ title: `${t("bingoName")} #${day % 1000}` }} />
        <Text style={T.title}>{t("bingoName")}</Text>
        <Text style={[T.body, { marginTop: 6 }]}>{t("bingoIntro")}</Text>
        <Card style={{ marginTop: 16, gap: 12 }}>
          <View style={styles.ruleRow}>
            <Icon name="xmark.circle.fill" size={18} color={C.red} fallback="✕" />
            <Text style={[T.body, { flex: 1 }]}>{t("bingoRule1")}</Text>
          </View>
          <View style={styles.ruleRow}>
            <Icon name="sparkles" size={18} color={C.amber} fallback="✨" />
            <Text style={[T.body, { flex: 1 }]}>{t("bingoRule2")}</Text>
          </View>
        </Card>
        <Button
          title={t("bingoStart")}
          icon="play.fill"
          onPress={() => setRun({ placed: Array(CARD_SIZE).fill(null), index: 0, wildcardUsed: false })}
          style={{ marginTop: 24 }}
        />
      </Page>
    );
  }

  const filled = run.placed.filter(Boolean).length;
  const complete = filled === CARD_SIZE;
  const outOfPlayers = run.index >= stream.length;
  const done = complete || outOfPlayers;
  const current = done ? null : stream[run.index];
  const used = Math.min(run.index, stream.length);

  const skip = () => {
    haptic.tap();
    setWildcardOn(false);
    setRun({ ...run, index: run.index + 1 });
  };

  const place = (i: number) => {
    if (!current || run.placed[i]) return;
    const fits = (j: number) => !run.placed[j] && card[j].test(current);
    if (wildcardOn) {
      const all = card.map((_, j) => j).filter(fits);
      setWildcardOn(false);
      if (all.length === 0) return wrong(i);
      haptic.success();
      setFlash({ text: `${current.name} +${all.length}`, ok: true });
      return setRun({ placed: run.placed.map((p, j) => (all.includes(j) ? current.name : p)), index: run.index + 1, wildcardUsed: true });
    }
    if (!fits(i)) return wrong(i);
    haptic.success();
    setRun({ ...run, placed: run.placed.map((p, j) => (j === i ? current.name : p)), index: run.index + 1 });
  };

  // A wrong square costs a turn: the next footballer is skipped too
  const wrong = (i: number) => {
    haptic.error();
    setWrongSquare(i);
    setFlash({ text: t("bingoWrong"), ok: false });
    setRun({ ...run, index: run.index + 2, wildcardUsed: run.wildcardUsed || wildcardOn });
  };

  const share = () => {
    const rows = [0, 1, 2, 3].map((r) => run.placed.slice(r * 4, r * 4 + 4).map((p) => (p ? "🟩" : "⬜")).join("")).join("\n");
    Share.share({ message: `${t("bingoName")} #${day % 1000}\n${rows}\n${filled}/${CARD_SIZE} · ${used} ${t("bingoUsed")}` });
  };

  return (
    <Page>
      <Stack.Screen options={{ title: `${t("bingoName")} #${day % 1000}` }} />

      <Card style={styles.strip}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {filled}/{CARD_SIZE}
          </Text>
          <Text style={T.caption}>{t("bbBoxes")}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{used}</Text>
          <Text style={T.caption}>{t("bingoUsed")}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{Math.max(0, stream.length - run.index)}</Text>
          <Text style={T.caption}>{t("bingoLeft")}</Text>
        </View>
      </Card>

      {/* Current footballer */}
      {current ? (
        <Animated.View key={run.index} entering={FadeIn.duration(160)}>
          <Card style={styles.player}>
            <View style={styles.avatar}>
              <Text allowFontScaling={false} style={styles.avatarText}>
                {initials(current.name)}
              </Text>
            </View>
            <Text style={styles.playerName} numberOfLines={2}>
              {current.name}
            </Text>
            <View style={styles.actions}>
              <Button
                title={t("bingoWildcard")}
                icon="sparkles"
                kind={wildcardOn ? "primary" : "secondary"}
                disabled={run.wildcardUsed}
                onPress={() => {
                  haptic.tap();
                  setWildcardOn((w) => !w);
                }}
                style={{ flex: 1, minHeight: 44 }}
              />
              <Button title={t("bingoSkip")} icon="forward.fill" kind="secondary" onPress={skip} style={{ flex: 1, minHeight: 44 }} />
            </View>
            {wildcardOn && <Text style={[T.caption, { color: C.amber, fontWeight: "700", marginTop: 8 }]}>{t("bingoWildcardOn")}</Text>}
          </Card>
        </Animated.View>
      ) : (
        <Card style={[styles.player, { gap: 4 }]}>
          <Text style={T.title}>{complete ? t("bingoDone") : t("bingoOut")}</Text>
          <Text style={T.body}>
            {filled}/{CARD_SIZE} · {used} {t("bingoScore")}
          </Text>
          <Button title={t("share")} icon="square.and.arrow.up" onPress={share} style={{ alignSelf: "stretch", marginTop: 10 }} />
          <Text style={[T.caption, { marginTop: 8 }]}>{t("bingoTomorrow")}</Text>
        </Card>
      )}

      {/* Fixed slot so the card never jumps when a message appears */}
      <View style={styles.toastSlot}>
        {flash && (
          <Animated.View entering={FadeIn.duration(120)} style={[styles.toast, { backgroundColor: flash.ok ? C.greenSoft : C.redSoft }]}>
            <Text style={{ color: flash.ok ? C.greenDark : C.red, fontWeight: "700", fontSize: 13, textAlign: "center" }} numberOfLines={1}>
              {flash.text}
            </Text>
          </Animated.View>
        )}
      </View>

      {/* Card */}
      <View style={styles.grid}>
        {card.map((c, i) => {
          const name = run.placed[i];
          return (
            <Tap
              key={c.id}
              disabled={!!name || done}
              onPress={() => place(i)}
              accessibilityLabel={name ? `${label(c)}, ${name}` : label(c)}
              style={[styles.square, name && styles.squareDone, wrongSquare === i && styles.squareWrong]}
            >
              {name ? (
                <Animated.View entering={POP} style={{ alignItems: "center", gap: 2 }}>
                  <Icon name="checkmark.circle.fill" size={22} color={C.greenMid} fallback="✓" />
                  <Text style={styles.squareName} numberOfLines={1}>
                    {surname(name)}
                  </Text>
                  <Text style={styles.squareSub} numberOfLines={1}>
                    {label(c)}
                  </Text>
                </Animated.View>
              ) : (
                <>
                  <CriterionBadge c={c} size={26} />
                  <Text style={styles.squareLabel} numberOfLines={2} adjustsFontSizeToFit>
                    {label(c)}
                  </Text>
                </>
              )}
            </Tap>
          );
        })}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  ruleRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  strip: { flexDirection: "row", padding: 12 },
  stat: { flex: 1, alignItems: "center" },
  statValue: { fontFamily: F.display, fontSize: 24, lineHeight: 28, color: C.text, fontVariant: ["tabular-nums"] },
  player: { marginTop: 12, alignItems: "center", padding: 16 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.text, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "white", fontFamily: F.black, fontSize: 22 },
  playerName: { fontFamily: F.display, fontSize: 28, lineHeight: 30, color: C.text, marginTop: 8, textAlign: "center" },
  actions: { flexDirection: "row", gap: 10, marginTop: 12, alignSelf: "stretch" },
  toastSlot: { height: 40, justifyContent: "center", alignItems: "center", marginTop: 6 },
  toast: { borderRadius: 12, paddingVertical: 7, paddingHorizontal: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 },
  square: {
    width: "23.6%",
    aspectRatio: 0.9,
    borderRadius: R.inner,
    backgroundColor: C.card,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    padding: 4,
    ...shadow,
    shadowOpacity: 0.04,
  },
  squareDone: { backgroundColor: C.greenSoft },
  squareWrong: { backgroundColor: C.redSoft },
  squareLabel: { color: C.text2, fontSize: 10, fontWeight: "700", textAlign: "center" },
  squareName: { color: C.greenDark, fontFamily: F.display, fontSize: 16, textAlign: "center" },
  squareSub: { color: C.text2, fontSize: 9, fontWeight: "600", textAlign: "center" },
});
