import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { router } from "expo-router";
import { useEffect, useSyncExternalStore } from "react";
import { AppState, Platform } from "react-native";

import { dict, type Locale, type TKey } from "@/lib/strings";

import { accountApi, setSignOutExtras, useAccount } from "./account";
import { track } from "./analytics";
import { PUSH } from "./features";
import { useI18n } from "./i18n";
import { isInvite, openInvite } from "./invites";
import { remindersAvailable } from "./reminders";

/**
 * Push notifications (v1.2) for signed-in players: a friend's invite, "X added you" and opt-in news,
 * sent by server-push.js through Expo's push service. The phone only registers its Expo push token
 * (with its language and the three switches) once iOS / Android already allow notifications: the OS
 * prompt comes only from `askPush` (the explainer card on the Friends screen, or a switch in
 * Settings). Signing out takes the token off the server (account.ts sign-out extras); deleting the
 * account removes it there with everything else. Guests keep only the local reminder (reminders.ts).
 */
export type PushCategory = "invites" | "friends" | "news";
export type PushPrefs = Record<PushCategory, boolean>;
interface State {
  prefs: PushPrefs;
  /** the explainer card was answered (shown once) */
  asked: boolean;
  /** this phone's Expo push token, once registered */
  token: string | null;
  /** what the server last took (account|token|lang|prefs): unchanged = nothing to send */
  sentKey: string | null;
}

const KEY = "push-v1";
const CATEGORIES: PushCategory[] = ["invites", "friends", "news"];
const CHANNEL_NAMES: Record<PushCategory, TKey> = { invites: "pushInvites", friends: "pushFriends", news: "pushNews" };
/** a cold start from a tapped push: give the navigator a moment before pushing a screen */
const COLD_START_MS = 400;
let state: State = { prefs: { invites: true, friends: true, news: false }, asked: false, token: null, sentKey: null };
let loaded: Promise<void> | null = null;
let queue: Promise<unknown> = Promise.resolve();
const listeners = new Set<() => void>();

/**
 * Not in Expo Go (its token belongs to Expo Go, not Tiktako) nor where expo-notifications is missing
 * (reminders.ts `remindersAvailable`).
 */
export const pushAvailable = PUSH && remindersAvailable && Platform.OS !== "web" && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Notifications: typeof import("expo-notifications") | null = pushAvailable ? require("expo-notifications") : null;
const PROJECT_ID: string | undefined = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

function save(next: State) {
  state = next;
  listeners.forEach((fn) => fn());
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
}

function load() {
  return (loaded ??= AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (raw) {
        const saved = JSON.parse(raw) as Partial<State>;
        state = { ...state, ...saved, prefs: { ...state.prefs, ...saved.prefs } };
      }
    })
    .catch(() => {})
    .then(() => listeners.forEach((fn) => fn())));
}

// signing out takes this phone's token off the account in the same request
setSignOutExtras(async () => {
  await load();
  const token = state.token;
  if (token) save({ ...state, sentKey: null });
  return token ? { pushToken: token } : {};
});

export function usePush() {
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

/** Android shows pushes in a channel per category (server-push.js sends `channelId` = category). */
async function ensureChannels(locale: Locale) {
  if (!Notifications || Platform.OS !== "android") return;
  for (const c of CATEGORIES) {
    await Notifications.setNotificationChannelAsync(c, {
      name: dict[locale][CHANNEL_NAMES[c]],
      importance: c === "invites" ? Notifications.AndroidImportance.HIGH : Notifications.AndroidImportance.DEFAULT,
    });
  }
}

async function register(locale: Locale, accountId: string) {
  await load();
  if (!Notifications) return;
  const perm = await Notifications.getPermissionsAsync().catch(() => null);
  if (!perm?.granted) return;
  let token: string;
  try {
    await ensureChannels(locale);
    token = (await Notifications.getExpoPushTokenAsync(PROJECT_ID ? { projectId: PROJECT_ID } : undefined)).data;
  } catch (e) {
    // no APNs / FCM credentials yet (Android before FCM is set up), offline, a simulator: try next time
    console.warn("push token:", (e as Error).message);
    return;
  }
  const { prefs } = state;
  const sentKey = [accountId, token, locale, ...CATEGORIES.map((c) => +prefs[c])].join("|");
  if (sentKey === state.sentKey) return;
  try {
    await accountApi("/push", { method: "POST", body: JSON.stringify({ token, platform: Platform.OS, lang: locale, prefs }) });
    save({ ...state, token, sentKey });
  } catch {
    // offline or signed out meanwhile: the next app start or change tries again
  }
}

/** Register (or refresh) this phone's token for the account; only when notifications are already allowed. */
export function syncPush(locale: Locale, accountId: string | null) {
  if (!Notifications || !accountId) return Promise.resolve();
  const run = queue.then(() => register(locale, accountId));
  queue = run.catch(() => {});
  return run;
}

/** The OS prompt (after the explainer card or a Settings switch), then registering. Resolves to granted. */
export async function askPush(locale: Locale, accountId: string | null): Promise<boolean> {
  await load();
  if (!Notifications) return false;
  let perm = await Notifications.getPermissionsAsync().catch(() => null);
  if (perm && !perm.granted && perm.canAskAgain) {
    perm = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } }).catch(() => null);
    track("push_permission", { granted: !!perm?.granted });
  }
  save({ ...state, asked: true });
  await refreshPermission();
  if (perm?.granted) await syncPush(locale, accountId);
  return !!perm?.granted;
}

