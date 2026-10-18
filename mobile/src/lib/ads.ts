import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Platform, TurboModuleRegistry } from "react-native";

import { dayNumber } from "@/lib/daily";
import { AD_RULES } from "@/lib/plus";

import { MONETIZE } from "./features";
import { plusActive } from "./plus";
import { isGameAward, onOverlay, onRewardOpen, onXpAward } from "./xp";

/**
 * Ads (Google AdMob through react-native-google-mobile-ads), the fair way:
 *
 * - Rewarded videos are opt-in: the player taps "watch an ad" to buy more *practice* (lift the
 *   daily practice-XP cap, repair a lost play streak, double the daily gift). Nothing in a match.
 * - One interstitial now and then after a finished *solo* game: never over a clock or an online
 *   match, none in the first days after install, a few minutes apart, at most two a session
 *   (AD_RULES in src/lib/plus.ts). Plus turns them off.
 * - Consent first: Google's UMP form (GDPR / UK / US state laws, as set up in the AdMob console)
 *   and, on iOS, the App Tracking Transparency prompt. No consent = non-personalised ads.
 *
 * The native module is missing in Expo Go and the ad unit ids come from eas.json
 * (EXPO_PUBLIC_ADMOB_*); without them a dev build uses Google's test units and a store build shows
 * nothing. Every entry point asks `adsAvailable()` first.
 */
type Ads = typeof import("react-native-google-mobile-ads");

export type RewardedPlacement = "capLift" | "streakRepair" | "giftDouble";

const KEY = "ads-v1";
interface AdsState {
  /** day number of the first launch with ads in the app (interstitials wait AD_RULES.interstitialAfterDays) */
  firstDay: number;
  /** did the consent flow run (so Settings can offer "Privacy options" once it has) */
  consented: boolean;
}

const UNITS = {
  rewarded: Platform.select({ ios: process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS, android: process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID }),
  interstitial: Platform.select({ ios: process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS, android: process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID }),
};

function adsModule(): Ads | null {
  if (!MONETIZE) return null;
  // Expo Go / a build without the plugin: the module's own getEnforcing() would throw, and a throw inside
  // a require() made after start-up is reported by Metro as a fatal error (red screen) instead of reaching
  // our catch, so ask the registry first (null when the native side isn't there).
  if (!TurboModuleRegistry.get("RNGoogleMobileAdsModule")) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("react-native-google-mobile-ads") as Ads;
  } catch {
    return null;
  }
}

/** The ad unit to use: the real one from eas.json, Google's test unit in a dev build, none otherwise. */
function unitId(kind: keyof typeof UNITS): string | null {
  const real = UNITS[kind];
  if (real) return real;
  const m = adsModule();
  if (!m || !__DEV__) return null;
  return kind === "rewarded" ? m.TestIds.REWARDED : m.TestIds.INTERSTITIAL;
}

/** Can this build show ads at all (native module present, a unit id to load)? */
export function adsAvailable() {
  return adsModule() !== null && unitId("rewarded") !== null;
}

let state: AdsState | null = null;
let stateLoading: Promise<AdsState> | null = null;
function loadState() {
  return (stateLoading ??= AsyncStorage.getItem(KEY)
    .then((raw) => (raw ? (JSON.parse(raw) as AdsState) : null))
    .catch(() => null)
    .then((s) => {
      state = s ?? { firstDay: dayNumber(), consented: false };
      if (!s) AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
      return state;
    }));
}
function saveState(patch: Partial<AdsState>) {
  state = { ...(state ?? { firstDay: dayNumber(), consented: false }), ...patch };
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
}

// ── Consent + SDK start (once per run, on first need)

let ready: Promise<boolean> | null = null;
let personalised = false;
let privacyOptionsRequired = false;
const readyListeners = new Set<() => void>();

/**
 * Gather consent (UMP form if the region needs one, then ATT on iOS) and start the SDK.
 * Resolves false when ads can't run here. Safe to call many times.
 */
