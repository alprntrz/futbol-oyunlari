import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, TextInput, View } from "react-native";
import Animated, { FadeIn, Keyframe } from "react-native-reanimated";

import type { GridPlayer } from "@/data/players";
import { dayNumber } from "@/lib/daily";
import { XP } from "@/lib/levels";
import { generateGrid, GRID_PLAYERS, searchPlayers, seededRandom, withHonour, withLink, type Criterion } from "@/lib/tiki";

import { PlayerLine, PlayerToken } from "~/components/PlayerRow";
import { CriterionBadge } from "~/components/HatTrickBoard";
import { HelpButton } from "~/components/HelpButton";
import { useShareCard } from "~/components/ShareCard";
import { Text } from "~/components/Text";
import { Button, Card, Icon, Page, SectionLabel, Segmented, Tap } from "~/components/ui";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { categoryFilter } from "~/lib/league";
import { C, F, R, shadow, T } from "~/lib/theme";
import { useXpAward } from "~/lib/xp";

const TIME_LIMIT = 180;
const key = (day: number) => `hattrick-box-${day}`;

/** Saved daily run: names placed per square, the clock and whether it ended. */
interface Run {
  cells: string[][];
  limit: boolean;
  deadline: number | null;
  finished: boolean;
}

const POP = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.6 }] },
  55: { opacity: 1, transform: [{ scale: 1.04 }] },
  100: { opacity: 1, transform: [{ scale: 1 }] },
}).duration(260);

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const surname = (name: string) => name.trim().split(/\s+/).slice(-1)[0];

/**
 * Single player (Box2Box style): one shared grid a day. Search a footballer and
 * they drop into every square whose row and column they fit; fill all nine, then
 * name as many as you can before the clock runs out.
 */
