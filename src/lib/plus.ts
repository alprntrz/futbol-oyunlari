/**
 * Tiktako Plus and ads: the numbers the app and the server agree on. Platform-free.
 *
 * Fair by design: nothing here touches a match. Jokers, lives, clocks and Elo stay the
 * same for everyone; Plus and ads only change how much *practice* a player can do and
 * what they can look at (the archive) or wear (a frame).
 */

/** RevenueCat entitlement id (dashboard → Entitlements). */
export const PLUS_ENTITLEMENT = "plus";

/** Store product ids (App Store Connect and Google Play, the same ids on both). */
export const PLUS_PRODUCTS = {
  monthly: "tiktako_plus_monthly",
  yearly: "tiktako_plus_yearly",
  lifetime: "tiktako_plus_lifetime",
} as const;
export type PlusPlan = keyof typeof PLUS_PRODUCTS;

/** Lifetime: the server stores this far-away date instead of "no end". */
export const PLUS_FOREVER = Date.UTC(2100, 0, 1);

/** How far back the archive of past daily puzzles goes (Plus). */
export const ARCHIVE_DAYS = 30;

/** What Plus gives, in the order the paywall lists it (strings: plusPerk_<id>). */
export const PLUS_PERKS = ["noAds", "noCap", "archive", "streak", "frame"] as const;
export type PlusPerk = (typeof PLUS_PERKS)[number];

/**
 * Ad rules. Rewarded ads are opt-in and only ever buy more *practice*; interstitials
 * show only after a finished solo game, never over a clock or an online match.
 */
export const AD_RULES = {
  /** one rewarded ad opens this much more practice XP for the day, this many times a day */
  capLiftXp: 150,
  capLiftsPerDay: 2,
  /** a lost play streak can be repaired once in this many days (ad, or free with Plus) */
  streakRepairDays: 30,
  /** interstitials: none in the first days after install, at most this many a session, this far apart */
  interstitialAfterDays: 3,
  interstitialsPerSession: 2,
  interstitialGapMs: 4 * 60_000,
  /** and never within this long of the app opening (the first game of a session is free of them) */
  interstitialWarmupMs: 3 * 60_000,
} as const;
