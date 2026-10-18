import { useEffect, useState, useSyncExternalStore } from "react";
import { Platform } from "react-native";

import { LIVE_ACTIVITIES, LIVE_PUSH } from "./features";
import type { LiveActivity, LiveActivityDismissalPolicy, LiveActivityFactory } from "expo-widgets";

import type { Mark } from "~/lib/hattrick";
import { useI18n } from "~/lib/i18n";
import { getSocket } from "~/lib/socket";
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
  if (Platform.OS === "ios" && LIVE_ACTIVITIES) {
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
/** APNs token of the running activity (server-live.js updates it while the app is away) */
let pushToken: string | null = null;
const tokenListeners = new Set<() => void>();
const setPushToken = (t: string | null) => {
  if (t === pushToken) return;
  pushToken = t;
  tokenListeners.forEach((fn) => fn());
};
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
    else {
      const started = factory.start(props, deepLink, stale);
      current = started;
      // the token comes a moment after the start (and may change): only with push updates on
      if (LIVE_PUSH) {
        started.addPushTokenListener((e) => current === started && setPushToken(e.pushToken));
        started
          .getPushToken()
          .then((t) => current === started && t && setPushToken(t))
          .catch(() => {});
      }
    }
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
  setPushToken(null);
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
export const GAME_ICON = { ht: "square.grid.3x3.fill", pp: "hexagon.fill", dz: "rectangle.stack.fill", rd: "arrow.triangle.2.circlepath", wm: "person.fill.questionmark" } as const;

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
  // the app itself also flips the clock red for its last seconds while it still runs
  // (the stale-date redraw covers a suspended app, where iOS does it)
  const urgentAt = d && !d.winner ? d.deadline - URGENT_MS : 0;
  const [urgentFor, setUrgentFor] = useState(0);
  useEffect(() => {
    if (!urgentAt) return;
    const id = setTimeout(() => setUrgentFor(urgentAt), Math.max(0, urgentAt - Date.now()));
    return () => clearTimeout(id);
  }, [urgentAt]);
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
    urgent: !d.winner && urgentFor === urgentAt,
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

/**
 * Online match: hand the running activity's push token and this phone's strings
 * to server.js, which updates the activity over APNs while the app is in the
 * background and alerts when the turn comes back. The token only lives with the
 * match on the server (memory), `la:clear` drops it.
 */
export function useLivePush(game: "ht" | "pp" | "dz", code: string | null) {
  const { t } = useI18n();
  const token = useSyncExternalStore(
    (fn) => {
      tokenListeners.add(fn);
      return () => {
        tokenListeners.delete(fn);
      };
    },
    () => pushToken
  );
  const name = { ht: t("tikiTakaName"), pp: t("ppName"), dz: t("dzName") }[game];
  const s = {
    game: name,
    icon: GAME_ICON[game],
    you: t("you"),
    yourTurn: t("liveYourTurn"),
    theirTurn: t("liveTheirTurn"),
    won: t("liveWon"),
    lost: t("liveLost"),
    draw: t("liveDraw"),
    pick: t("dzPick"),
    waiting: t("dzWaiting"),
    winRound: t("dzWinRound"),
    loseRound: t("dzLoseRound"),
    drawRound: t("dzDrawRound"),
    round: t("dzRound"),
  };
  const key = JSON.stringify(s);
  useEffect(() => {
    if (!token || !code) return;
    const socket = getSocket();
    const send = () => socket.emit("la:token", { game, token, s: JSON.parse(key) });
    send();
    // a reconnect makes a new socket on the server: send it again
    socket.on("connect", send);
    return () => {
      socket.off("connect", send);
      socket.emit("la:clear");
    };
  }, [token, code, game, key]);
}
