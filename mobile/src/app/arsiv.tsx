import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Image, StyleSheet, View, type ImageSourcePropType } from "react-native";

import { dailyMatchFor, dateOfDay, dayNumber } from "@/lib/daily";
import { ARCHIVE_DAYS } from "@/lib/plus";
import { teamName } from "@/lib/teams";

import { Text } from "~/components/Text";
import { Button, Card, Icon, Page, Tap } from "~/components/ui";
import { bingoForDay, CARD_SIZE } from "~/lib/bingo";
import { BRAND } from "~/lib/brand";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { usePlus } from "~/lib/plus";
import { loadDayState } from "~/lib/storage";
import { C, F, R, T } from "~/lib/theme";

type Done = { grid: boolean; xi: boolean; bingo: boolean };

/** Which of a day's three puzzles were finished (the same saves the game screens write). */
async function doneOn(day: number): Promise<Done> {
  const [box, xi, bingo] = await Promise.all([
    AsyncStorage.getItem(`hattrick-box-${day}`).then((r) => (r ? (JSON.parse(r) as { finished: boolean }) : null)).catch(() => null),
    loadDayState(day),
    AsyncStorage.getItem(`bingo-${day}`).then((r) => (r ? (JSON.parse(r) as { placed: (string | null)[]; index: number }) : null)).catch(() => null),
  ]);
  const xiMatch = dailyMatchFor(day).match;
  return {
    grid: !!box?.finished,
    xi: !!xi && xi.matchId === xiMatch.id && (xi.gaveUp || xi.slots.every((s) => s.solved || s.failed)),
    bingo: !!bingo && (bingo.placed.filter(Boolean).length === CARD_SIZE || bingo.index >= bingoForDay(day).stream.length),
  };
}

/**
 * Archive (Plus): the last ARCHIVE_DAYS days of the three daily puzzles, newest first, each
 * opening in its own screen with `?day=`. Without Plus the list shows, locked, with the way in.
 */
export default function Archive() {
  const { t, locale } = useI18n();
  const plus = usePlus().active;
  const today = useMemo(() => dayNumber(), []);
  const days = useMemo(() => Array.from({ length: ARCHIVE_DAYS }, (_, i) => today - 1 - i), [today]);
  const [done, setDone] = useState<Record<number, Done>>({});

  useFocusEffect(
    useCallback(() => {
      let on = true;
      Promise.all(days.map((d) => doneOn(d).then((x) => [d, x] as const))).then((rows) => {
        if (on) setDone(Object.fromEntries(rows));
      });
      return () => {
        on = false;
      };
    }, [days])
  );

  const fmt = (day: number) => {
    if (day === today - 1) return t("archiveYesterday");
    return dateOfDay(day).toLocaleDateString(locale === "tr" ? "tr-TR" : "en-GB", { weekday: "short", day: "numeric", month: "short" });
  };
  const open = (href: string, day: number) => {
    haptic.tap();
    if (!plus) return router.push("/plus");
    router.push(`${href}?day=${day}` as never);
  };

  return (
    <Page>
      <Stack.Screen options={{ title: t("archiveTitle") }} />
      <Text style={T.body}>{t("archiveDesc")}</Text>
      {!plus && (
        <Card style={styles.locked}>
          <Icon name="lock.fill" size={22} color="#3B2A05" />
          <Text style={[T.headline, { flex: 1 }]}>{t("archiveLocked")}</Text>
          <Button title={t("plusName")} kind="gold" small icon="crown.fill" onPress={() => router.push("/plus")} />
        </Card>
      )}
      <View style={{ gap: 10, marginTop: 14 }}>
        {days.map((day) => {
          const d = done[day];
          const match = dailyMatchFor(day).match;
          return (
            <Card key={day} style={styles.row}>
              <View style={styles.head}>
                <Text style={styles.date}>{fmt(day)}</Text>
                <Text style={T.caption}>#{day % 1000}</Text>
              </View>
              <View style={styles.puzzles}>
                <Puzzle image={BRAND.icon.tiki} label={t("archiveGrid")} done={d?.grid} locked={!plus} onPress={() => open("/hat-trick/tek", day)} />
                <Puzzle image={BRAND.icon.practice} label={t("daily")} hint={`${teamName(match.team, locale)} · ${match.season}`} done={d?.xi} locked={!plus} onPress={() => open("/eksik-11/gunluk", day)} />
                <Puzzle image={BRAND.icon.bingo} label={t("bingoName")} done={d?.bingo} locked={!plus} onPress={() => open("/bingo", day)} />
              </View>
            </Card>
          );
        })}
      </View>
    </Page>
  );
}

function Puzzle({ image, label, hint, done, locked, onPress }: { image: ImageSourcePropType; label: string; hint?: string; done?: boolean; locked: boolean; onPress: () => void }) {
  const { t } = useI18n();
  return (
    <Tap onPress={onPress} style={[styles.puzzle, done && styles.puzzleDone]} accessibilityLabel={`${label}${done ? `, ${t("archiveDone")}` : ""}`}>
      <Image source={image} style={{ width: 34, height: 34, opacity: locked && !done ? 0.6 : 1 }} />
      <Text style={styles.puzzleLabel} numberOfLines={1}>
        {label}
      </Text>
      {hint ? (
        <Text style={[T.caption, { fontSize: 11, textAlign: "center" }]} numberOfLines={2}>
          {hint}
        </Text>
      ) : null}
      <View style={[styles.state, done && { backgroundColor: C.greenSoft }]}>
        {done ? <Icon name="checkmark" size={12} color={C.greenDark} fallback="✓" /> : locked ? <Icon name="lock.fill" size={12} color={C.text3} fallback="🔒" /> : <Icon name="play.fill" size={12} color={C.text2} fallback="▶" />}
        <Text style={[styles.stateText, done && { color: C.greenDark }]}>{done ? t("archiveDone") : t("archiveOpen")}</Text>
      </View>
    </Tap>
  );
}

const styles = StyleSheet.create({
  locked: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14, backgroundColor: "#FFF4DC" },
  row: { padding: 12 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingHorizontal: 2 },
  date: { fontFamily: F.display, fontSize: 19, color: C.text, textTransform: "capitalize" },
  puzzles: { flexDirection: "row", gap: 8, marginTop: 10 },
  puzzle: { flex: 1, alignItems: "center", gap: 4, backgroundColor: C.bg, borderRadius: R.inner, padding: 10 },
  puzzleDone: { backgroundColor: "#F3FBF5" },
  puzzleLabel: { fontSize: 13, fontWeight: "800", color: C.text },
  state: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.key, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, marginTop: 2 },
  stateText: { fontSize: 11, fontWeight: "800", color: C.text2 },
});
