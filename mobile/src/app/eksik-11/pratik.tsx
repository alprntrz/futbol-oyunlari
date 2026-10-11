import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";

import { randomMatch, recentMatches } from "@/lib/daily";
import { xiCategoryById } from "@/lib/leagues";
import { matchesOfTeam, teamsWithMatches } from "@/lib/teams";
import type { Difficulty, Match } from "@/lib/types";

import { GameIntro } from "~/components/GameIntro";
import { HelpButton } from "~/components/HelpButton";
import { MissingXIBoard } from "~/components/MissingXIBoard";
import { ResultCard } from "~/components/ResultCard";
import { Text } from "~/components/Text";
import { Page } from "~/components/ui";
import { useI18n } from "~/lib/i18n";
import { T } from "~/lib/theme";
import { useMissingXI } from "~/lib/useMissingXI";

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
