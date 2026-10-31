import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useEffect, useRef } from "react";

import { play } from "./sound";

const KEY = "haptics-on";
let enabled = true;
AsyncStorage.getItem(KEY)
  .then((v) => {
    if (v === "0") enabled = false;
  })
  .catch(() => {});

const fire = (run: () => Promise<void>) => {
  if (enabled) run().catch(() => {});
};

/** Fire-and-forget haptic feedback (ignored where unsupported or turned off in Settings). */
export const haptic = {
  tap: () => fire(() => Haptics.selectionAsync()),
  press: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  success: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  error: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  warning: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};

export const hapticsOn = () => enabled;
export function setHapticsOn(on: boolean) {
  enabled = on;
  AsyncStorage.setItem(KEY, on ? "1" : "0").catch(() => {});
}

/** Last-seconds tension on a move clock: a tick each second 5..1 while it's `mine`, a warning at 0 (same as PlanClock). */
export function useClockTicks(secs: number | null | undefined, mine: boolean) {
  useEffect(() => {
    if (!mine || secs == null) return;
    if (secs > 0 && secs <= 5) haptic.tap();
    else if (secs === 0) haptic.warning();
  }, [secs, mine]);
}

/** "Your turn": a light buzz and a pop whenever the move comes (back) to this phone, never on your own move. */
export function useTurnCue(mine: boolean) {
  const was = useRef(false);
  useEffect(() => {
    if (mine && !was.current) {
      haptic.press();
      play("pop");
    }
    was.current = mine;
  }, [mine]);
}
