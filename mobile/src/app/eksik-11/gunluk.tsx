import { Stack } from "expo-router";
import { useEffect, useMemo, useState } from "react";

import { dailyMatch } from "@/lib/daily";
import type { Difficulty, Match } from "@/lib/types";

import { GameIntro } from "~/components/GameIntro";
import { HelpButton } from "~/components/HelpButton";
import { MissingXIBoard } from "~/components/MissingXIBoard";
import { ResultCard } from "~/components/ResultCard";
import { Page } from "~/components/ui";
import { useI18n } from "~/lib/i18n";
import { loadDayState, recordResult, saveDayState, type DayState } from "~/lib/storage";
import { useMissingXI } from "~/lib/useMissingXI";

export default function DailyScreen() {
  const { t } = useI18n();
  const { match, day } = useMemo(() => dailyMatch(), []);
  const [saved, setSaved] = useState<DayState | null | undefined>(undefined);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);

  useEffect(() => {
    // matchId guard: if the dataset changed and today's pick moved, drop the old save
    loadDayState(day).then((s) => {
      const valid = s && s.matchId === match.id ? s : null;
      setSaved(valid);
      if (valid) setDifficulty(valid.difficulty);
    });
  }, [day, match.id]);

  return (
    <Page>
      <Stack.Screen options={{ title: t("daily"), headerRight: () => <HelpButton game="xi" /> }} />
      {saved === undefined ? null : !difficulty ? (
        <GameIntro title={t("daily")} subtitle={t("dailyHeroDesc")} onStart={setDifficulty} />
      ) : (
        <DailyGame match={match} day={day} difficulty={difficulty} saved={saved} />
      )}
    </Page>
  );
}

function DailyGame({ match, day, difficulty, saved }: { match: Match; day: number; difficulty: Difficulty; saved: DayState | null }) {
  const [recorded, setRecorded] = useState(saved?.recorded ?? false);
  const game = useMissingXI(match, difficulty, saved ?? undefined, (won, found) => {
    if (recorded) return;
    setRecorded(true);
    recordResult(won, day, found);
  });
  const { slots, gaveUp, progress } = game;

  useEffect(() => {
    saveDayState(day, { matchId: match.id, difficulty, slots, gaveUp, recorded });
  }, [day, match.id, difficulty, slots, gaveUp, recorded]);

  return (
    <>
      {progress.done && <ResultCard match={match} slots={slots} won={progress.won} day={day % 1000} />}
      <MissingXIBoard
        match={match}
        difficulty={difficulty}
        slots={slots}
        done={progress.done}
        totalGuesses={progress.totalGuesses}
        onGuess={game.guess}
        onGiveUp={game.giveUp}
      />
    </>
  );
}