export function ensureAds(): Promise<boolean> {
  return (ready ??= (async () => {
    const m = adsModule();
    if (!m || !unitId("rewarded")) return false;
    await loadState();
    try {
      const info = await m.AdsConsent.gatherConsent();
      privacyOptionsRequired = info.privacyOptionsRequirementStatus === m.AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;
      // the form ran (or wasn't needed): remember so Settings can show "Privacy options"
      saveState({ consented: true });
      if (!info.canRequestAds) return false;
    } catch {
      // the consent SDK failed (no network on first run): no ads this session, try again next time
      ready = null;
      return false;
    }
    if (Platform.OS === "ios") {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const att = require("expo-tracking-transparency") as typeof import("expo-tracking-transparency");
        const res = await att.requestTrackingPermissionsAsync();
        personalised = res.granted;
      } catch {
        personalised = false;
      }
    } else {
      try {
        const choices = await m.AdsConsent.getUserChoices();
        personalised = choices.selectPersonalisedAds;
      } catch {
        personalised = false;
      }
    }
    try {
      // a game for everyone: no mature ad content, and nothing aimed at under-age players
      await m.default().setRequestConfiguration({ maxAdContentRating: m.MaxAdContentRating.PG, tagForUnderAgeOfConsent: false });
      await m.default().initialize();
    } catch {
      ready = null;
      return false;
    }
    readyListeners.forEach((fn) => fn());
    preloadRewarded();
    preloadInterstitial();
    return true;
  })());
}

/** Settings → "Privacy options": only where the law gives the player a form to come back to. */
export function privacyOptionsAvailable() {
  return privacyOptionsRequired;
}
export async function showPrivacyOptions() {
  const m = adsModule();
  if (!m) return;
  await m.AdsConsent.showPrivacyOptionsForm().catch(() => {});
}

const requestOptions = () => ({ requestNonPersonalizedAdsOnly: !personalised });

// ── Rewarded: one loaded ad waiting, the next one loads as soon as it's shown

type Rewarded = ReturnType<Ads["RewardedAd"]["createForAdRequest"]>;
let rewarded: Rewarded | null = null;
let rewardedLoaded = false;
let rewardedTimer: ReturnType<typeof setTimeout> | null = null;
const rewardedListeners = new Set<() => void>();
const emitRewarded = () => rewardedListeners.forEach((fn) => fn());

function preloadRewarded(retryMs = 0) {
  const m = adsModule();
  const unit = unitId("rewarded");
  if (!m || !unit || rewarded) return;
  if (rewardedTimer) clearTimeout(rewardedTimer);
  rewardedTimer = setTimeout(() => {
    rewardedTimer = null;
    const ad = m.RewardedAd.createForAdRequest(unit, requestOptions());
    rewarded = ad;
    rewardedLoaded = false;
    ad.addAdEventListener(m.RewardedAdEventType.LOADED, () => {
      rewardedLoaded = true;
      emitRewarded();
    });
    ad.addAdEventListener(m.AdEventType.ERROR, () => {
      // no fill / offline: drop this one and try again later, slower each time
      rewarded = null;
      rewardedLoaded = false;
      emitRewarded();
      preloadRewarded(Math.min(5 * 60_000, Math.max(15_000, retryMs * 2)));
    });
    ad.load();
  }, retryMs);
}

/** Is a rewarded ad loaded and ready to show right now? (the sheet's button state) */
export function useRewardedReady() {
  const [, bump] = useState(0);
  useEffect(() => {
    const fn = () => bump((n) => n + 1);
    rewardedListeners.add(fn);
    readyListeners.add(fn);
    ensureAds();
    return () => {
      rewardedListeners.delete(fn);
      readyListeners.delete(fn);
    };
  }, []);
  return rewardedLoaded;
}

/**
 * Show a rewarded ad. "earned" once the player watched it through, "closed" when they left early,
 * "unavailable" when there was nothing to show (offline, no fill, Expo Go).
 */
export async function showRewarded(placement: RewardedPlacement): Promise<"earned" | "closed" | "unavailable"> {
  const m = adsModule();
  if (!m || !(await ensureAds())) return "unavailable";
  // not loaded yet: give it a moment (the player just tapped, the ad may be a second away)
  if (!rewardedLoaded) {
    preloadRewarded();
    await new Promise<void>((resolve) => {
      const done = () => {
        rewardedListeners.delete(done);
        resolve();
      };
      rewardedListeners.add(done);
      setTimeout(done, 6000);
    });
  }
  const ad = rewarded;
  if (!ad || !rewardedLoaded) return "unavailable";
  return new Promise((resolve) => {
    let earned = false;
    const offEarn = ad.addAdEventListener(m.RewardedAdEventType.EARNED_REWARD, () => {
      earned = true;
    });
    const offClose = ad.addAdEventListener(m.AdEventType.CLOSED, () => {
      offEarn();
      offClose();
      rewarded = null;
      rewardedLoaded = false;
      emitRewarded();
      preloadRewarded(500);
      resolve(earned ? "earned" : "closed");
    });
    ad.show().catch(() => {
      offEarn();
      offClose();
      rewarded = null;
      rewardedLoaded = false;
      emitRewarded();
      preloadRewarded(2000);
      resolve("unavailable");
    });
    void placement;
  });
}

