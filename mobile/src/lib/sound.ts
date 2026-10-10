import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

/** Game sound effects (synthesised by scripts/game-sounds.py). */
const SOURCES = {
  tap: require("../../assets/sounds/tap.wav"),
  pop: require("../../assets/sounds/pop.wav"),
  coin: require("../../assets/sounds/coin.wav"),
  correct: require("../../assets/sounds/correct.wav"),
  wrong: require("../../assets/sounds/wrong.wav"),
  whoosh: require("../../assets/sounds/whoosh.wav"),
  stamp: require("../../assets/sounds/stamp.wav"),
  tick: require("../../assets/sounds/tick.wav"),
  victory: require("../../assets/sounds/victory.wav"),
  lose: require("../../assets/sounds/lose.wav"),
  levelup: require("../../assets/sounds/levelup.wav"),
  start: require("../../assets/sounds/start.wav"),
} as const;
export type SoundName = keyof typeof SOURCES;

const KEY = "sound-on";
let enabled = true;
let ready = false;
const players: Partial<Record<SoundName, AudioPlayer>> = {};

/** Loads the sounds once (and the on/off setting); safe to call repeatedly. */
export function initSounds() {
  if (ready) return;
  ready = true;
  // respect the silent switch, and never stop the user's own music
  setAudioModeAsync({ playsInSilentMode: false, interruptionMode: "mixWithOthers" }).catch(() => {});
  AsyncStorage.getItem(KEY)
    .then((v) => {
      if (v === "0") enabled = false;
    })
    .catch(() => {});
  for (const name of Object.keys(SOURCES) as SoundName[]) {
    try {
      const p = createAudioPlayer(SOURCES[name]);
      p.volume = name === "tap" || name === "tick" ? 0.5 : 0.8;
      players[name] = p;
    } catch {}
  }
}

/** Plays a sound from the start (overlapping plays restart it). */
export function play(name: SoundName) {
  if (!enabled) return;
  if (!ready) initSounds();
  const p = players[name];
  if (!p) return;
  try {
    p.seekTo(0);
    p.play();
  } catch {}
}

export const soundsOn = () => enabled;
export function setSoundsOn(on: boolean) {
  enabled = on;
  AsyncStorage.setItem(KEY, on ? "1" : "0").catch(() => {});
}
