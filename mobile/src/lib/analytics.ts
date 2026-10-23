import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSegments } from "expo-router";
import { useEffect, useSyncExternalStore } from "react";

import { ANALYTICS } from "./features";
import { isGameAward, onXpAward, type XpSource } from "./xp";

/**
 * Anonymous usage events (v1.2) to PostHog, EU cloud. Privacy (keep site/privacy.html true):
 * - a random device id made by the SDK, never linked to the account: no identify(), no person
 *   profiles, no aliases or groups;
 * - only the fixed events below, with fixed property names and short values: never the nickname,
 *   account id, install id (pid), friend codes, room codes or anything typed;
 * - screens as route patterns ("/hat-trick/oda/[code]", never the code itself);
 * - no session replay, no touch autocapture, no feature flags or surveys, no error tracking
 *   (Sentry does that), GeoIP off (the PostHog project must also discard client IPs);
 * - off in development, without EXPO_PUBLIC_POSTHOG_KEY, and once "Share usage data" is off.
 * The SDK keeps its queue and device id in AsyncStorage, so "Delete my data" wipes them.
 */
const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";
/** "1" = the player turned usage data off (kept through "Delete my data") */
export const ANALYTICS_OFF_KEY = "analytics-off-v1";
const MAX_VALUE = 40;

/** The events and their properties: nothing else can be sent. */
type Events = {
  game_finished: { game: XpSource; practice: boolean };
  onboarding_done: Record<string, never>;
  signed_in: { provider: "apple" | "google" };
  share_tapped: { game: string };
  push_permission: { granted: boolean };
};
const PROPS: { [E in keyof Events]: (keyof Events[E])[] } = {
  game_finished: ["game", "practice"],
  onboarding_done: [],
  signed_in: ["provider"],
  share_tapped: ["game"],
  push_permission: ["granted"],
};

type Client = import("posthog-react-native").default;
let client: Client | null = null;
/** the route on screen, so the first screen counts even when PostHog starts a moment later */
let lastScreen: string | null = null;
let on = true;
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();

const configured = () => ANALYTICS && !!KEY && !__DEV__;

function load() {
  return (loaded ??= AsyncStorage.getItem(ANALYTICS_OFF_KEY)
    .then((v) => {
      on = v !== "1";
    })
    .catch(() => {})
    .then(() => listeners.forEach((fn) => fn())));
}

function start() {
  if (client || !configured() || !on) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const PostHog = (require("posthog-react-native") as typeof import("posthog-react-native")).default;
    client = new PostHog(KEY!, {
      host: HOST,
      personProfiles: "never",
      disableGeoip: true,
      captureAppLifecycleEvents: true,
      enableSessionReplay: false,
      preloadFeatureFlags: false,
      disableRemoteFeatureFlags: true,
      disableSurveys: true,
      sendFeatureFlagEvent: false,
      errorTracking: { autocapture: false },
      customStorage: AsyncStorage,
    });
    if (lastScreen) client.screen(lastScreen).catch(() => {});
  } catch (e) {
    console.warn("analytics off:", (e as Error).message);
    client = null;
  }
}

/** App start (root layout): starts PostHog unless it's off, and counts finished games. */
export async function initAnalytics() {
  if (!configured()) return;
  await load();
  start();
}

// a finished game (not a reward, quest or sync), as the XP award that pays it
onXpAward((a) => {
  if (isGameAward(a)) track("game_finished", { game: a.game, practice: !!a.practice });
});

/** Send one of the fixed events; unknown properties and long values are dropped. */
export function track<E extends keyof Events>(event: E, props: Events[E]) {
  if (!client) return;
  const clean: Record<string, string | boolean | number> = {};
  for (const k of PROPS[event]) {
    const v = (props as Record<string, unknown>)[k as string];
    if (typeof v === "boolean" || typeof v === "number") clean[k as string] = v;
    else if (typeof v === "string") clean[k as string] = v.slice(0, MAX_VALUE);
  }
  try {
    client.capture(event, clean);
  } catch {}
}

/** Screen views as route patterns: groups dropped, dynamic segments kept as "[code]". */
export function screenName(segments: readonly string[]) {
  return "/" + segments.filter((s) => !(s.startsWith("(") && s.endsWith(")"))).join("/");
}

/** Root layout: one screen event per route pattern change. */
export function AnalyticsScreens() {
  const segments = useSegments();
  const name = screenName(segments);
  useEffect(() => {
    lastScreen = name;
    client?.screen(name).catch(() => {});
  }, [name]);
  return null;
}

/** Settings → "Share usage data". Off: PostHog opts out and stops; on again: starts afresh. */
export async function setAnalyticsOn(next: boolean) {
  await load();
  on = next;
  listeners.forEach((fn) => fn());
  if (next) {
    await AsyncStorage.removeItem(ANALYTICS_OFF_KEY).catch(() => {});
    if (client) await client.optIn().catch(() => {});
    else start();
    return;
  }
  await AsyncStorage.setItem(ANALYTICS_OFF_KEY, "1").catch(() => {});
  const c = client;
  client = null;
  if (c) {
    await c.optOut().catch(() => {});
    c.reset();
    await c.shutdown().catch(() => {});
  }
}

/** "Delete my data": forget the device id and the queue (the off switch is kept, lib/privacy.ts). */
export function resetAnalytics() {
  try {
    client?.reset();
  } catch {}
}

/** Whether Settings shows the switch (a build without a key, or a dev build, sends nothing either way). */
export const analyticsAvailable = () => ANALYTICS;

export function useAnalyticsOn() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      load();
      return () => {
        listeners.delete(fn);
      };
    },
    () => on
  );
}
