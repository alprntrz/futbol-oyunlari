/**
 * Anonymous funnel counts for the web test site, same limits as the app's analytics: typed events
 * only, no cookies, no stored id (a new random id per page load), no GeoIP, no person profiles.
 * Return visits come from `days_since_first`, a number the browser works out for itself.
 * Off without NEXT_PUBLIC_POSTHOG_KEY. The project must have "Discard client IP data" on; the app's project 684160 has it,
 * and these event names don't clash with the app's.
 */

export type WebEvent = "landing_view" | "game_start" | "first_guess" | "search" | "game_finish" | "share_tap" | "store_click" | "friend_create" | "friend_join" | "friend_series_end" | "bot_start" | "bot_series_end";

export interface WebEventProps {
  practice?: boolean;
  boxes?: number;
  players?: number;
  ended?: "time" | "manual";
  found?: boolean;
  arabic?: boolean;
  invited?: boolean;
}

export interface WebContext {
  locale: string;
  search: string;
  timeZone: string;
  device: "ios" | "android" | "other";
  daysSinceFirst: number;
}

const ENDPOINT = "https://us.i.posthog.com/i/v0/e/";
const FIRST_DAY_KEY = "sa-first-day";
const STATS_OFF_KEY = "stats-off";
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const;
const SAFE_UTM = /^[\w.-]{1,40}$/;
const pageId = () => crypto.randomUUID();

/** Only campaign tags of a plain shape pass: a link can't smuggle anything else into the stats. */
export function utmOf(search: string): Record<string, string> {
  const params = new URLSearchParams(search);
  return Object.fromEntries(UTM_KEYS.flatMap((k) => {
    const v = params.get(k);
    return v && SAFE_UTM.test(v) ? [[k, v]] : [];
  }));
}

export function statsBody(apiKey: string, event: WebEvent, props: WebEventProps, ctx: WebContext, distinctId: string) {
  return {
    api_key: apiKey,
    event,
    distinct_id: distinctId,
    properties: {
      ...props,
      ...utmOf(ctx.search),
      locale: ctx.locale,
      time_zone: ctx.timeZone,
      device: ctx.device,
      days_since_first: ctx.daysSinceFirst,
      $process_person_profile: false,
      $geoip_disable: true,
    },
  };
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // storage blocked: the game still runs, the visit counts as a first one
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // storage blocked: nothing to keep
  }
}

export const statsOff = () => read(STATS_OFF_KEY) === "1";
export const setStatsOff = (off: boolean) => write(STATS_OFF_KEY, off ? "1" : null);

function daysSinceFirst(today: number): number {
  const first = Number(read(FIRST_DAY_KEY));
  if (first > 0) return today - first;
  write(FIRST_DAY_KEY, String(today));
  return 0;
}

const deviceOf = (ua: string): WebContext["device"] => (/iPhone|iPad/.test(ua) ? "ios" : /Android/.test(ua) ? "android" : "other");

let distinctId: string | null = null;

export function track(event: WebEvent, props: WebEventProps, locale: string, today: number) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || statsOff()) return;
  distinctId ??= pageId();
  const ctx: WebContext = {
    locale,
    search: location.search,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    device: deviceOf(navigator.userAgent),
    daysSinceFirst: daysSinceFirst(today),
  };
  fetch(ENDPOINT, { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify(statsBody(key, event, props, ctx, distinctId)) })
    .catch((e: unknown) => console.warn("stats not sent", e)); // a lost count must never touch the game
}
