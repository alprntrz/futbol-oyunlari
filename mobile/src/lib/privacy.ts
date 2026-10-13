import AsyncStorage from "@react-native-async-storage/async-storage";
import { reloadAppAsync } from "expo";

import { loadPlayerId } from "./nick";
import { getSocket } from "./socket";
import { resetDailyRewards } from "./dailyRewards";
import { resetPlayStreak } from "./playStreak";
import { resetQuests } from "./quests";
import { resetTaktik } from "./taktik";
import { resetXpCache } from "./xp";

/**
 * "Delete my data": the server forgets this phone's quiz record, every local
 * key (stats, progress, nickname, player id, settings) is wiped and the app
 * restarts as if freshly installed. Local data goes even if the server can't
 * be reached; the result says whether the server part went through.
 */
export async function deleteMyData(): Promise<{ server: boolean }> {
  const pid = await loadPlayerId();
  const server = await new Promise<boolean>((resolve) => {
    getSocket()
      .timeout(5000)
      .emit("qz:forget", { pid }, (err: Error | null, res?: { ok: boolean }) => resolve(!err && !!res?.ok));
  });
  await AsyncStorage.clear().catch(() => {});
  resetXpCache();
  resetQuests();
  resetPlayStreak();
  resetTaktik();
  resetDailyRewards();
  return { server };
}

export const restartApp = () => reloadAppAsync().catch(() => {});
