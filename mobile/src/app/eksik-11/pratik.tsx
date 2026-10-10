import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Text } from "react-native";

import { globalMatches, randomMatch, turkishMatches } from "@/lib/daily";
import type { Difficulty, Match } from "@/lib/types";

import { GameIntro } from "~/components/GameIntro";
import { HelpButton } from "~/components/HelpButton";
import { MissingXIBoard } from "~/components/MissingXIBoard";
import { ResultCard } from "~/components/ResultCard";
import { Page } from "~/components/ui";
import { useI18n } from "~/lib/i18n";
import { T } from "~/lib/theme";
import { useMissingXI } from "~/lib/useMissingXI";

/** Random-match practice; `havuz` = "global" (2005+, non-Turkish) or "turkiye". */
export default function PracticeScreen() {
  const { t } = useI18n();
  const { havuz } = useLocalSearchParams<{ havuz?: string }>();
  const turkish = havuz === "turkiye";
  const pool = useMemo(() => (turkish ? turkishMatches() : globalMatches()), [turkish]);
  const [game, setGame] = useState<{ match: Match; difficulty: Difficulty; key: number } | null>(null);
  const title = turkish ? t("turkishTeams") : t("practice");

  const start = (difficulty: Difficulty) =>
    setGame((g) => ({ match: randomMatch(g?.match.id, pool), difficulty, key: (g?.key ?? 0) + 1 }));

  return (
    <Page>
      <Stack.Screen options={{ title, headerRight: () => <HelpButton game="xi" /> }} />
      {pool.length === 0 ? (
        <Text style={[T.body, { textAlign: "center", marginTop: 40 }]}>{t("noMatches")}</Text>
      ) : !game ? (
        <GameIntro title={title} subtitle={turkish ? t("turkishDesc") : t("practiceDesc")} onStart={start} />
      ) : (
        <PracticeGame key={game.key} match={game.match} difficulty={game.difficulty} onNext={() => start(game.difficulty)} />
      )}
    </Page>
  );
}

function PracticeGame({ match, difficulty, onNext }: { match: Match; difficulty: Difficulty; onNext: () => void }) {
  const { slots, progress, guess, giveUp } = useMissingXI(match, difficulty);
  return (
    <>
      {progress.done && <ResultCard match={match} slots={slots} won={progress.won} onNewMatch={onNext} />}
      <MissingXIBoard
        match={match}
        difficulty={difficulty}
        slots={slots}
        done={progress.done}
        totalGuesses={progress.totalGuesses}
        onGuess={guess}
        onGiveUp={giveUp}
      />
    </>
  );
}
