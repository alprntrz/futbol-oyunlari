import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "nick";

const NAMES = [
  "emre", "burak", "mert", "kerem", "can", "ozan", "baris", "efe", "arda", "yusuf", "omer", "selin", "zeynep", "ece",
  "deniz", "berk", "kaan", "onur", "tolga", "serkan", "hakan", "cem", "umut", "alper", "eren", "furkan", "batu",
  "ilkay", "goktug", "sinan", "melis", "ayse", "ali", "volkan", "tuna", "doruk", "lucas", "mateo", "jonas", "luca",
];
const TAILS = ["", "", "07", "10", "1907", "1903", "1905", "34", "35", "06", "16", "61", "99", "23", "_fb", "_gs", "_bjk", "_ts", "10x"];

const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

/** A nickname that reads like one a person picked: "kerem1907", "Ozan_gs", "selin". */
export function randomNick(): string {
  const name = pick(NAMES);
  const cased = Math.random() < 0.4 ? name[0].toUpperCase() + name.slice(1) : name;
  const sep = Math.random() < 0.25 ? pick([".", "_"]) : "";
  const tail = pick(TAILS);
  return tail && !tail.startsWith("_") ? cased + sep + tail : cased + tail;
}

let cached: string | null = null;

/** This phone's nickname: picked once at random, kept until the player changes it. */
export async function loadNick(): Promise<string> {
  if (cached) return cached;
  try {
    const saved = await AsyncStorage.getItem(KEY);
    if (saved) return (cached = saved);
  } catch {}
  return saveNick(randomNick());
}

export async function saveNick(nick: string): Promise<string> {
  cached = nick.trim().slice(0, 20) || randomNick();
  await AsyncStorage.setItem(KEY, cached).catch(() => {});
  return cached;
}
