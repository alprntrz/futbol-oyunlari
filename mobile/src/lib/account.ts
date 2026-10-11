import AsyncStorage from "@react-native-async-storage/async-storage";
import * as AppleAuthentication from "expo-apple-authentication";
import * as SecureStore from "expo-secure-store";
import { useSyncExternalStore } from "react";

import { loadAvatar, saveAvatar, type AvatarId } from "./avatar";
import { loadNick, loadPlayerId, saveNick } from "./nick";
import { SOCKET_URL } from "./socket";
import { applyServerTotals, loadXp, resetLocalXp, setAwardSink, type XpGame } from "./xp";

/**
 * Optional account (Sign in with Apple / Google). Guests keep playing as before;
 * signing in moves this phone's XP into the account and keeps it on the server
 * (server-accounts.js). We never ask Apple or Google for a name or e-mail.
 */
export interface Account {
  id: string;
  provider: "apple" | "google";
  nick: string;
  avatar: string;
  xp: number;
  byGame: Partial<Record<XpGame, number>>;
  bonusToday: boolean;
}

const TOKEN_KEY = "session";
const PENDING_KEY = "xp-pending";
const API = `${SOCKET_URL}/api/account`;
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

let token: string | null = null;
let account: Account | null | undefined = undefined; // undefined = not loaded yet
const listeners = new Set<(a: Account | null) => void>();

function setAccount(a: Account | null) {
  account = a;
  listeners.forEach((fn) => fn(a));
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...init.headers },
  });
  if (res.status === 401 && token) {
    // the session is gone (account deleted elsewhere): back to guest
    await forget();
    throw new Error("signed out");
  }
  if (!res.ok) throw new Error(`http ${res.status}`);
  return (await res.json()) as T;
}

async function forget() {
  token = null;
  await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
  await AsyncStorage.removeItem(PENDING_KEY).catch(() => {});
  setAccount(null);
}

// ── XP: awards made while signed in go to the account too (queued when offline)

type Pending = { key: string; game: XpGame; amount: number };

async function flushPending() {
  if (!token) return;
  let list: Pending[] = [];
  try {
    list = JSON.parse((await AsyncStorage.getItem(PENDING_KEY)) ?? "[]") as Pending[];
  } catch {}
  if (!list.length) return;
  try {
    const { user } = await api<{ user: Account }>("/xp", { method: "POST", body: JSON.stringify({ awards: list.slice(0, 50) }) });
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(list.slice(50))).catch(() => {});
    setAccount(user);
    applyServerTotals(user.xp, user.byGame);
  } catch {
    // offline: try again on the next award or app start
  }
}

setAwardSink((key, game, amount) => {
  if (!token) return;
  AsyncStorage.getItem(PENDING_KEY)
    .then((raw) => AsyncStorage.setItem(PENDING_KEY, JSON.stringify([...(JSON.parse(raw ?? "[]") as Pending[]), { key, game, amount }])))
    .then(flushPending)
    .catch(() => {});
});

// ── Session

/** On app start: restore the session, sync, and pay the daily sign-in bonus. */
export async function initAccount() {
  try {
    token = await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    token = null;
  }
  if (!token) return setAccount(null);
  try {
    await flushPending();
    const { user } = await api<{ user: Account }>("/me");
    setAccount(user);
    applyServerTotals(user.xp, user.byGame);
    claimDailyBonus();
  } catch {
    // offline: stay signed in, sync later
    if (account === undefined) setAccount(null);
  }
}

async function claimDailyBonus() {
  try {
    const { gained, user } = await api<{ gained: number; user: Account }>("/daily", { method: "POST" });
    setAccount(user);
    applyServerTotals(user.xp, user.byGame, { gained, source: "bonus" });
  } catch {}
}

async function finishSignIn(provider: "apple" | "google", idToken: string, authorizationCode?: string | null) {
  const [nick, avatar, installId, guest] = await Promise.all([loadNick(), loadAvatar(), loadPlayerId(), loadXp()]);
  const res = await api<{ token: string; isNew: boolean; user: Account }>("/signin", {
    method: "POST",
    body: JSON.stringify({ provider, token: idToken, authorizationCode, nick, avatar, installId, guest: { byGame: guest.byGame } }),
  });
  token = res.token;
  await SecureStore.setItemAsync(TOKEN_KEY, res.token);
  // a returning player gets their own nickname and avatar back on this phone
  if (!res.isNew) {
    if (res.user.nick) await saveNick(res.user.nick);
    await saveAvatar(res.user.avatar as AvatarId);
  }
  setAccount(res.user);
  applyServerTotals(res.user.xp, res.user.byGame);
  claimDailyBonus();
  return res.user;
}

export async function appleSignInAvailable() {
  return AppleAuthentication.isAvailableAsync().catch(() => false);
}

/** Sign in with Apple. No scopes: we don't ask for name or e-mail. Null if cancelled. */
export async function signInWithApple(): Promise<Account | null> {
  try {
    const cred = await AppleAuthentication.signInAsync({ requestedScopes: [] });
    if (!cred.identityToken) throw new Error("no token");
    return await finishSignIn("apple", cred.identityToken, cred.authorizationCode);
  } catch (e) {
    if ((e as { code?: string }).code === "ERR_REQUEST_CANCELED") return null;
    throw e;
  }
}

/** The native Google module is missing in Expo Go and until the client id is set. */
function googleModule() {
  if (!GOOGLE_IOS_CLIENT_ID) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@react-native-google-signin/google-signin") as typeof import("@react-native-google-signin/google-signin");
  } catch {
    return null;
  }
}

export const googleSignInAvailable = () => googleModule() !== null;

/** Sign in with Google (only the opaque id; no profile or e-mail scope). Null if cancelled. */
export async function signInWithGoogle(): Promise<Account | null> {
  const g = googleModule();
  if (!g) throw new Error("google unavailable");
  g.GoogleSignin.configure({ iosClientId: GOOGLE_IOS_CLIENT_ID, scopes: [] });
  const res = await g.GoogleSignin.signIn();
  if (res.type !== "success" || !res.data.idToken) return null;
  return finishSignIn("google", res.data.idToken);
}

/** Sign out: the account keeps its XP; this phone becomes a fresh guest. */
export async function signOut() {
  if (token) await api("/signout", { method: "POST" }).catch(() => {});
  if (account?.provider === "google") await googleModule()?.GoogleSignin.signOut().catch(() => {});
  await forget();
  await resetLocalXp();
}

/** Delete the account and everything on the server (Guideline 5.1.1(v)). */
export async function deleteAccount() {
  // throws when the server can't be reached, so the screen can say so (nothing is half-deleted)
  const res = await fetch(API, { method: "DELETE", headers: token ? { authorization: `Bearer ${token}` } : {} });
  if (!res.ok && res.status !== 401) throw new Error(`http ${res.status}`);
  await forget();
}

/** Push a nickname / avatar change to the account (no-op for guests). */
export async function syncProfile(nick: string, avatar: string) {
  if (!token) return;
  try {
    const { user } = await api<{ user: Account }>("/profile", { method: "PUT", body: JSON.stringify({ nick, avatar }) });
    setAccount(user);
  } catch {}
}

/** Current account; null = guest, undefined = still loading. */
export function useAccount() {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    () => account
  );
}
