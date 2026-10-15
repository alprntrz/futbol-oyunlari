import AsyncStorage from "@react-native-async-storage/async-storage";
import { File, Paths } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { useSyncExternalStore } from "react";

/**
 * An optional profile photo. It stays on this phone: it is never uploaded, and
 * other players keep seeing the preset avatar (the account stores only that id).
 * The file lives in the app's documents folder; we keep its name (the folder's
 * path changes between app updates on iOS).
 */
const KEY = "photo-v1";

let name: string | null = null;
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

function load() {
  if (loaded) return;
  loaded = true;
  AsyncStorage.getItem(KEY)
    .then((n) => {
      if (n && new File(Paths.document, n).exists) {
        name = n;
        emit();
      }
    })
    .catch(() => {});
}

/** The photo's file uri, or null when the player uses a preset avatar. */
export function useMyPhoto(): string | null {
  const n = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      load();
      return () => {
        listeners.delete(fn);
      };
    },
    () => name
  );
  return n ? new File(Paths.document, n).uri : null;
}

/** Open the photo library with a square crop; the picked image's temporary uri, or null. */
export async function pickPhoto(): Promise<string | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.6 });
  return res.canceled ? null : (res.assets[0]?.uri ?? null);
}

/** Keep a picked image as the profile photo (null = back to the preset avatar). */
export async function savePhoto(uri: string | null) {
  const old = name;
  if (uri) {
    // a fresh name each time, so cached images of the old one don't linger
    const next = `profile-${Date.now()}.jpg`;
    new File(uri).copy(new File(Paths.document, next));
    name = next;
    await AsyncStorage.setItem(KEY, next).catch(() => {});
  } else {
    name = null;
    await AsyncStorage.removeItem(KEY).catch(() => {});
  }
  if (old && old !== name) {
    try {
      new File(Paths.document, old).delete();
    } catch {}
  }
  emit();
}

/** Delete my data: the photo goes too (run before the storage is wiped). */
export async function resetPhoto() {
  name = (await AsyncStorage.getItem(KEY).catch(() => null)) ?? name;
  await savePhoto(null).catch(() => {});
}
