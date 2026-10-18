import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useSyncExternalStore } from "react";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { AppState, Platform } from "react-native";

import { dayNumber } from "@/lib/daily";
import { dict, type TKey } from "@/lib/strings";

import { useI18n } from "./i18n";
import { usePlayStreak } from "./playStreak";

/**
 * Daily reminders, planned on the phone only (no push token, nothing goes to the server):
 * one note a day at 19:00 for the next week, none on a day already played, the first one
 * about the play streak when there is one. Opening the app plans the week again, so someone
 * who stops playing gets at most seven and then nothing.
 */
interface State {
  on: boolean;
  /** the soft "Want a reminder?" card on Home was answered */
  asked: boolean;
}

const KEY = "reminders-v1";
const HOUR = 19;
const CHANNEL = "reminders";
const DAYS = 7;
let state: State = { on: false, asked: false };
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();

function save(next: State) {
  state = next;
  listeners.forEach((fn) => fn());
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
}

function load() {
  return (loaded ??= AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (raw) state = { ...state, ...(JSON.parse(raw) as Partial<State>) };
    })
    .catch(() => {})
    .then(() => listeners.forEach((fn) => fn())));
}

export function useReminders() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      load();
      return () => {
        listeners.delete(fn);
      };
    },
    () => state
  );
}

/**
 * Expo Go on Android has no expo-notifications native module (importing it throws, a red screen in dev):
 * there reminders are simply not offered. Store builds and Expo Go on iOS have it.
 */
export const remindersAvailable = !(Platform.OS === "android" && Constants.executionEnvironment === ExecutionEnvironment.StoreClient);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Notifications: typeof import("expo-notifications") | null = remindersAvailable ? require("expo-notifications") : null;

// a reminder that fires while the app is open stays quiet
Notifications?.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false }),
});

/** Turns reminders on (asks iOS / Android first) or off. Returns whether they are on now. */
export async function setRemindersOn(on: boolean): Promise<boolean> {
  await load();
  if (!Notifications) return false;
  if (on) {
    let perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && perm.canAskAgain) perm = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
    on = perm.granted;
  }
  save({ on, asked: true });
  if (!on) await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
  return on;
}

export async function dismissReminderAsk() {
  await load();
  save({ ...state, asked: true });
}

const ROTATE: TKey[] = ["remGrid", "remXi", "remBingo"];

async function plan(t: (k: TKey) => string, streak: number, playedToday: boolean) {
  if (!Notifications) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!state.on) return;
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL, { name: t("remChannel"), importance: Notifications.AndroidImportance.DEFAULT });
  }
  const now = new Date();
  const today = dayNumber(now);
  for (let d = 0; d < DAYS; d++) {
    if (d === 0 && playedToday) continue;
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, HOUR, 0, 0);
    if (at <= now) continue;
    const body = d === 0 && streak > 0 ? t("remStreak").replace("{n}", String(streak)) : t(ROTATE[(today + d) % ROTATE.length]);
    await Notifications.scheduleNotificationAsync({
      content: { title: "Tiktako", body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
    });
  }
}

/** Keeps the week of reminders in step with the streak, the language and the day (root layout). */
export function RemindersSync() {
  const { locale } = useI18n();
  const { on } = useReminders();
  const { count, playedToday } = usePlayStreak();
  useEffect(() => {
    const run = () => {
      plan((k) => dict[locale][k], count, playedToday).catch(() => {});
    };
    run();
    // a new day while the app sat in the background: plan again on the way back
    const sub = AppState.addEventListener("change", (s) => s === "active" && run());
    return () => sub.remove();
  }, [locale, on, count, playedToday]);
  return null;
}
