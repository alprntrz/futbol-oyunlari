import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";
import { useEffect } from "react";

import { dayNumber } from "@/lib/daily";

import { isGameAward, onOverlay, onRewardOpen, onXpAward } from "./xp";

/**
 * Asks for a rating with the system's own sheet (iOS SKStoreReviewController, Google Play
 * in-app review): stars right in the app, no trip to the store. Apple's rules forbid our own
 * "Do you like it?" step before it, so there is none. First time: after the first finished
 * game, once the victory / reward screens have closed. Again at most every 60 days, after a
 * game. The system decides whether the sheet really shows (iOS: 3 times a year at most).
 */
const KEY = "rating-v1";
const AGAIN_DAYS = 60;
const DELAY_MS = 1500;

let last = -1; // day of the last ask, -1 = never
let loaded: Promise<void> | null = null;
let pending = false;
let overlay = false;
let reward = false;
let timer: ReturnType<typeof setTimeout> | null = null;

function load() {
  return (loaded ??= AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (raw) last = Number(raw);
    })
    .catch(() => {}));
}

function maybeAsk() {
  if (!pending || overlay || reward) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    timer = null;
    if (!pending || overlay || reward) return;
    pending = false;
    try {
      if (!(await StoreReview.hasAction())) return;
      last = dayNumber();
      AsyncStorage.setItem(KEY, String(last)).catch(() => {});
      await StoreReview.requestReview();
    } catch {
      // not available (simulator without a store, old OS): ask another time
    }
  }, DELAY_MS);
}

/** Root layout: listens for finished games and asks when the screen is calm. */
export function RatingAsk() {
  useEffect(() => {
    const offAward = onXpAward((a) => {
      if (!isGameAward(a)) return;
      load().then(() => {
        if (last >= 0 && dayNumber() - last < AGAIN_DAYS) return;
        pending = true;
        maybeAsk();
      });
    });
    const offOverlay = onOverlay((open) => {
      overlay = open;
      maybeAsk();
    });
    const offReward = onRewardOpen((open) => {
      reward = open;
      maybeAsk();
    });
    return () => {
      offAward();
      offOverlay();
      offReward();
    };
  }, []);
  return null;
}
