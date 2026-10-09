import { Stack } from "expo-router";
import { useEffect, useMemo, useState } from "react";

import { dailyMatch } from "@/lib/daily";
import type { Difficulty, Match } from "@/lib/types";

import { HeaderIcons } from "~/components/HeaderIcons";
import { MissingXIBoard } from "~/components/MissingXIBoard";
import { ResultCard } from "~/components/ResultCard";
import { Screen } from "~/components/Screen";
import { DifficultyPicker, HowToPlaySheet, StatsSheet } from "~/components/Sheets";
import { useI18n } from "~/lib/i18n";
import { loadDayState, loadStats, recordResult, saveDayState, type DayState, type GameStats } from "~/lib/storage";
import { useMissingXI } from "~/lib/useMissingXI";

export default function DailyScreen() {
  const { t } = useI18n();
  const { match, day } = useMemo(() => dailyMatch(), []);
  const [saved, setSaved] = useState<DayState | null | undefined>(undefined);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [help, setHelp] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [stats, setStats] = useState<GameStats | null>(null);

  useEffect(() => {
    // matchId guard: if the dataset changed and today's pick moved, drop the old save
    loadDayState(day).then((s) => {
      const valid = s && s.matchId === match.id ? s : null;
      setSaved(valid);
      if (valid) setDifficulty(valid.difficulty);
    });
    loadStats().then(setStats);
  }, [day, match.id]);

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: `${t("daily")} #${day % 1000}`,
          headerRight: () => <HeaderIcons onHelp={() => setHelp(true)} onStats={() => setStatsOpen(true)} />,
        }}
      />
      {saved === undefined ? null : !difficulty ? (
        <DifficultyPicker onPick={setDifficulty} />
      ) : (
        <DailyGame match={match} day={day} difficulty={difficulty} saved={saved} onStats={setStats} />
      )}
      <HowToPlaySheet visible={help} onClose={() => setHelp(false)} />
      <StatsSheet stats={stats} visible={statsOpen} onClose={() => setStatsOpen(false)} />
    </Screen>
  );
}

function DailyGame({
  match,
  day,
  difficulty,
  saved,
  onStats,
}: {
  match: Match;
  day: number;
  difficulty: Difficulty;
  saved: DayState | null;
  onStats: (s: GameStats) => void;
}) {
  const [recorded, setRecorded] = useState(saved?.recorded ?? false);
  const game = useMissingXI(match, difficulty, saved ?? undefined, (won) => {
    if (recorded) return;
    setRecorded(true);
    recordResult(won, day).then(onStats);
  });
  const { slots, gaveUp, progress } = game;

  useEffect(() => {
    saveDayState(day, { matchId: match.id, difficulty, slots, gaveUp, recorded });
  }, [day, match.id, difficulty, slots, gaveUp, recorded]);

  return (
    <>
      <MissingXIBoard
        match={match}
        difficulty={difficulty}
        slots={slots}
        done={progress.done}
        totalGuesses={progress.totalGuesses}
        onGuess={game.guess}
        onGiveUp={game.giveUp}
      />
      {progress.done && <ResultCard match={match} slots={slots} won={progress.won} day={day % 1000} />}
    </>
  );
}
