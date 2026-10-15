import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Share, StyleSheet, TextInput, View } from "react-native";
import Animated, { Keyframe } from "react-native-reanimated";

import { dayNumber } from "@/lib/daily";
import { XP } from "@/lib/levels";
import { searchPlayers, type Criterion } from "@/lib/tiki";

import { SOFT_IN } from "~/components/motion";
import { CriterionBadge } from "~/components/HatTrickBoard";
import { Text } from "~/components/Text";
import { Button, Card, Icon, Page, SectionLabel, Tap } from "~/components/ui";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { compare, findPlayer, MAX_GUESSES, mysteryForDay, randomMystery, START_CLUES, type Clue, type Puzzle } from "~/lib/mystery";
import { C, F, R, T } from "~/lib/theme";
import { useQuestOnce } from "~/lib/quests";
import { useXpAward } from "~/lib/xp";

type Mode = "daily" | "free";
interface Run {
  guesses: string[];
  hints: number;
}
const fresh = (): Run => ({ guesses: [], hints: 0 });
const key = (day: number) => `mystery-${day}`;

/** A clue opening: a light settle, no bounce. */
const OPEN = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.96 }] },
  100: { opacity: 1, transform: [{ scale: 1 }] },
}).duration(220);

/** Mystery Player: name the footballer from clues that open one at a time. */
export default function MysteryPlayer() {
  const { t, locale } = useI18n();
  const day = useMemo(() => dayNumber(), []);
  const daily = useMemo(() => mysteryForDay(day), [day]);
  const [mode, setMode] = useState<Mode>("daily");
  const [free, setFree] = useState<Puzzle>(randomMystery);
  const [runs, setRuns] = useState<Record<Mode, Run>>({ daily: fresh(), free: fresh() });
  const [input, setInput] = useState("");

  const puzzle = mode === "daily" ? daily : free;
  const run = runs[mode];
  const answer = puzzle.player;
  const won = run.guesses.includes(answer.name);
  const spent = run.guesses.length + run.hints;
  const left = MAX_GUESSES - spent;
  const over = won || left <= 0;
  const open = over ? puzzle.clues.length : Math.min(START_CLUES + spent, puzzle.clues.length);
  const label = (c: Criterion) => (locale === "tr" ? c.tr : c.en);

  // the daily puzzle pays once a day; free puzzles count towards the practice cap
  useXpAward(
    over,
    mode === "daily" ? `mystery-${day}` : `mystery-free-${day}-${answer.name}`,
    "mystery",
    won ? XP.mysteryWin + Math.max(0, MAX_GUESSES - spent) * XP.mysteryPerSpareGuess : XP.mysteryLoss,
    {
      practice: mode === "free",
      title: won ? t("rwSolved") : t("rwDone"),
      stats: [{ label: t("rwTries"), value: won ? `${spent}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`, tone: won ? "green" : "coral" }],
    }
  );
  useQuestOnce(over && won, mode === "daily" ? `mystery-${day}` : `mystery-free-${day}-${answer.name}`, [["mystery_solve", 1]]);
  const suggestions = useMemo(() => (input.trim().length >= 2 ? searchPlayers(input).slice(0, 5) : []), [input]);

  // Today's run survives leaving the screen
  useEffect(() => {
    AsyncStorage.getItem(key(day))
      .then((raw) => raw && setRuns((r) => ({ ...r, daily: JSON.parse(raw) as Run })))
      .catch(() => {});
  }, [day]);

  const update = (next: Run) => {
    setRuns((r) => ({ ...r, [mode]: next }));
    if (mode === "daily") AsyncStorage.setItem(key(day), JSON.stringify(next)).catch(() => {});
  };

  const guess = (name: string) => {
    if (over || run.guesses.includes(name)) return;
    setInput("");
    if (name === answer.name) haptic.success();
    else haptic.error();
    update({ ...run, guesses: [...run.guesses, name] });
  };

  const hint = () => {
    haptic.tap();
    update({ ...run, hints: run.hints + 1 });
  };

  const nextFree = () => {
    setFree(randomMystery());
    setRuns((r) => ({ ...r, free: fresh() }));
    setInput("");
  };

  const share = () => {
    const marks = run.guesses.map((g) => (g === answer.name ? "🟩" : "🟥")).join("") + "⬜".repeat(run.hints);
    Share.share({ message: `${t("myName")} #${day % 1000}\n${marks}\n${won ? `${spent}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`}` });
  };

  const clueText = (c: Clue) =>
    c.kind === "criterion" ? label(c.c) : c.kind === "badges" ? c.cs.map(label).join(", ") : c.pattern;
  const clueKind = (c: Clue) =>
    c.kind === "letters" ? t("myLetters") : c.kind === "badges" ? t("myHonours") : c.c.kind === "country" ? t("myCountry") : t("myClub");

  return (
    <Page>
      <Stack.Screen options={{ title: t("myName") }} />

      <View style={styles.head}>
        <Text style={T.title}>{mode === "daily" ? t("myDailyTitle") : t("myFree")}</Text>
        <View style={styles.dots} accessibilityLabel={`${Math.max(left, 0)} ${t("myLeft")}`}>
          {Array.from({ length: MAX_GUESSES }, (_, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i < spent ? (won && i === spent - 1 ? C.green : C.border) : C.greenMid }]} />
          ))}
        </View>
      </View>
      <Text style={[T.body, { marginTop: 4 }]}>{t("myIntro")}</Text>

      {/* Clues: opened ones in full, the rest as locked slots so you can see what's coming */}
      <View style={styles.clues}>
        {puzzle.clues.slice(0, open).map((c, i) => (
          <Animated.View key={`${mode}-${i}`} entering={OPEN} style={styles.clue}>
            <View style={styles.clueIcon}>
              {c.kind === "criterion" ? (
                <CriterionBadge c={c.c} size={26} />
              ) : c.kind === "badges" ? (
                <CriterionBadge c={c.cs[0]} size={26} />
              ) : (
                <Icon name="textformat.abc" size={22} color={C.text2} fallback="Aa" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={T.caption}>{clueKind(c)}</Text>
              <Text style={c.kind === "letters" ? styles.letters : styles.clueText}>{clueText(c)}</Text>
            </View>
          </Animated.View>
        ))}
        {open < puzzle.clues.length && (
          <View style={styles.lockedRow} accessibilityLabel={`${puzzle.clues.length - open} ${t("myLocked")}`}>
            {puzzle.clues.slice(open).map((c, i) => (
              <View key={i} style={styles.lockedPill}>
                <Icon name="lock.fill" size={11} color={C.text3} fallback="🔒" />
                <Text style={styles.lockedText}>{clueKind(c)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {over ? (
        <Animated.View entering={SOFT_IN}>
          <Card style={[styles.result, { backgroundColor: won ? C.greenSoft : C.redSoft }]}>
            <Text style={[T.caption, { fontWeight: "700" }]}>{won ? t("myWon") : t("myLost")}</Text>
            <Text style={styles.answer}>{answer.name}</Text>
            {won && (
              <Text style={T.body}>
                {spent}/{MAX_GUESSES}
              </Text>
            )}
            <View style={{ flexDirection: "row", gap: 10, alignSelf: "stretch", marginTop: 6 }}>
              {mode === "daily" ? (
                <>
                  <Button title={t("myAnother")} icon="arrow.clockwise" onPress={() => (setMode("free"), nextFree())} style={{ flex: 1 }} />
                  <Button title={t("share")} icon="square.and.arrow.up" kind="secondary" onPress={share} style={{ flex: 1 }} />
                </>
              ) : (
                <Button title={t("myNext")} icon="arrow.clockwise" onPress={nextFree} style={{ flex: 1 }} />
              )}
            </View>
            {mode === "daily" && <Text style={T.caption}>{t("myTomorrow")}</Text>}
          </Card>
        </Animated.View>
      ) : (
        <View style={{ marginTop: 16 }}>
          <View style={styles.inputWrap}>
            <Icon name="magnifyingglass" size={16} color={C.text3} fallback="🔎" />
            <TextInput
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => suggestions.length === 1 && guess(suggestions[0].name)}
              placeholder={t("ttPlaceholder")}
              placeholderTextColor={C.text3}
              autoCorrect={false}
              autoCapitalize="words"
              returnKeyType="done"
              style={styles.input}
            />
          </View>
          {input.trim().length >= 2 && (
            <View style={styles.suggestions}>
              {suggestions.length === 0 ? (
                <Text style={[T.body, { textAlign: "center", padding: 12 }]}>{t("ttNoResult")}</Text>
              ) : (
                suggestions.map((p, i) => {
                  const tried = run.guesses.includes(p.name);
                  return (
                    <Tap key={p.name} disabled={tried} onPress={() => guess(p.name)} style={[styles.suggestion, i > 0 && styles.divider, tried && { opacity: 0.4 }]}>
                      <Text style={[T.headline, { flex: 1, fontSize: 15 }]}>{p.name}</Text>
                      {tried && <Icon name="xmark" size={13} color={C.text3} fallback="×" />}
                    </Tap>
                  );
                })
              )}
            </View>
          )}
          <Button
            title={t("myHint")}
            icon="lightbulb"
            kind="secondary"
            disabled={open >= puzzle.clues.length || left <= 1}
            onPress={hint}
            style={{ marginTop: 12 }}
          />
        </View>
      )}

      {run.guesses.some((g) => g !== answer.name) && (
        <>
          <SectionLabel>{t("myGuesses")}</SectionLabel>
          <View style={{ gap: 8 }}>
            {run.guesses
              .filter((g) => g !== answer.name)
              .map((g) => {
                const p = findPlayer(g);
                const f = p ? compare(p, answer) : null;
                return (
                  <Animated.View key={g} entering={SOFT_IN} style={styles.guess}>
                    <Icon name="xmark.circle.fill" size={18} color={C.red} fallback="×" />
                    <Text style={[T.headline, { flex: 1, fontSize: 15 }]} numberOfLines={1}>
                      {g}
                    </Text>
                    {f?.country && (
                      <View style={[styles.hit, f.sameCountry && styles.hitOn]} accessibilityLabel={f.sameCountry ? t("mySameCountry") : t("myOtherCountry")}>
                        <CriterionBadge c={f.country} size={16} />
                      </View>
                    )}
                    {f?.shared.map((c) => (
                      <View key={c.id} style={[styles.hit, styles.hitOn]} accessibilityLabel={`${t("myShared")}: ${label(c)}`}>
                        <CriterionBadge c={c} size={16} />
                      </View>
                    ))}
                  </Animated.View>
                );
              })}
          </View>
          <Text style={[T.caption, { marginTop: 8 }]}>{t("myFeedbackHint")}</Text>
        </>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18 },
  dots: { flexDirection: "row", gap: 6 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  clues: { marginTop: 14, gap: 8 },
  clue: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderRadius: R.card, borderWidth: 1, borderColor: C.border, padding: 10, minHeight: 58 },
  lockedRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 },
  lockedPill: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderStyle: "dashed", borderColor: C.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  lockedText: { fontSize: 13, fontWeight: "600", color: C.text3 },
  clueIcon: { width: 44, height: 38, borderRadius: 10, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
  clueText: { fontFamily: F.display, fontSize: 20, lineHeight: 22, color: C.text },
  letters: { fontFamily: F.display, fontSize: 22, lineHeight: 26, color: C.text, letterSpacing: 1 },
  result: { marginTop: 16, alignItems: "center", gap: 6, paddingVertical: 20 },
  answer: { fontFamily: F.black, fontSize: 32, lineHeight: 36, color: C.text, textAlign: "center" },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.card, borderRadius: R.button, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12 },
  input: { flex: 1, paddingVertical: 13, fontSize: 16, color: C.text },
  suggestions: { marginTop: 8, backgroundColor: C.card, borderRadius: R.button, borderWidth: 1, borderColor: C.border, overflow: "hidden" },
  suggestion: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  guess: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.card, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  hit: { width: 30, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: C.bg, opacity: 0.45 },
  hitOn: { backgroundColor: C.greenSoft, opacity: 1 },
});
