import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "ht-trophies";

/** Hat-trick series won on this phone (any mode). */
export async function loadTrophies(): Promise<number> {
  try {
    return Number((await AsyncStorage.getItem(KEY)) ?? 0) || 0;
  } catch {
    return 0;
  }
}

export async function addTrophy(): Promise<number> {
  const n = (await loadTrophies()) + 1;
  await AsyncStorage.setItem(KEY, String(n)).catch(() => {});
  return n;
}
