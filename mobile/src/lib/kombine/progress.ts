import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "kombine-v1";

/** Best stars per level (index = level), 0 = not won yet. */
export async function loadStars(): Promise<number[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as number[]) : [];
  } catch {
    return [];
  }
}

export async function saveStars(level: number, stars: number) {
  const all = await loadStars();
  all[level] = Math.max(all[level] ?? 0, stars);
  await AsyncStorage.setItem(KEY, JSON.stringify(all)).catch(() => {});
  return all;
}

/** Levels open up one after another: the first not-yet-won one is playable. */
export const unlocked = (stars: number[]) => {
  let i = 0;
  while ((stars[i] ?? 0) > 0) i++;
  return i;
};
