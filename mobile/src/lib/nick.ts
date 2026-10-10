import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "nick";

const NAMES = [
  "lucas", "mateo", "jonas", "luca", "liam", "noah", "oliver", "james", "jack", "harry", "ethan", "leo", "hugo", "louis", "jules", "theo", "enzo", "paul", "felix", "max", "finn", "lukas", "niklas", "matteo", "lorenzo", "marco", "giulia", "sofia", "alejandro", "diego", "pablo", "javi", "lucia", "carlos", "joao", "rafa", "tiago", "bruno", "pedro", "gabriel", "thiago", "nico", "santi", "martina", "valentina", "sven", "lars", "erik", "mats", "anders", "piotr", "kuba", "marek", "ivan", "luka", "nikola", "dmitri", "andrei", "yuki", "kenji", "minjun", "jisoo", "wei", "arjun", "rohan", "omar", "youssef", "karim", "amir", "kofi", "kwame", "chidi", "emma", "chloe", "mia", "ana", "nina", "sara", "eva",
];
const TAILS = ["", "", "", "7", "9", "10", "11", "22", "23", "99", "88", "04", "12", "_fc", "_10", "_gol", "fc", "_99", "77", "14"];

const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

/** A nickname that reads like one a person picked: "lucas10", "Mateo_fc", "yuki". */
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
