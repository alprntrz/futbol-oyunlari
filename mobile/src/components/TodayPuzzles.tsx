import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect, type Href } from "expo-router";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, View, type ImageSourcePropType } from "react-native";

import { dailyMatch, dayNumber } from "@/lib/daily";
import { generateGrid, seededRandom } from "@/lib/tiki";

import { bingoForDay, CARD_SIZE } from "~/lib/bingo";
import { BRAND } from "~/lib/brand";
import { useI18n } from "~/lib/i18n";
import { loadDayState } from "~/lib/storage";
import { C, F, R, shadow, T } from "~/lib/theme";

import { hoursLeft } from "./DailyCards";
import { CriterionBadge } from "./HatTrickBoard";
import { Text } from "./Text";
import { Card, Icon, OnDark, Tap } from "./ui";

/** Where a daily puzzle stands: not opened, under way (with a count) or finished. */
export type Progress = { state: "new" | "started" | "done"; count: number };
export interface Today {
  grid: Progress & { filled: boolean[] };
  xi: Progress;
  bingo: Progress;
}

const NEW: Progress = { state: "new", count: 0 };
const EMPTY: Today = { grid: { ...NEW, filled: [] }, xi: NEW, bingo: NEW };

async function readJSON<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Reads the three daily saves the game screens write (same keys and rules as those screens). */
export async function loadToday(day: number, xiMatchId: string, bingoLength: number): Promise<Today> {
  const [box, xi, bingo] = await Promise.all([
    readJSON<{ cells: string[][]; finished: boolean }>(`hattrick-box-${day}`),
    loadDayState(day),
    readJSON<{ placed: (string | null)[]; index: number }>(`bingo-${day}`),
  ]);

  const filled = box?.cells.map((c) => c.length > 0) ?? [];
  const gridCount = filled.filter(Boolean).length;
  // an opened-but-empty run still reads as "not played"
  const grid = { filled, count: gridCount, state: box?.finished ? "done" : gridCount ? "started" : "new" } as const;

  let xiP = NEW;
  if (xi && xi.matchId === xiMatchId) {
    const solved = xi.slots.filter((s) => s.solved).length;
    const touched = xi.slots.some((s) => s.guesses.length > 0);
    const done = xi.gaveUp || xi.slots.every((s) => s.solved || s.failed);
    xiP = { count: solved, state: done ? "done" : touched ? "started" : "new" };
  }

  let bingoP = NEW;
  if (bingo) {
    const placed = bingo.placed.filter(Boolean).length;
    const over = placed === CARD_SIZE || bingo.index >= bingoLength;
    bingoP = { count: placed, state: over ? "done" : bingo.index > 0 ? "started" : "new" };
  }

  return { grid, xi: xiP, bingo: bingoP };
}

/**
 * Home's daily block: today's Hat-trick grid, Daily XI and Bingo. The grid gets the
 * big preview card until it's finished, then folds into a row like the other two,
 * so what's still left today is what stands out.
 */
