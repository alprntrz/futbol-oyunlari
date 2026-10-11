import { useEffect, useRef, useState } from "react";

import { REWARD } from "~/lib/brand";
import { useI18n } from "~/lib/i18n";
import { addTrophy, loadTrophies } from "~/lib/trophies";

import { Victory } from "./Victory";

/**
 * Hat-trick series finished: the victory (or defeat) ceremony. Counts a trophy
 * once per won series; "Continue" closes it so the last board can be looked at.
 */
export function SeriesEnd({
  over,
  won,
  mine,
  theirs,
  onRematch,
  rematchTitle,
  title,
  countTrophy = true,
}: {
  over: boolean;
  won: boolean;
  mine: number;
  theirs: number;
  /** null: this player can't start the rematch (the host does) */
  onRematch: (() => void) | null;
  rematchTitle?: string;
  /** replaces the won/lost title (same-screen play names the winning mark) */
  title?: string;
  /** false on a shared phone: nobody's trophy to count */
  countTrophy?: boolean;
}) {
  const { t } = useI18n();
  const [trophies, setTrophies] = useState<number | null>(null);
  const [closed, setClosed] = useState(false);
  const counted = useRef(false);

  // a new series re-arms the ceremony (state adjusted during render, not in an effect)
  const [prevOver, setPrevOver] = useState(over);
  if (over !== prevOver) {
    setPrevOver(over);
    if (!over) setClosed(false);
  }

  useEffect(() => {
    if (!over) {
      counted.current = false;
      return;
    }
    if (counted.current) return;
    counted.current = true;
    (won && countTrophy ? addTrophy() : loadTrophies()).then(setTrophies);
  }, [over, won, countTrophy]);

  return (
    <Victory
      visible={over && !closed && trophies !== null}
      won={won}
      title={title ?? (won ? t("vcWon") : t("vcLost"))}
      medal={countTrophy ? (trophies ?? 0) : mine}
      panelTitle={t("vcSummary")}
      rewards={[
        { image: REWARD.series, value: `${mine}-${theirs}`, label: t("vcScore") },
        { image: REWARD.games, value: mine, label: t("vcGames") },
        // a shared phone has no trophy cabinet of its own
        ...(countTrophy ? [{ image: REWARD.trophy, value: trophies ?? 0, label: won ? t("vcTrophyNew") : t("vcTrophies") }] : []),
      ]}
      primary={onRematch ? { title: rematchTitle ?? t("htRematch"), icon: "arrow.clockwise", onPress: () => (setClosed(true), onRematch()) } : { title: t("vcContinue"), onPress: () => setClosed(true) }}
      secondary={onRematch ? { title: t("vcContinue"), onPress: () => setClosed(true) } : undefined}
    />
  );
}