export async function dismissPushAsk() {
  await load();
  save({ ...state, asked: true });
}

/** A switch in Settings; the server hears it on the next sync (right away when allowed). */
export async function setPushPref(category: PushCategory, on: boolean, locale: Locale, accountId: string | null) {
  await load();
  save({ ...state, prefs: { ...state.prefs, [category]: on } });
  await syncPush(locale, accountId);
}

type Permission = "granted" | "denied" | "undetermined" | null;
let permission: Permission = null;
const permissionListeners = new Set<() => void>();

/** Re-read whether iOS / Android allow notifications (after a prompt, or back from Settings). */
async function refreshPermission() {
  if (!Notifications) return;
  const p = await Notifications.getPermissionsAsync().catch(() => null);
  if (!p) return;
  permission = p.granted ? "granted" : p.canAskAgain ? "undetermined" : "denied";
  permissionListeners.forEach((fn) => fn());
}

/** Whether iOS / Android allow notifications for the app (null while unknown); re-read when the app comes back. */
export function usePushPermission(): Permission {
  useEffect(() => {
    if (!Notifications) return;
    refreshPermission();
    const sub = AppState.addEventListener("change", (s) => s === "active" && refreshPermission());
    return () => sub.remove();
  }, []);
  return useSyncExternalStore(
    (fn) => {
      permissionListeners.add(fn);
      return () => {
        permissionListeners.delete(fn);
      };
    },
    () => permission
  );
}

const handled = new Set<string>();
/** the device token seen last (addPushTokenListener), to tell a real change from a fetch */
let lastDevice: string | null = null;

/** A tapped push: an invite opens the friend's room, "added you" the Friends screen. */
function openFromPush(response: import("expo-notifications").NotificationResponse, delay = 0) {
  if (!Notifications || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
  const id = response.notification.request.identifier;
  if (handled.has(id)) return;
  handled.add(id);
  Notifications.clearLastNotificationResponse();
  const data = (response.notification.request.content.data ?? {}) as Record<string, unknown>;
  const go = () => {
    if (data.type === "invite" && isInvite(data.game, data.room)) openInvite(data.game, String(data.room));
    else if (data.type === "friend") router.push("/arkadaslar");
  };
  if (delay) setTimeout(go, delay);
  else go();
}

/**
 * Root layout: keeps the token on the account in step with sign-in, language, switches and device
 * token changes (and retries when the app comes back with nothing registered, e.g. after allowing
 * notifications in Settings), and opens
 * what a tapped push points at, including the push that launched the app.
 */
export function PushSync() {
  const { locale } = useI18n();
  const account = useAccount();
  const { prefs } = usePush();
  const accountId = account?.id ?? null;

  useEffect(() => {
    if (!Notifications) return;
    if (account === null && state.sentKey) save({ ...state, sentKey: null });
    if (!accountId) return;
    syncPush(locale, accountId);
    // back in the app with nothing registered yet (e.g. notifications just allowed in Settings): try again
    const sub = AppState.addEventListener("change", (s) => s === "active" && !state.sentKey && syncPush(locale, accountId));
    // the OS handed out a different device token (fetching one also fires this): register what it maps to
    const tokenSub = Notifications.addPushTokenListener((t) => {
      const device = String(t.data);
      const changed = lastDevice !== null && lastDevice !== device;
      lastDevice = device;
      if (!changed) return;
      save({ ...state, sentKey: null });
      syncPush(locale, accountId);
    });
    return () => {
      sub.remove();
      tokenSub.remove();
    };
  }, [locale, account, accountId, prefs]);

  useEffect(() => {
    if (!Notifications) return;
    const last = Notifications.getLastNotificationResponse();
    if (last) openFromPush(last, COLD_START_MS);
    const sub = Notifications.addNotificationResponseReceivedListener((r) => openFromPush(r));
    return () => sub.remove();
  }, []);

  return null;
}
