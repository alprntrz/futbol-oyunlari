import Constants from "expo-constants";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

import { dict, type Locale } from "@/lib/strings";

import { SOCKET_URL } from "./socket";

/**
 * Keeping the app healthy without analytics (server-app.js):
 * - `reportCrash`: the error screen sends an anonymous report (message, short stack, screen,
 *   version, platform; no id, no nickname).
 * - `useUpdateRequired`: the server names the oldest version it still serves; an older app
 *   shows "please update" instead of breaking in odd ways.
 */
export const APP_VERSION = Constants.expoConfig?.version ?? "1.0.0";

export function reportCrash(error: Error, screen: string) {
  fetch(`${SOCKET_URL}/api/app/crash`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: String(error?.message ?? error).slice(0, 500),
      stack: String(error?.stack ?? "").slice(0, 3000),
      screen: screen.slice(0, 120),
      version: APP_VERSION,
      platform: Platform.OS,
    }),
  }).catch(() => {});
}

/** "1.10.0" > "1.9.2" */
export function olderThan(a: string, b: string) {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) < (pb[i] ?? 0);
  }
  return false;
}

/** The store page to update from, when this version is too old for the server; null otherwise (or offline). */
export function useUpdateRequired(): string | null {
  const [store, setStore] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`${SOCKET_URL}/api/app/version`)
      .then((r) => r.json())
      .then((v: { min?: string; store?: Record<string, string> }) => {
        if (alive && v.min && olderThan(APP_VERSION, v.min)) setStore(v.store?.[Platform.OS] ?? "");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return store;
}

/** Strings for screens drawn outside the i18n provider (the root error screen). */
export function rootStrings() {
  let locale: Locale = "tr";
  try {
    locale = Intl.DateTimeFormat().resolvedOptions().locale.startsWith("tr") ? "tr" : "en";
  } catch {}
  return dict[locale];
}
