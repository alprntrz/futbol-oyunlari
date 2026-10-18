import { Redirect, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";

import { dailyMatch, dailyMatchFor } from "@/lib/daily";
import { XP } from "@/lib/levels";
import type { Difficulty, Match } from "@/lib/types";

import { GameIntro } from "~/components/GameIntro";
import { HelpButton } from "~/components/HelpButton";
import { useCombo } from "~/components/Combo";
import { MissingXIBoard } from "~/components/MissingXIBoard";
import { ResultCard } from "~/components/ResultCard";
import { Page } from "~/components/ui";
import { archiveDay } from "~/lib/archive";
import { useI18n } from "~/lib/i18n";
import { usePlus } from "~/lib/plus";
import { loadDayState, recordResult, saveDayState, type DayState } from "~/lib/storage";
import { useMissingXI } from "~/lib/useMissingXI";
import { useQuestOnce } from "~/lib/quests";
import { useXpAward, type XpStat } from "~/lib/xp";

export default function DailyScreen() {
  const { t } = useI18n();
  // ?day=N: a past day's match from the archive (Plus); otherwise today's
  const past = archiveDay(useLocalSearchParams<{ day?: string }>().day);
  const plus = usePlus().active;
  const { match, day } = useMemo(() => (past !== null ? dailyMatchFor(past) : dailyMatch()), [past]);
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

  if (past !== null && !plus) return <Redirect href="/plus" />;
  return (
    <Page>
      <Stack.Screen options={{ title: past !== null ? `${t("daily")} #${day % 1000}` : t("daily"), headerRight: () => <HelpButton game="xi" /> }} />
      {saved === undefined ? null : !difficulty ? (
        <GameIntro subtitle={t("dailyHeroDesc")} onStart={setDifficulty} />
      ) : (
        <DailyGame match={match} day={day} difficulty={difficulty} saved={saved} />
      )}
    </Page>
  );
}

function DailyGame({ match, day, difficulty, saved }: { match: Match; day: number; difficulty: Difficulty; saved: DayState | null }) {
  const { t } = useI18n();
  const [recorded, setRecorded] = useState(saved?.recorded ?? false);
  const game = useMissingXI(match, difficulty, saved ?? undefined, (won, found) => {
    if (recorded) return;
    setRecorded(true);
    recordResult(won, day, found);
  });
  const { slots, gaveUp, progress } = game;
  // keyed by day: reopening a finished day pays nothing more
  const { combo, best } = useCombo(progress.totalGuesses, progress.solved);
  useXpAward(progress.done, `xi-daily-${day}`, "xi", progress.solved * XP.xiPerPlayer + (progress.won ? XP.xiFullTeam : 0) + best * XP.comboStep + XP.xiDailyBonus, {
    
    title: progress.won ? t("rwFullXi") : t("rwDone"),
    stats: xiStats(t, progress.solved, progress.totalGuesses, best),
  });
  useQuestOnce(progress.done, `xi-daily-${day}`, [
    ["xi_finish", 1],
    ["xi_players", progress.solved],
  ]);

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
        combo={combo}
        onGiveUp={game.giveUp}
      />
    </>
  );
}

/** Reward-screen tiles for a finished Missing 11 game. */
function xiStats(t: ReturnType<typeof useI18n>["t"], solved: number, guesses: number, best: number): XpStat[] {
  return [
    { label: t("rwFound"), value: `${solved}/11`, tone: "green" },
    { label: t("rwBestCombo"), value: `x${best}`, tone: "amber" },
    { label: t("rwGuesses"), value: String(guesses), tone: "blue" },
  ];
}
