import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import { Platform } from "react-native";

import { PLUS_ENTITLEMENT, PLUS_FOREVER, type PlusPlan } from "@/lib/plus";

import { MONETIZE } from "./features";

/**
 * Tiktako Plus (one subscription, monthly / yearly / lifetime) through RevenueCat
 * (react-native-purchases). What it gives is listed in src/lib/plus.ts PLUS_PERKS; what it never
 * gives: anything inside a match.
 *
 * - Guests buy anonymously (RevenueCat's own id); signing in logs that id into the account's id,
 *   so the purchase follows the account and the server can check it (server-accounts.js
 *   /plus/sync, RevenueCat webhook). Others then see the Plus frame.
 * - The entitlement is cached on the phone (`plus-v1`) so an offline start still knows.
 * - The native module is missing in Expo Go, and the API keys come from eas.json
 *   (EXPO_PUBLIC_RC_IOS_KEY / EXPO_PUBLIC_RC_ANDROID_KEY). Without them nothing can be bought;
 *   `__DEV__` builds get a "simulate Plus" switch on the paywall so the UI can be tried.
 */
type Purchases = typeof import("react-native-purchases");
type Package = import("react-native-purchases").PurchasesPackage;
type CustomerInfo = import("react-native-purchases").CustomerInfo;

export interface PlusState {
  active: boolean;
  /** ms; PLUS_FOREVER for lifetime; 0 = none */
  until: number;
  /** "store" = RevenueCat said so, "server" = the account said so, "dev" = simulated */
  source: "store" | "server" | "dev" | null;
}

export interface PlusOffer {
  plan: PlusPlan;
  pkg: Package;
  /** "₺299,99", "€24.99" (the store's own formatting in the player's currency) */
  price: string;
  /** a free trial, in days (0 = none) */
  trialDays: number;
  /** yearly: what a month comes to, for the "per month" line */
  perMonth?: string;
}

const KEY = "plus-v1";
const API_KEY = Platform.select({ ios: process.env.EXPO_PUBLIC_RC_IOS_KEY, android: process.env.EXPO_PUBLIC_RC_ANDROID_KEY });

let state: PlusState = { active: false, until: 0, source: null };
let loaded: Promise<void> | null = null;
let configured = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

function purchases(): Purchases["default"] | null {
  if (!MONETIZE || !API_KEY) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require("react-native-purchases") as Purchases).default;
  } catch {
    return null;
  }
}

/** Can anything be bought in this build (native module + API key)? */
export const purchasesAvailable = () => purchases() !== null;

function load() {
  return (loaded ??= AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (raw) {
        const s = JSON.parse(raw) as PlusState;
        // an expired cache is just "none" (the store or server will say if it renewed)
        state = s.until && s.until < Date.now() && s.source !== "dev" ? { active: false, until: 0, source: null } : s;
      }
    })
    .catch(() => {})
    .then(emit));
}

function set(next: PlusState) {
  state = next;
  emit();
  AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
}

function fromCustomerInfo(info: CustomerInfo): PlusState {
  const ent = info.entitlements.active[PLUS_ENTITLEMENT];
  if (!ent) return { active: false, until: 0, source: "store" };
  const until = ent.expirationDate ? Date.parse(ent.expirationDate) : PLUS_FOREVER;
  return { active: true, until: Number.isFinite(until) ? until : PLUS_FOREVER, source: "store" };
}

const isActive = (s: PlusState) => s.active && (s.until === 0 || s.until > Date.now());

/** Synchronous read for code paths that can't wait (the XP cap, the interstitial gate). */
export function plusActive() {
  return isActive(state);
}

/** Plus right now; the paywall, Settings and every gate read this. */
export function usePlus(): PlusState & { active: boolean } {
  const s = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      load();
      return () => {
        listeners.delete(fn);
      };
    },
    () => state
  );
  return { ...s, active: isActive(s) };
}

/** Signed in: the account's answer (server-accounts.js) wins over an old cache, never over a store receipt we just saw. */
export function applyServerPlus(plus: boolean, until: number) {
  load().then(() => {
    if (state.source === "dev") return;
    if (plus) set({ active: true, until, source: state.source === "store" && state.active ? state.source : "server" });
    else if (state.source === "server" || !state.active) set({ active: false, until: 0, source: null });
  });
}

