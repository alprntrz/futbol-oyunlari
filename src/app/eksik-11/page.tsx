"use client";

import { useEffect, useMemo, useState } from "react";
import { GameNav } from "@/components/GameNav";
import { Header } from "@/components/Header";
import { HowToPlay } from "@/components/HowToPlay";
import { MissingXIGame, type GameProgress } from "@/components/MissingXIGame";
import { ResultPanel } from "@/components/ResultPanel";
import { dailyMatch } from "@/lib/daily";
import { useI18n } from "@/lib/i18n";
import { loadDayState, recordResult, saveDayState, loadStats, type GameStats } from "@/lib/stats";
import type { Difficulty, SlotState } from "@/lib/types";

export default function DailyPage() {
  const { t } = useI18n();
  const { match, day } = useMemo(() => dailyMatch(), []);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [slots, setSlots] = useState<SlotState[] | null>(null);
  const [progress, setProgress] = useState<GameProgress | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState<GameStats | null>(null);
  const [recorded, setRecorded] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Restore saved state for today — matchId guard: if the dataset grew and
  // today's pick changed, the stale save no longer applies
  useEffect(() => {
    const saved = loadDayState<{
      difficulty: Difficulty;
      slots: SlotState[];
      recorded: boolean;
      matchId?: string;
    }>(day);
    if (saved && saved.matchId === match.id) {
      setDifficulty(saved.difficulty);
      setSlots(saved.slots);
      setRecorded(saved.recorded);
    }
    setStats(loadStats());
    setHydrated(true);
  }, [day, match.id]);

  // Persist on every change
  useEffect(() => {
    if (difficulty && slots) {
      saveDayState(day, { difficulty, slots, recorded, matchId: match.id });
    }
  }, [difficulty, slots, day, recorded, match.id]);

  useEffect(() => {
    if (progress?.done && !recorded) {
      setRecorded(true);
      setStats(recordResult(progress.won, day));
    }
  }, [progress, recorded, day]);

  if (!hydrated) return null;

  return (
    <div className="flex flex-1 flex-col items-center">
      <Header
        right={
          <>
            <button
              onClick={() => setShowHelp(true)}
              className="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs font-bold text-zinc-300 hover:bg-zinc-800"
            >
              ?
            </button>
            <button
              onClick={() => setShowStats(true)}
              className="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs font-bold text-zinc-300 hover:bg-zinc-800"
            >
              📊
            </button>
          </>
        }
      />
      <main className="flex w-full max-w-lg flex-1 flex-col items-center px-3 pb-10">
        <GameNav active="daily" />

        {!difficulty ? (
          <div className="flex w-full flex-col gap-3">
            <button
              onClick={() => setDifficulty("normal")}
              className="rounded-xl bg-indigo-600 p-4 text-left hover:bg-indigo-500"
            >
              <div className="text-lg font-black text-white">{t("normal")}</div>
              <div className="text-sm text-indigo-200">{t("normalDesc")}</div>
            </button>
            <button
              onClick={() => setDifficulty("hard")}
              className="rounded-xl bg-rose-600 p-4 text-left hover:bg-rose-500"
            >
              <div className="text-lg font-black text-white">{t("hard")}</div>
              <div className="text-sm text-rose-200">{t("hardDesc")}</div>
            </button>
          </div>
        ) : (
          <>
            <MissingXIGame
              match={match}
              difficulty={difficulty}
              initialSlots={slots ?? undefined}
              onProgress={setProgress}
              onStateChange={setSlots}
            />
            {progress?.done && slots && (
              <ResultPanel match={match} slots={slots} won={progress.won} day={day % 1000} />
            )}
          </>
        )}
      </main>

      {showHelp && <HowToPlay onClose={() => setShowHelp(false)} />}
      {showStats && stats && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowStats(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-zinc-900 p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-black text-white">{t("stats")}</h2>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                [stats.played, t("played")],
                [stats.played ? Math.round((stats.won / stats.played) * 100) : 0, t("winRate")],
                [stats.streak, t("streak")],
                [stats.bestStreak, t("bestStreak")],
              ].map(([v, label], i) => (
                <div key={i} className="rounded-lg bg-zinc-800 p-2">
                  <div className="text-2xl font-black text-white">{v}</div>
                  <div className="text-[10px] text-zinc-400">{label}</div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowStats(false)}
              className="mt-4 w-full rounded-lg bg-indigo-600 py-2 font-bold text-white"
            >
              {t("close")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
