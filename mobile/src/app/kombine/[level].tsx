import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Modal, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";

import { ALL_CRITERIA } from "@/lib/tiki";

import { ClubShirt } from "~/components/HatTrickBoard";
import { Board, TileFace } from "~/components/kombine/Board";
import { Confetti } from "~/components/motion";
import { Text } from "~/components/Text";
import { Button, Card, Icon } from "~/components/ui";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { goalProgress, lost, newGame, stars, won, type Game, type Goal } from "~/lib/kombine/engine";
import { SEASON } from "~/lib/kombine/levels";
import { saveStars } from "~/lib/kombine/progress";
import { C, F, R, T } from "~/lib/theme";

/** One Kombine matchday. "Next match" swaps the param, so the key starts it fresh. */
export default function KombineMatchScreen() {
  const index = Number(useLocalSearchParams<{ level: string }>().level ?? 0);
  return <KombineMatch key={index} index={index} />;
}

/** Goals and moves up top, the board, and the full-time card. */
function KombineMatch({ index }: { index: number }) {
  // the engine mutates `game` in place; the compiler's memoization would show stale numbers
  "use no memo";
  const { t, locale } = useI18n();
  const { width } = useWindowDimensions();
  const level = SEASON[index] ?? SEASON[0];
  const rival = ALL_CRITERIA.find((c) => c.kind === "club" && c.id === level.rival);
  const [game, setGame] = useState<Game>(() => newGame(level, Math.random));
  const [, setTick] = useState(0);
  const [result, setResult] = useState<"won" | "lost" | null>(null);
  const [earned, setEarned] = useState(0);
  const [confetti, setConfetti] = useState(0);
  const [gameNo, setGameNo] = useState(0);


  const onTurn = () => {
    setTick((n) => n + 1);
    if (won(game)) {
      const s = stars(game);
      setEarned(s);
      saveStars(index, s);
      haptic.success();
      setTimeout(() => {
        setResult("won");
        setConfetti(Date.now());
      }, 350);
    } else if (lost(game)) {
      haptic.warning();
      setTimeout(() => setResult("lost"), 350);
    }
  };

  const retry = () => {
    setResult(null);
    setGame(newGame(level, Math.random));
    setGameNo((n) => n + 1);
  };

  const hasNext = index + 1 < SEASON.length;

  return (
    // not scrollable: vertical swipes belong to the board
    <ScrollView scrollEnabled={false} contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: C.bg }} contentContainerStyle={styles.screen}>
      <Stack.Screen options={{ title: `${t("kbWeek")} ${index + 1}` }} />

      <View style={styles.hud}>
        <View style={styles.vs}>
          {rival && <ClubShirt c={rival} size={24} />}
          <Text style={T.caption} numberOfLines={1}>
            {rival ? (locale === "tr" ? rival.tr : rival.en) : ""}
          </Text>
        </View>
        <View style={styles.moves}>
          <Text style={[styles.movesNum, game.movesLeft <= 3 && { color: C.red }]}>{game.movesLeft}</Text>
          <Text style={styles.movesLabel}>{t("kbMoves")}</Text>
        </View>
        <View style={styles.goals}>
          {level.goals.map((goal, i) => (
            <GoalChip key={i} goal={goal} {...goalProgress(game, goal)} label={t} />
          ))}
        </View>
      </View>

      <Board key={gameNo} game={game} width={width - 24} disabled={!!result} onTurn={onTurn} />

      <Text style={[T.caption, { textAlign: "center", marginTop: 12 }]}>{t("kbHint")}</Text>

      <Modal visible={!!result} transparent animationType="fade" onRequestClose={() => router.back()}>
        <View style={styles.backdrop}>
          <Animated.View entering={ZoomIn.duration(220)}>
            <Card style={styles.result}>
              <Text style={T.caption}>{rival ? (locale === "tr" ? rival.tr : rival.en) : ""}</Text>
              <Text style={styles.resultTitle}>{result === "won" ? t("kbWon") : t("kbLost")}</Text>
              {result === "won" && (
                <View style={{ flexDirection: "row", gap: 6, marginVertical: 4 }}>
                  {[0, 1, 2].map((k) => (
                    <Animated.View key={k} entering={FadeIn.delay(150 + k * 160).duration(200)}>
                      <Icon name="star.fill" size={38} color={k < earned ? "#E0A100" : C.border} fallback="★" />
                    </Animated.View>
                  ))}
                </View>
              )}
              <Text style={T.body}>
                {t("kbScore")}: {game.score}
              </Text>
              <View style={{ alignSelf: "stretch", gap: 10, marginTop: 10 }}>
                {result === "won" && hasNext ? (
                  <Button
                    title={t("kbNext")}
                    icon="play.fill"
                    onPress={() => router.replace({ pathname: "/kombine/[level]", params: { level: String(index + 1) } })}
                  />
                ) : (
                  <Button title={t("kbRetry")} icon="arrow.clockwise" onPress={retry} />
                )}
                <Button title={t("kbSeason")} kind="secondary" onPress={() => router.back()} />
              </View>
            </Card>
          </Animated.View>
        </View>
        <Confetti fire={confetti} />
      </Modal>
    </ScrollView>
  );
}

function GoalChip({ goal, have, need, label }: { goal: Goal; have: number; need: number; label: (k: "kbScore") => string }) {
  const done = have >= need;
  return (
    <View style={[styles.goal, done && styles.goalDone]}>
      {goal.kind === "color" && <TileFace tile={{ id: 0, color: goal.color }} size={24} />}
      {goal.kind === "ball" && <TileFace tile={{ id: 0, color: -1, ball: true }} size={24} />}
      {goal.kind === "mud" && <View style={styles.mudChip} />}
      {goal.kind === "score" && <Text style={styles.goalLabel}>{label("kbScore")}</Text>}
      {done ? (
        <Icon name="checkmark.circle.fill" size={18} color={C.green} fallback="✓" />
      ) : (
        <Text style={styles.goalCount}>{goal.kind === "score" ? `${Math.floor(have / 100) / 10}k/${need / 1000}k` : need - have}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: 12, paddingHorizontal: 12, paddingBottom: 24 },
  hud: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.card, borderRadius: R.card, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  vs: { width: 74, alignItems: "center", gap: 2 },
  moves: { alignItems: "center", backgroundColor: C.greenDark, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 4, minWidth: 64 },
  movesNum: { fontFamily: F.black, fontSize: 32, lineHeight: 36, color: "white" },
  movesLabel: { fontSize: 11, fontWeight: "700", color: "#CDEBD7", textTransform: "uppercase" },
  goals: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "flex-end" },
  goal: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5 },
  goalDone: { backgroundColor: C.greenSoft },
  goalCount: { fontFamily: F.display, fontSize: 20, color: C.text, minWidth: 18, textAlign: "center" },
  goalLabel: { fontSize: 12, fontWeight: "700", color: C.text2 },
  mudChip: { width: 22, height: 22, borderRadius: 6, backgroundColor: "#8A5A2B" },
  backdrop: { flex: 1, backgroundColor: "rgba(11,18,32,0.45)", alignItems: "center", justifyContent: "center", padding: 24 },
  result: { alignItems: "center", gap: 6, paddingVertical: 24, paddingHorizontal: 20, minWidth: 290 },
  resultTitle: { fontFamily: F.black, fontSize: 34, lineHeight: 38, color: C.text, textAlign: "center" },
});
