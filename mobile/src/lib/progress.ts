import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Updates from "expo-updates";
import { AppState } from "react-native";

/**
 * Game progress that follows a signed-in player to a new phone (server-accounts.js PROGRESS_KEYS):
 * match history (opponents' names left out), play streak, trophies, Daily XI stats, the reward
 * calendar, today's quests, the frame pick and the Dribbling Rush best. Never the profile photo,
 * the block list or the install id (the privacy page promises those stay on the phone).
 *
 * On sign-in / app start the account's copy is merged into the phone's (best scores and the
 * longer streak win, histories are joined); if that brought anything back the app restarts once
 * so every screen reads it. The phone's copy goes up a few seconds later and when the app leaves
 * the foreground.
 */
const KEYS = ["history-v1", "play-streak-v1", "ht-trophies", "missing11-stats", "daily-rewards-v1", "frame-v1", "quests-v1", "rush-best", "rush-club"] as const;
type Key = (typeof KEYS)[number];
type Blob = Partial<Record<Key, string>>;

export interface ProgressApi {
  get: () => Promise<{ progress: Blob }>;
  put: (progress: Blob) => Promise<unknown>;
}

let api: ProgressApi | null = null;
let lastSent = "";
let timer: ReturnType<typeof setTimeout> | null = null;

const parse = <T>(v: string | undefined | null): T | null => {
  if (v == null) return null;
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
};

const RELOAD_KEY = "progress-reload-at";
/** Same content (key order and spacing aside). */
const same = (a: string, b: string | undefined) => a === b || (b != null && JSON.stringify(parse(a)) === JSON.stringify(parse(b)));

type Match = { key: string; at: number; opponent?: string };
type Streak = { last: number; count: number; best: number };
type XiStats = { played: number };

/** The value to keep for one key, given the phone's and the account's. */
function merge(key: Key, mine: string | null, theirs: string | undefined): string | null {
  if (theirs == null) return mine;
  if (mine == null) return theirs;
  switch (key) {
    case "ht-trophies":
    case "rush-best":
      return String(Math.max(Number(mine) || 0, Number(theirs) || 0));
    case "history-v1": {
      const a = parse<Match[]>(mine) ?? [];
      const b = parse<Match[]>(theirs) ?? [];
      const seen = new Set(a.map((m) => m.key));
      return JSON.stringify([...a, ...b.filter((m) => !seen.has(m.key))].sort((x, y) => y.at - x.at).slice(0, 30));
    }
    case "play-streak-v1": {
      const a = parse<Streak>(mine);
      const b = parse<Streak>(theirs);
      if (!a || !b) return mine;
      const pick = b.last > a.last || (b.last === a.last && b.count > a.count) ? b : a;
      return JSON.stringify({ ...pick, best: Math.max(a.best, b.best) });
    }
    case "missing11-stats": {
      const a = parse<XiStats>(mine);
      const b = parse<XiStats>(theirs);
      return a && b && b.played > a.played ? theirs : mine;
    }
    default:
      return mine;
  }
}

async function localBlob(): Promise<Blob> {
  const pairs = await AsyncStorage.multiGet([...KEYS]);
  const blob: Blob = {};
  for (const [k, v] of pairs) if (v != null) blob[k as Key] = v;
  return blob;
}

/** The phone's copy as it goes to the server: history without the opponents' nicknames. */
function forServer(blob: Blob): Blob {
  const history = parse<Match[]>(blob["history-v1"]);
  return history ? { ...blob, "history-v1": JSON.stringify(history.map((m) => ({ ...m, opponent: "" }))) } : blob;
}

async function upload() {
  if (!api) return;
  const blob = forServer(await localBlob());
  const raw = JSON.stringify(blob);
  if (raw === lastSent) return;
  await api.put(blob);
  lastSent = raw;
}

function uploadSoon() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    upload().catch(() => {});
  }, 4000);
}

/** Signed in (lib/account.ts): merge the account's progress into the phone's, then keep it up to date. */
export async function syncProgress(next: ProgressApi) {
  api = next;
  try {
    const { progress } = await api.get();
    const local = await localBlob();
    const writes: [string, string][] = [];
    for (const k of KEYS) {
      const v = merge(k, local[k] ?? null, progress?.[k]);
      if (v != null && !same(v, local[k])) writes.push([k, v]);
    }
    if (writes.length) {
      await AsyncStorage.multiSet(writes);
      // the screens and stores read these once at start: restart so they see what came back
      // (once a minute at most, so a bad merge can never loop)
      const last = Number(await AsyncStorage.getItem(RELOAD_KEY)) || 0;
      if (Date.now() - last > 60_000) {
        await AsyncStorage.setItem(RELOAD_KEY, String(Date.now()));
        await Updates.reloadAsync().catch(() => {});
        return;
      }
    }
  } catch {
    // offline: keep the phone's copy, try again next start
  }
  uploadSoon();
}

/** Signed out: stop sending. */
export function stopProgress() {
  api = null;
  lastSent = "";
}

AppState.addEventListener("change", (s) => {
  if (s === "background" && api) upload().catch(() => {});
});
