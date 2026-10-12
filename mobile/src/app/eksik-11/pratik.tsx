import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";

import { randomMatch, recentMatches } from "@/lib/daily";
import { xiCategoryById } from "@/lib/leagues";
import { XP } from "@/lib/levels";
import { matchesOfTeam, teamsWithMatches } from "@/lib/teams";
import type { Difficulty, Match } from "@/lib/types";

import { GameIntro } from "~/components/GameIntro";
import { HelpButton } from "~/components/HelpButton";
import { useCombo } from "~/components/Combo";
import { MissingXIBoard } from "~/components/MissingXIBoard";
import { ResultCard } from "~/components/ResultCard";
import { Text } from "~/components/Text";
import { Page } from "~/components/ui";
import { useI18n } from "~/lib/i18n";
import { T } from "~/lib/theme";
import { useMissingXI } from "~/lib/useMissingXI";
import { useQuestOnce } from "~/lib/quests";
import { useXpAward, type XpStat } from "~/lib/xp";

/** Random-match practice: every match since 2005, or one team's matches (`takim`). */
export default function PracticeScreen() {
  const { t, locale } = useI18n();
  const { takim, kategori } = useLocalSearchParams<{ takim?: string; kategori?: string }>();
  const category = kategori && kategori !== "all" ? xiCategoryById(kategori) : null;
  const pool = useMemo(() => (takim ? matchesOfTeam(takim) : category ? category.matches() : recentMatches()), [takim, category]);
  const teamLabel = useMemo(() => {
    if (!takim) return null;
    const team = teamsWithMatches(1).find((tm) => tm.name === takim);
    return locale === "en" ? (team?.en ?? takim) : takim;
  }, [takim, locale]);
  const [game, setGame] = useState<{ match: Match; difficulty: Difficulty; key: number } | null>(null);
  const title = teamLabel ?? (category ? category.name[locale] : t("practice"));

  const start = (difficulty: Difficulty) =>
    setGame((g) => ({ match: randomMatch(g?.match.id, pool), difficulty, key: (g?.key ?? 0) + 1 }));

  return (
    <Page>
      <Stack.Screen options={{ title, headerRight: () => <HelpButton game="xi" /> }} />
      {pool.length === 0 ? (
        <Text style={[T.body, { textAlign: "center", marginTop: 40 }]}>{t("noMatches")}</Text>
      ) : !game ? (
        <GameIntro
          title={title}
          subtitle={teamLabel || category ? `${pool.length} ${t("matchesWord")}` : t("practiceAllDesc")}
          onStart={start}
        />
      ) : (
        <PracticeGame key={game.key} match={game.match} difficulty={game.difficulty} onNext={() => start(game.difficulty)} />
      )}
    </Page>
  );
}

function PracticeGame({ match, difficulty, onNext }: { match: Match; difficulty: Difficulty; onNext: () => void }) {
  const { t } = useI18n();
  const { slots, progress, guess, giveUp } = useMissingXI(match, difficulty);
  const [gameId] = useState(() => `xi-p-${match.id}-${Date.now()}`);
  const { combo, best } = useCombo(progress.totalGuesses, progress.solved);
  useXpAward(progress.done, gameId, "xi", progress.solved * XP.xiPerPlayer + (progress.won ? XP.xiFullTeam : 0) + best * XP.comboStep, {
    practice: true,
    title: progress.won ? t("rwFullXi") : t("rwDone"),
    stats: xiStats(t, progress.solved, progress.totalGuesses, best),
  });
  useQuestOnce(progress.done, gameId, [
    ["xi_finish", 1],
    ["xi_players", progress.solved],
  ]);
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
        combo={combo}
        onGiveUp={giveUp}
        onNext={onNext}
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