/** The server call that stores the entitlement on the account (lib/account.ts registers it). */
let serverSync: ((force: boolean) => Promise<void>) | null = null;
export function setPlusServerSync(fn: typeof serverSync) {
  serverSync = fn;
}

/**
 * App start / sign-in: configure RevenueCat (once), log the account in so the purchase follows it,
 * and read the current entitlement. `uid` null = guest (anonymous RevenueCat id).
 */
export async function initPlus(uid: string | null) {
  await load();
  const P = purchases();
  if (!P) return;
  try {
    if (!configured) {
      P.configure({ apiKey: API_KEY!, appUserID: uid ?? undefined });
      configured = true;
      P.addCustomerInfoUpdateListener((info) => {
        const next = fromCustomerInfo(info);
        if (next.active || state.source === "store") set(next);
        serverSync?.(next.active);
      });
    } else if (uid) {
      const current = await P.getAppUserID();
      if (current !== uid) await P.logIn(uid);
    }
    const info = await P.getCustomerInfo();
    const next = fromCustomerInfo(info);
    if (next.active || state.source === "store" || !state.active) set(next);
  } catch {
    // offline: keep the cached state
  }
}

/** Sign out: back to an anonymous RevenueCat id (the purchase stays with the account). */
export async function plusSignedOut() {
  const P = purchases();
  if (P && configured) await P.logOut().catch(() => {});
  if (state.source !== "dev") set({ active: false, until: 0, source: null });
}

/** The three plans with the store's prices; [] when the store can't be reached. */
export async function loadPlusOffers(): Promise<PlusOffer[]> {
  const P = purchases();
  if (!P) return [];
  try {
    const offerings = await P.getOfferings();
    const cur = offerings.current;
    if (!cur) return [];
    const out: PlusOffer[] = [];
    const add = (plan: PlusPlan, pkg: Package | null) => {
      if (!pkg) return;
      const intro = pkg.product.introPrice;
      const trialDays = intro && intro.price === 0 ? introDays(intro.periodUnit, intro.periodNumberOfUnits) : 0;
      out.push({ plan, pkg, price: pkg.product.priceString, trialDays, perMonth: plan === "yearly" ? pkg.product.pricePerMonthString ?? undefined : undefined });
    };
    add("monthly", cur.monthly);
    add("yearly", cur.annual);
    add("lifetime", cur.lifetime);
    return out;
  } catch {
    return [];
  }
}

function introDays(unit: string, n: number) {
  const u = unit.toUpperCase();
  return u.startsWith("DAY") ? n : u.startsWith("WEEK") ? n * 7 : u.startsWith("MONTH") ? n * 30 : u.startsWith("YEAR") ? n * 365 : n;
}

/** Buy a plan. "ok" / "cancelled" / "error". */
export async function purchasePlus(offer: PlusOffer): Promise<"ok" | "cancelled" | "error"> {
  const P = purchases();
  if (!P) return "error";
  try {
    const { customerInfo } = await P.purchasePackage(offer.pkg);
    const next = fromCustomerInfo(customerInfo);
    set(next);
    serverSync?.(true);
    return next.active ? "ok" : "error";
  } catch (e) {
    return (e as { userCancelled?: boolean }).userCancelled ? "cancelled" : "error";
  }
}

/** Restore purchases (a new phone, a reinstall). True when Plus came back. */
export async function restorePlus(): Promise<boolean> {
  const P = purchases();
  if (!P) return false;
  try {
    const info = await P.restorePurchases();
    const next = fromCustomerInfo(info);
    set(next);
    serverSync?.(true);
    return next.active;
  } catch {
    return false;
  }
}

/** Dev builds only: pretend to have Plus so every gate and the frame can be tried without a store. */
export function simulatePlus(on: boolean) {
  if (!__DEV__) return;
  set(on ? { active: true, until: PLUS_FOREVER, source: "dev" } : { active: false, until: 0, source: null });
}

/** Delete my data */
export function resetPlus() {
  state = { active: false, until: 0, source: null };
  loaded = null;
  emit();
}
