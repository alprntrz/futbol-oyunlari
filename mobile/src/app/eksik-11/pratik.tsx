import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Text } from "react-native";

import { globalMatches, randomMatch, turkishMatches } from "@/lib/daily";
import type { Difficulty, Match } from "@/lib/types";

import { MissingXIBoard } from "~/components/MissingXIBoard";
import { ResultCard } from "~/components/ResultCard";
import { Screen } from "~/components/Screen";
import { DifficultyPicker } from "~/components/Sheets";
import { useI18n } from "~/lib/i18n";
import { C, F } from "~/lib/theme";
import { useMissingXI } from "~/lib/useMissingXI";

/** Random-match practice; `havuz` = "global" (2005+, non-Turkish) or "turkiye". */
export default function PracticeScreen() {
  const { t } = useI18n();
  const { havuz } = useLocalSearchParams<{ havuz?: string }>();
  const pool = useMemo(() => (havuz === "turkiye" ? turkishMatches() : globalMatches()), [havuz]);
  const [game, setGame] = useState<{ match: Match; difficulty: Difficulty; key: number } | null>(null);

  const start = (difficulty: Difficulty) =>
    setGame((g) => ({ match: randomMatch(g?.match.id, pool), difficulty, key: (g?.key ?? 0) + 1 }));

  return (
    <Screen>
      <Stack.Screen options={{ title: havuz === "turkiye" ? t("turkishTeams") : t("practice") }} />
      {pool.length === 0 ? (
        <Text style={{ color: C.textDim, fontFamily: F.body, marginTop: 40 }}>{t("noMatches")}</Text>
      ) : !game ? (
        <DifficultyPicker onPick={start} />
      ) : (
        <PracticeGame key={game.key} match={game.match} difficulty={game.difficulty} onNext={() => start(game.difficulty)} />
      )}
    </Screen>
  );
}

function PracticeGame({ match, difficulty, onNext }: { match: Match; difficulty: Difficulty; onNext: () => void }) {
  const { slots, progress, guess, giveUp } = useMissingXI(match, difficulty);
  return (
    <>
      <MissingXIBoard
        match={match}
        difficulty={difficulty}
        slots={slots}
        done={progress.done}
        totalGuesses={progress.totalGuesses}
        onGuess={guess}
        onGiveUp={giveUp}
      />
      {progress.done && <ResultCard match={match} slots={slots} won={progress.won} onNewMatch={onNext} />}
    </>
  );
}