export default function HatTrickSolo() {
  const { t, locale } = useI18n();
  const { share: shareCard, card: shareView } = useShareCard();
  const day = dayNumber();
  // null = today's shared grid (saved); a number = an extra random grid after it (not saved)
  const [seed, setSeed] = useState<number | null>(null);
  // today's grid stays plain (same for everyone, saved); extra grids may get a "played with" / "managed by" line
  const grid = useMemo(() => {
    const rand = seededRandom(seed ?? day * 7919 + 17);
    // today's grid keeps the old rule (same grid as before the update); extra grids get club pairs
    if (seed === null) return generateGrid(rand);
    // extra grids follow the player's categories (hub → Categories)
    const allow = categoryFilter();
    return withHonour(withLink(generateGrid(rand, { clubPairs: true, allow }), rand, 0.5, undefined, allow), rand, 0.45, undefined, allow);
  }, [day, seed]);
  const [run, setRun] = useState<Run | null | undefined>(undefined);
  const [limit, setLimit] = useState<"3" | "none">("3");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const cellCriteria = (i: number): [Criterion, Criterion] => [grid.rows[Math.floor(i / 3)], grid.cols[i % 3]];
  // How many (player, square) answers exist, for the "% of all answers" score
  const totalAnswers = useMemo(
    () => Array.from({ length: 9 }, (_, i) => cellCriteria(i)).reduce((n, [r, c]) => n + GRID_PLAYERS.filter((p) => r.test(p) && c.test(p)).length, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [grid]
  );

  useEffect(() => {
    AsyncStorage.getItem(key(day))
      .then((raw) => setRun(raw ? (JSON.parse(raw) as Run) : null))
      .catch(() => setRun(null));
  }, [day]);

  useEffect(() => {
    if (run && seed === null) AsyncStorage.setItem(key(day), JSON.stringify(run)).catch(() => {});
  }, [run, day, seed]);

  // Clock: tick while a timed run is live, end it at zero
  useEffect(() => {
    if (!run || run.finished || !run.deadline) return;
    const id = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= run.deadline!) {
        haptic.warning();
        setRun((r) => (r ? { ...r, finished: true } : r));
      }
    }, 250);
    return () => clearInterval(id);
  }, [run]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(id);
  }, [toast]);

  const suggestions = useMemo(() => searchPlayers(query, 6), [query]);

  // today's grid pays once a day; extra grids count towards the practice cap
  const placed = run ? run.cells.reduce((n, c) => n + c.length, 0) : 0;
  const soloBoxes = run ? run.cells.filter((c) => c.length > 0).length : 0;
  useXpAward(!!run?.finished, seed === null ? `ht-solo-${day}` : `ht-solo-x-${seed}`, "ht", Math.min(XP.htSoloCap, placed * XP.htSoloPerPlayer), {
    practice: seed !== null,
    title: t("rwGrid"),
    stats: [
      { label: t("rwSquares"), value: `${soloBoxes}/9`, tone: "green" },
      { label: t("rwPlayers"), value: String(placed), tone: "amber" },
    ],
  });

  if (run === undefined) return <Page>{null}</Page>;

  const start = () => {
    haptic.press();
    setRun({ cells: Array.from({ length: 9 }, () => []), limit: limit === "3", deadline: limit === "3" ? Date.now() + TIME_LIMIT * 1000 : null, finished: false });
  };

  const newGrid = () => {
    haptic.press();
    setQuery("");
    setSeed(Math.floor(Math.random() * 1e9));
    setRun({ cells: Array.from({ length: 9 }, () => []), limit: run?.limit ?? limit === "3", deadline: (run?.limit ?? limit === "3") ? Date.now() + TIME_LIMIT * 1000 : null, finished: false });
  };

  const pick = (p: GridPlayer) => {
    if (!run) return;
    setQuery("");
    const fits = Array.from({ length: 9 }, (_, i) => i).filter((i) => {
      const [r, c] = cellCriteria(i);
      return r.test(p) && c.test(p);
    });
    const fresh = fits.filter((i) => !run.cells[i].includes(p.name));
    if (fits.length === 0) {
      haptic.error();
      return setToast({ text: `${p.name}: ${t("bbWrong")}`, ok: false });
    }
    if (fresh.length === 0) {
      haptic.warning();
      return setToast({ text: `${p.name}: ${t("bbAlready")}`, ok: false });
    }
    haptic.success();
    setToast({ text: `${p.name} +${fresh.length}`, ok: true });
    setRun({ ...run, cells: run.cells.map((names, i) => (fresh.includes(i) ? [...names, p.name] : names)) });
  };

  const label = (c: Criterion) => (locale === "tr" ? c.tr : c.en);

  // ── Start screen
  if (!run) {
    return (
      <Page>
        <Stack.Screen options={{ title: t("htSolo"), headerRight: () => <HelpButton game="tiki" /> }} />
        {/* the header already names the mode */}
        <Text style={T.body}>{t("bbIntro")}</Text>
        <View style={styles.tipRow}>
          <Icon name="lightbulb.fill" size={16} color={C.amber} fallback="💡" />
          <Text style={[T.body, { flex: 1, fontSize: 14 }]}>{t("bbTip")}</Text>
        </View>
        <SectionLabel>{t("bbTime")}</SectionLabel>
        <Segmented
          value={limit}
          onChange={setLimit}
          options={[
            { value: "3", label: t("bbThreeMin") },
            { value: "none", label: t("bbNoLimit") },
          ]}
        />
        <Button title={t("bbKickOff")} icon="play.fill" onPress={start} style={{ marginTop: 24 }} />
      </Page>
    );
  }

  const boxes = run.cells.filter((c) => c.length > 0).length;
  const players = run.cells.reduce((n, c) => n + c.length, 0);
  const percent = totalAnswers ? Math.max(players ? 1 : 0, Math.round((players / totalAnswers) * 100)) : 0;
  const left = run.deadline ? Math.max(0, Math.ceil((run.deadline - now) / 1000)) : null;

  const finish = () =>
    Alert.alert(t("bbFinish"), t("bbFinishConfirm"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("bbFinish"), style: "destructive", onPress: () => setRun({ ...run, finished: true }) },
    ]);

  const share = () => {
    const squares = run.cells.map((c) => (c.length ? "🟩" : "⬜"));
    const rows = [0, 1, 2].map((r) => squares.slice(r * 3, r * 3 + 3).join("")).join("\n");
    shareCard({
      game: "ht",
      name: "Tic-Tac-Toe",
      tag: seed === null ? `#${day % 1000}` : undefined,
      rows: [0, 1, 2].map((r) => run.cells.slice(r * 3, r * 3 + 3).map((c) => (c.length ? "ok" : "empty"))),
      labels: [0, 1, 2].map((r) => run.cells.slice(r * 3, r * 3 + 3).map((c) => (c.length ? String(c.length) : ""))),
      score: `${boxes}/9`,
      detail: `${players} ${t("bbPlayers")}, %${percent}`,
      text: `${t("bbShareText")} #${day % 1000}\n${rows}\n${boxes}/9\n${players} ${t("bbPlayers")}, %${percent}`,
    });
  };

  return (
    <Page>
      <Stack.Screen options={{ title: t("htSolo"), headerRight: () => <HelpButton game="tiki" /> }} />

      {/* Score strip */}
      <Card style={styles.strip}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{left === null ? "∞" : fmt(left)}</Text>
          <Text style={T.caption}>{run.finished && left === 0 ? t("bbTimeUp") : t("bbTime")}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{boxes}/9</Text>
          <Text style={T.caption}>{t("bbBoxes")}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{players}</Text>
          <Text style={T.caption}>{t("bbPlayers")}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>%{percent}</Text>
          <Text style={T.caption}>{t("bbOfAll")}</Text>
        </View>
      </Card>

      {/* Search: no square to pick, the player goes wherever they fit */}
      {!run.finished && (
        <View style={{ zIndex: 5 }}>
          <View style={styles.searchRow}>
            <View style={styles.inputWrap}>
              <Icon name="magnifyingglass" size={16} color={C.text3} fallback="🔎" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => suggestions[0] && pick(suggestions[0])}
                placeholder={t("bbSearch")}
                placeholderTextColor={C.text3}
                autoCorrect={false}
                autoCapitalize="words"
                returnKeyType="done"
                style={styles.input}
              />
            </View>
            <Button title={t("bbFinish")} kind="secondary" onPress={finish} style={{ minHeight: 48 }} />
          </View>
          {query.trim().length >= 2 && (
            <ScrollView style={styles.suggestions} keyboardShouldPersistTaps="handled">
              {suggestions.length === 0 ? (
                <Text style={[T.body, { textAlign: "center", padding: 14 }]}>{t("ttNoResult")}</Text>
              ) : (
                suggestions.map((p, i) => (
                  <Tap key={p.name} onPress={() => pick(p)} style={[styles.suggestion, i > 0 && styles.divider]}>
                    <PlayerToken p={p} />
                    <PlayerLine p={p} />
                  </Tap>
                ))
              )}
            </ScrollView>
          )}
        </View>
      )}

      {toast && (
        <Animated.View entering={FadeIn.duration(120)} style={[styles.toast, { backgroundColor: toast.ok ? C.greenSoft : C.redSoft }]}>
          <Text style={{ color: toast.ok ? C.greenDark : C.red, fontWeight: "700" }}>{toast.text}</Text>
        </Animated.View>
      )}

      {/* Grid */}
      <View style={styles.grid}>
        <View style={styles.row}>
          <View style={styles.corner} />
          {grid.cols.map((c, i) => (
            <View key={i} style={[styles.cell, styles.head]}>
              <CriterionBadge c={c} />
              <Text style={styles.headLabel} numberOfLines={2} adjustsFontSizeToFit>
                {label(c)}
              </Text>
            </View>
          ))}
        </View>
        {grid.rows.map((r, ri) => (
          <View key={ri} style={styles.row}>
            <View style={[styles.corner, styles.head]}>
              <CriterionBadge c={r} />
              <Text style={styles.headLabel} numberOfLines={2} adjustsFontSizeToFit>
                {label(r)}
              </Text>
            </View>
            {grid.cols.map((_, ci) => {
              const names = run.cells[ri * 3 + ci];
              const last = names[names.length - 1];
              return (
                <View key={ci} style={[styles.cell, styles.play, names.length > 0 && styles.filled]}>
                  {last ? (
                    <Animated.View key={last} entering={POP} style={{ alignItems: "center" }}>
                      <Text style={styles.count}>{names.length}</Text>
                      <Text style={styles.name} numberOfLines={1}>
                        {surname(last)}
                      </Text>
                    </Animated.View>
                  ) : (
                    <Icon name="plus" size={18} color="#C3C9D3" fallback="+" />
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </View>

      {run.finished && (
        <Card style={styles.result}>
          <Text style={styles.resultBig}>{players}</Text>
          <Text style={T.caption}>{t("bbPlayersFound")}</Text>
          <View style={styles.resultRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{boxes}/9</Text>
              <Text style={T.caption}>{t("bbBoxesDone")}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>%{percent}</Text>
              <Text style={T.caption}>{t("bbOfAll")}</Text>
            </View>
          </View>
          <Button title={t("ttNewGrid")} icon="arrow.clockwise" onPress={newGrid} style={{ alignSelf: "stretch", marginTop: 8 }} />
          {seed === null && (
            <>
              <Button title={t("share")} icon="square.and.arrow.up" kind="secondary" onPress={share} style={{ alignSelf: "stretch", marginTop: 8 }} />
              <Text style={[T.caption, { marginTop: 8, textAlign: "center" }]}>{t("htSoloExtraLine")}</Text>
            </>
          )}
        </Card>
      )}
      {shareView}
    </Page>
  );
}

const styles = StyleSheet.create({
  tipRow: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginTop: 12, backgroundColor: C.amberSoft, borderRadius: 12, padding: 12 },
  strip: { flexDirection: "row", padding: 12 },
  stat: { flex: 1, alignItems: "center" },
  statValue: { fontFamily: F.display, fontSize: 24, lineHeight: 28, color: C.text, fontVariant: ["tabular-nums"] },
  searchRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  inputWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.card, borderRadius: R.button, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12 },
  input: { flex: 1, paddingVertical: 13, fontSize: 16, color: C.text },
  suggestions: { position: "absolute", top: 66, left: 0, right: 0, maxHeight: 260, backgroundColor: C.card, borderRadius: R.button, borderWidth: 1, borderColor: C.border, ...shadow, shadowOpacity: 0.15 },
  suggestion: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 9 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  toast: { marginTop: 10, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, alignSelf: "center" },
  grid: { width: "100%", gap: 6, marginTop: 14 },
  row: { flexDirection: "row", gap: 6 },
  corner: { flex: 1.1, aspectRatio: 1, borderRadius: 14 },
  cell: { flex: 1, aspectRatio: 1, borderRadius: 14 },
  head: { backgroundColor: C.card, alignItems: "center", justifyContent: "center", gap: 4, padding: 4, ...shadow, shadowOpacity: 0.04 },
  headLabel: { color: C.text2, fontSize: 10, fontWeight: "700", textAlign: "center" },
  play: { backgroundColor: C.card, borderWidth: 2, borderColor: C.border, borderStyle: "dashed", alignItems: "center", justifyContent: "center", padding: 3 },
  filled: { backgroundColor: C.greenSoft, borderColor: C.greenSoft, borderStyle: "solid" },
  count: { fontFamily: F.black, fontSize: 34, lineHeight: 36, color: C.greenDark, textAlign: "center" },
  name: { color: C.text, fontSize: 10, fontWeight: "700", textAlign: "center" },
  result: { marginTop: 18, alignItems: "center", paddingVertical: 20 },
  resultBig: { fontFamily: F.black, fontSize: 56, lineHeight: 58, color: C.text },
  resultRow: { flexDirection: "row", alignSelf: "stretch", marginTop: 14, marginBottom: 8 },
});
