import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

import { leagueGrid, type LeagueId } from "@/lib/leagues";
import { generateGrid, withLink, type Grid } from "@/lib/tiki";

const KEY = "ht-league";
let current: LeagueId = "all";
const listeners = new Set<(l: LeagueId) => void>();

/** The Hat-trick league picked on the hub; every mode deals its grids from it. */
export function useHtLeague(): [LeagueId, (l: LeagueId) => void] {
  const [league, setLeague] = useState<LeagueId>(current);
  useEffect(() => {
    listeners.add(setLeague);
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v && v !== current) {
          current = v as LeagueId;
          listeners.forEach((f) => f(current));
        }
      })
      .catch(() => {});
    return () => {
      listeners.delete(setLeague);
    };
  }, []);
  const set = (l: LeagueId) => {
    current = l;
    listeners.forEach((f) => f(l));
    AsyncStorage.setItem(KEY, l).catch(() => {});
  };
  return [league, set];
}

/**
 * A grid for the league (falls back to all clubs if one can't be made). Half the
 * time one line is a "played with" star or a "managed by" coach; `mates: false`
 * for a room with a phone on an older app that doesn't know those criteria.
 */
export const dealGrid = (league: LeagueId | string | undefined, mates = true): Grid => {
  const grid = (league && league !== "all" ? leagueGrid(league as LeagueId) : null) ?? generateGrid();
  return mates ? withLink(grid) : grid;
};