// ── Interstitial: after a finished solo game, within the caps

type Interstitial = ReturnType<Ads["InterstitialAd"]["createForAdRequest"]>;
let interstitial: Interstitial | null = null;
let interstitialLoaded = false;
let shownThisSession = 0;
let lastShownAt = 0;
const startedAt = Date.now();

function preloadInterstitial(retryMs = 0) {
  const m = adsModule();
  const unit = unitId("interstitial");
  if (!m || !unit || interstitial) return;
  setTimeout(() => {
    const ad = m.InterstitialAd.createForAdRequest(unit, requestOptions());
    interstitial = ad;
    interstitialLoaded = false;
    ad.addAdEventListener(m.AdEventType.LOADED, () => {
      interstitialLoaded = true;
    });
    ad.addAdEventListener(m.AdEventType.ERROR, () => {
      interstitial = null;
      preloadInterstitial(Math.min(5 * 60_000, Math.max(30_000, retryMs * 2)));
    });
    ad.load();
  }, retryMs);
}

/** Solo games: their award keys (online matches and rewards never trigger an interstitial). */
const SOLO_KEY = /^(xi-|mystery|bingo|run-|ht-solo-|ttk-)/;

/** Would an interstitial be allowed right now, by the caps? (no ad is loaded or shown here) */
export async function interstitialAllowed() {
  if (!adsAvailable() || plusActive()) return false;
  const s = await loadState();
  if (dayNumber() - s.firstDay < AD_RULES.interstitialAfterDays) return false;
  if (shownThisSession >= AD_RULES.interstitialsPerSession) return false;
  if (Date.now() - startedAt < AD_RULES.interstitialWarmupMs) return false;
  if (Date.now() - lastShownAt < AD_RULES.interstitialGapMs) return false;
  return true;
}

async function maybeShowInterstitial() {
  const m = adsModule();
  if (!m || !(await interstitialAllowed())) return;
  if (!(await ensureAds())) return;
  const ad = interstitial;
  if (!ad || !interstitialLoaded) {
    preloadInterstitial();
    return;
  }
  shownThisSession++;
  lastShownAt = Date.now();
  const offClose = ad.addAdEventListener(m.AdEventType.CLOSED, () => {
    offClose();
    interstitial = null;
    interstitialLoaded = false;
    preloadInterstitial(1000);
  });
  ad.show().catch(() => {
    offClose();
    interstitial = null;
    interstitialLoaded = false;
    preloadInterstitial(5000);
  });
}

/**
 * Root layout: starts the SDK a moment after launch (not on a brand-new install: the consent form
 * shouldn't be the first thing a player sees) and shows an interstitial after a finished solo game
 * once the victory / reward screens have closed.
 */
export function AdsHost() {
  useEffect(() => {
    if (!adsAvailable()) return;
    let pending = false;
    let overlay = false;
    let reward = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = () => {
      if (!pending || overlay || reward) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        if (!pending || overlay || reward) return;
        pending = false;
        maybeShowInterstitial();
      }, 1200);
    };
    const offAward = onXpAward((a) => {
      if (!isGameAward(a) || !SOLO_KEY.test(a.key) || plusActive()) return;
      pending = true;
      tick();
    });
    const offOverlay = onOverlay((open) => {
      overlay = open;
      tick();
    });
    const offReward = onRewardOpen((open) => {
      reward = open;
      tick();
    });
    // warm up for returning players (a new install keeps its first session clean; Plus never needs it)
    const warm = setTimeout(() => {
      loadState().then((s) => {
        if (!plusActive() && dayNumber() - s.firstDay >= 1) ensureAds();
      });
    }, 4000);
    return () => {
      offAward();
      offOverlay();
      offReward();
      clearTimeout(warm);
      if (timer) clearTimeout(timer);
    };
  }, []);
  return null;
}

/** Did the consent flow ever run on this phone (Settings shows "Privacy options" only then). */
export function useConsentDone() {
  return useSyncExternalStore(
    (fn) => {
      readyListeners.add(fn);
      loadState().then(fn);
      return () => {
        readyListeners.delete(fn);
      };
    },
    () => !!state?.consented
  );
}
