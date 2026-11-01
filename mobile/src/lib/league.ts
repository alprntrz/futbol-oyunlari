import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

import { leagueById, leagueGrid, type LeagueId } from "@/lib/leagues";
import { allowOf, generateGrid, GRID_CATEGORIES, withHonour, withLink, type Grid, type GridCategory } from "@/lib/tiki";

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

const CAT_KEY = "ht-categories";
let categories: GridCategory[] = [...GRID_CATEGORIES];
const catListeners = new Set<(c: GridCategory[]) => void>();
AsyncStorage.getItem(CAT_KEY)
  .then((v) => {
    if (!v) return;
    categories = (JSON.parse(v) as string[]).filter((c): c is GridCategory => (GRID_CATEGORIES as string[]).includes(c));
    catListeners.forEach((f) => f(categories));
  })
  .catch(() => {});

/** The grid categories switched on (Tic-Tac-Toe hub → Categories); grids this phone deals follow them. */
export function useHtCategories(): [GridCategory[], (c: GridCategory[]) => void] {
  const [cats, setCats] = useState<GridCategory[]>(categories);
  useEffect(() => {
    catListeners.add(setCats);
    return () => {
      catListeners.delete(setCats);
    };
  }, []);
  const set = (c: GridCategory[]) => {
    categories = c;
    catListeners.forEach((f) => f(c));
    AsyncStorage.setItem(CAT_KEY, JSON.stringify(c)).catch(() => {});
  };
  return [cats, set];
}
/** the filter for this phone's categories (undefined: all on) */
export const categoryFilter = () => allowOf(categories);

/**
 * A grid for the league (falls back to all clubs if one can't be made). Half the
 * time one line is a "played with" star or a "managed by" coach; `mates: false`
 * for a room with a phone on an older app that doesn't know those criteria.
 */
export const dealGrid = (league: LeagueId | string | undefined, mates = true): Grid => {
  const allow = categoryFilter();
  const local = league && league !== "all" ? leagueGrid(league as LeagueId, Math.random, allow) : null;
  const grid = local ?? generateGrid(Math.random, { clubPairs: true, allow });
  // the all-clubs grid only deals world-class names; a league grid its own (local ones too)
  if (!mates) return grid;
  // and often an honour line ("2+ Champions League titles", "Born in the 1990s"…), the league's own titles first
  return withHonour(withLink(grid, Math.random, 0.5, local ? leagueById(league).clubs : undefined, allow), Math.random, 0.45, local ? (league as string) : undefined, allow);
};