export function TodayPuzzles() {
  const { t } = useI18n();
  const dark = useContext(OnDark);
  const day = useMemo(() => dayNumber(), []);
  // same seeds as the game screens, so the preview is the grid you'll play
  const grid = useMemo(() => generateGrid(seededRandom(day * 7919 + 17)), [day]);
  const xiMatchId = useMemo(() => dailyMatch().match.id, []);
  const bingoLength = useMemo(() => bingoForDay(day).stream.length, [day]);
  const [today, setToday] = useState<Today>(EMPTY);
  const [hours, setHours] = useState(hoursLeft);

  useFocusEffect(
    useCallback(() => {
      loadToday(day, xiMatchId, bingoLength).then(setToday);
      setHours(hoursLeft());
    }, [day, xiMatchId, bingoLength])
  );
  useEffect(() => {
    const id = setInterval(() => setHours(hoursLeft()), 60000);
    return () => clearInterval(id);
  }, []);

  const doneCount = [today.grid, today.xi, today.bingo].filter((p) => p.state === "done").length;
  const cta = (p: Progress) => (p.state === "new" ? t("play") : t("continueGame"));
  const gridStatus = (p: Progress) =>
    p.state === "new" ? t("homeNotPlayed") : p.state === "done" ? `${t("homeDone")}: ${p.count}/9` : `${p.count}/9 ${t("homeFilledOf")}`;
  const counted = (p: Progress, text: string) => {
    const n = text.replace("{n}", String(p.count));
    return p.state === "new" ? t("homeNotPlayed") : p.state === "done" ? `${t("homeDone")}: ${n}` : n;
  };

  const rows: { key: string; title: string; status: string; p: Progress; image: ImageSourcePropType; href: Href }[] = [
    { key: "xi", title: t("daily"), status: counted(today.xi, t("homeXiFound")), p: today.xi, image: BRAND.icon.daily, href: "/eksik-11/gunluk" },
    { key: "bingo", title: t("bingoName"), status: counted(today.bingo, t("homeBingoFilled")), p: today.bingo, image: BRAND.icon.bingo, href: "/bingo" },
  ];
  const gridDone = today.grid.state === "done";
  // a finished grid joins the list, last: what's left comes first
  if (gridDone) rows.push({ key: "grid", title: t("homeTodayGrid"), status: gridStatus(today.grid), p: today.grid, image: BRAND.icon.tiki, href: "/hat-trick/tek" });
  rows.sort((a, b) => Number(a.p.state === "done") - Number(b.p.state === "done"));

  return (
    <View style={{ marginTop: 22 }}>
      <View style={styles.head}>
        <Text style={[T.heading, dark && { color: "white" }]}>{t("homePuzzles")}</Text>
        <Text style={[T.caption, dark && { color: "rgba(255,255,255,0.8)" }, doneCount === 3 && { color: dark ? "#9BE15D" : C.greenDark, fontWeight: "700" }]}>
          {doneCount === 3 ? t("homeNewIn").replace("{h}", String(hours)) : t("homePuzzlesDone").replace("{n}", String(doneCount))}
        </Text>
      </View>

      {!gridDone && (
        <Tap
          onPress={() => router.push("/hat-trick/tek")}
          style={styles.hero}
          accessibilityLabel={`${t("homeTodayGrid")}. ${gridStatus(today.grid)}`}
          accessibilityHint={cta(today.grid)}
        >
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>{t("homeTodayGrid")}</Text>
            <Text style={styles.heroStatus}>{gridStatus(today.grid)}</Text>
            <View style={styles.cta}>
              <Icon name="play.fill" size={13} color={HERO} fallback="▶" />
              <Text style={styles.ctaText}>{cta(today.grid)}</Text>
            </View>
          </View>

          {/* The real grid for today: column headers, row headers, 3×3 squares */}
          <View style={styles.board}>
            <View style={styles.boardRow}>
              <View style={styles.cell} />
              {grid.cols.map((c) => (
                <View key={c.id} style={styles.cell}>
                  <CriterionBadge c={c} size={26} />
                </View>
              ))}
            </View>
            {grid.rows.map((r, ri) => (
              <View key={r.id} style={styles.boardRow}>
                <View style={styles.cell}>
                  <CriterionBadge c={r} size={26} />
                </View>
                {grid.cols.map((c, ci) => (
                  <View key={c.id} style={[styles.square, today.grid.filled[ri * 3 + ci] && styles.squareFilled]}>
                    {today.grid.filled[ri * 3 + ci] && <Icon name="checkmark" size={14} color="white" fallback="✓" />}
                  </View>
                ))}
              </View>
            ))}
          </View>
        </Tap>
      )}

      <Card style={styles.list}>
        {rows.map((r, i) => {
          const done = r.p.state === "done";
          return (
            <Tap
              key={r.key}
              onPress={() => router.push(r.href)}
              style={[styles.row, i > 0 && styles.rowBorder]}
              accessibilityLabel={`${r.title}. ${r.status}`}
              accessibilityHint={done ? t("seeResult") : cta(r.p)}
            >
              <Image source={r.image} style={[styles.icon, done && { opacity: 0.55 }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, done && { color: C.text3 }]} numberOfLines={1}>
                  {r.title}
                </Text>
                <Text style={[T.caption, done && { color: C.greenDark }]} numberOfLines={1}>
                  {r.status}
                </Text>
              </View>
              {done ? (
                <View style={styles.tick}>
                  <Icon name="checkmark" size={15} color="white" fallback="✓" />
                </View>
              ) : (
                <View style={styles.play}>
                  <Icon name="play.fill" size={11} color="white" fallback="▶" />
                  <Text style={styles.playText}>{cta(r.p)}</Text>
                </View>
              )}
            </Tap>
          );
        })}
      </Card>
    </View>
  );
}

const SQUARE = 34;
const HERO = "#1F3B8C";

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10, marginHorizontal: 2 },

  hero: { borderRadius: 24, padding: 16, backgroundColor: HERO, flexDirection: "row", gap: 12, marginBottom: 10, ...shadow, shadowOpacity: 0.18 },
  heroText: { flex: 1, justifyContent: "space-between" },
  heroTitle: { fontFamily: F.black, fontSize: 28, lineHeight: 29, color: "white" },
  heroStatus: { fontSize: 13, fontWeight: "600", color: "#DCE5FD", marginTop: 6 },
  cta: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "white",
    borderRadius: R.button,
    paddingVertical: 10,
  },
  ctaText: { fontFamily: F.display, fontSize: 19, color: HERO },

  board: { gap: 4, alignSelf: "center" },
  boardRow: { flexDirection: "row", gap: 4 },
  cell: { width: SQUARE, height: SQUARE, alignItems: "center", justifyContent: "center" },
  square: { width: SQUARE, height: SQUARE, borderRadius: 9, backgroundColor: "#2A4AA6", alignItems: "center", justifyContent: "center" },
  squareFilled: { backgroundColor: C.greenMid },

  list: { paddingVertical: 4, paddingHorizontal: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  icon: { width: 40, height: 40 },
  rowTitle: { fontFamily: F.display, fontSize: 18, color: C.text },
  tick: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.green, alignItems: "center", justifyContent: "center" },
  play: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.greenMid, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  playText: { fontFamily: F.display, fontSize: 15, color: "white" },
});
