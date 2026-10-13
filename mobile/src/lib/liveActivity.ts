import { useEffect, useState } from "react";
import { Platform } from "react-native";
import type { LiveActivity, LiveActivityDismissalPolicy, LiveActivityFactory } from "expo-widgets";

import type { Mark } from "~/lib/hattrick";
import { useI18n } from "~/lib/i18n";
import type { MatchActivityProps } from "~/widgets/MatchActivity";

export type { MatchActivityProps };

/**
 * One Live Activity (Lock Screen + Dynamic Island) for the online match in
 * progress. Local only: the app starts and updates it, iOS runs the clock.
 * Quietly does nothing where Live Activities don't exist (Android, Expo Go,
 * older iOS, or the player turned them off in Settings).
 */
let factory: LiveActivityFactory<MatchActivityProps> | null = null;
let afterDate: ((d: Date) => LiveActivityDismissalPolicy) | null = null;
try {
  // expo-widgets is native: requiring it throws in Expo Go
  if (Platform.OS === "ios") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    factory = (require("~/widgets/MatchActivity") as { default: LiveActivityFactory<MatchActivityProps> }).default;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    afterDate = (require("expo-widgets") as { after: (d: Date) => LiveActivityDismissalPolicy }).after;
  }
} catch {
  factory = null;
}

/** the turn clock goes red this long before it runs out */
const URGENT_MS = 10_000;
/** how long a final result stays on the Lock Screen */
const LINGER_MS = 2 * 60 * 1000;

let current: LiveActivity<MatchActivityProps> | null = null;
let shown = "";
/** the screen that last showed it: only that screen's exit ends it (screens hand over on navigation) */
let owner: symbol | null = null;

/** Leftovers from a previous run (the app was killed mid-match) go away at launch. */
try {
  for (const old of factory?.getInstances() ?? []) old.end("immediate").catch(() => {});
} catch {}

/** Start, or update the running one; repeated identical props are skipped. */
export function showMatchActivity(props: MatchActivityProps, deepLink?: string, by: symbol | null = null) {
  if (!factory) return;
  owner = by;
  const key = JSON.stringify(props);
  if (key === shown) return;
  shown = key;
  // the clock turns red for its last seconds: iOS redraws at the stale date even with the app asleep
  const stale = props.phase === "turn" && props.endsAt > 0 ? new Date(props.endsAt - URGENT_MS) : undefined;
  try {
    if (current) current.update(props, stale).catch(() => {});
    else current = factory.start(props, deepLink, stale);
  } catch {
    // Live Activities off, or too many running: the game goes on without it
    current = null;
  }
}

/**
 * End it: with final props the result stays on the Lock Screen for a couple of
 * minutes, otherwise it goes now. `by` = only if that screen still owns it.
 */
export function endMatchActivity(final?: MatchActivityProps, by: symbol | null = null) {
  if (by && owner !== by) return;
  const a = current;
  current = null;
  shown = "";
  owner = null;
  if (!a) return;
  const policy = final && afterDate ? afterDate(new Date(Date.now() + LINGER_MS)) : "immediate";
  a.end(policy, final).catch(() => {});
}

/**
 * Keep the activity in step with a screen: `props` null = nothing to show (ends
 * this screen's one). Leaving the screen ends it; `phase: "over"` ends with the result.
 */
export function useMatchActivity(props: MatchActivityProps | null, deepLink?: string) {
  const [me] = useState(() => Symbol("live-activity"));
  const key = props ? JSON.stringify(props) : "";
  useEffect(() => {
    if (!props) endMatchActivity(undefined, me);
    else if (props.phase === "over") endMatchActivity(props, me);
    else showMatchActivity(props, deepLink, me);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => () => endMatchActivity(undefined, me), [me]);
}

/** SF Symbols per game, shown in the compact Dynamic Island */
export const GAME_ICON = { ht: "square.grid.3x3.fill", pp: "hexagon.fill" } as const;

/** A two-player online game as the Live Activity sees it. */
export interface Duel {
  game: string;
  icon: string;
  me: Mark;
  opponent: string;
  turn: Mark;
  winner: Mark | "draw" | null;
  /** the whole match is decided (a series, or a single game) */
  matchOver: boolean;
  /** "X 1 – 2 O" style numbers: series wins, or hexes held */
  score: Record<Mark, number>;
  /** the mover's clock: started at `since`, runs out at `deadline` (ms) */
  since: number;
  deadline: number;
  /** where tapping the activity takes you, e.g. "/hat-trick/oda/AB12C" */
  path?: string;
}

/** Live Activity for an online duel (Tic-Tac-Toe series, house-bot series, Possession). */
export function useDuelActivity(d: Duel | null) {
  const { t } = useI18n();
  const props: MatchActivityProps | null = d && {
    game: d.game,
    icon: d.icon,
    headline: d.winner
      ? t(d.winner === "draw" ? "liveDraw" : d.winner === d.me ? "liveWon" : "liveLost")
      : d.turn === d.me
        ? t("liveYourTurn")
        : t("liveTheirTurn").replace("{nick}", d.opponent),
    tone: d.winner ? (d.winner === "draw" ? "draw" : d.winner === d.me ? "win" : "lose") : d.turn,
    line: `${t("you")} – ${d.opponent}`,
    score: `X ${d.score.X} – ${d.score.O} O`,
    mark: d.me,
    // whole seconds: the clock is re-sent on every server message, this keeps it from churning
    endsAt: d.winner ? 0 : Math.round(d.deadline / 1000) * 1000,
    since: d.winner ? 0 : Math.round(d.since / 1000) * 1000,
    phase: !d.winner ? "turn" : d.matchOver ? "over" : "pause",
  };
  useMatchActivity(props, d?.path ? `tiktako://${d.path.replace(/^\//, "")}` : undefined);
}

/** "Looking for an opponent" with a count-up while a queue screen waits. */
export function useSearchActivity(game: string, icon: string, searching: boolean) {
  const { t } = useI18n();
  const [since] = useState(() => Date.now());
  useMatchActivity(
    searching
      ? { game, icon, headline: t("liveSearching"), tone: "search", line: t("liveSearchingLine"), score: "", mark: "", endsAt: 0, since, phase: "search" }
      : null
  );
}
