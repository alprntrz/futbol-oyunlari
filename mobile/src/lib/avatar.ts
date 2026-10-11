import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "avatar";

/**
 * Preset avatars. Until the 3D avatar set lands (docs/design/avatar-brief.md) each
 * one is a colour pair with the nickname's initial; ids stay stable so the art
 * can replace them later.
 */
export const AVATARS = [
  { id: "c1", bg: "#16A34A", fg: "#FFFFFF" },
  { id: "c2", bg: "#2563EB", fg: "#FFFFFF" },
  { id: "c3", bg: "#F43F5E", fg: "#FFFFFF" },
  { id: "c4", bg: "#F59E0B", fg: "#0B1220" },
  { id: "c5", bg: "#7C3AED", fg: "#FFFFFF" },
  { id: "c6", bg: "#0B1220", fg: "#F5B800" },
  { id: "c7", bg: "#0EA5E9", fg: "#FFFFFF" },
  { id: "c8", bg: "#DCFCE7", fg: "#0F7A35" },
  { id: "c9", bg: "#FDE68A", fg: "#7A5205" },
  { id: "c10", bg: "#FFE4E6", fg: "#BE123C" },
  { id: "c11", bg: "#E0E7FF", fg: "#3730A3" },
  { id: "c12", bg: "#14532D", fg: "#DCFCE7" },
] as const;

export type AvatarId = (typeof AVATARS)[number]["id"];

export const avatarById = (id: string | null | undefined) => AVATARS.find((a) => a.id === id) ?? AVATARS[0];

let cached: AvatarId | null = null;

/** This phone's avatar: picked at random once, kept until the player changes it. */
export async function loadAvatar(): Promise<AvatarId> {
  if (cached) return cached;
  try {
    const saved = await AsyncStorage.getItem(KEY);
    if (saved && AVATARS.some((a) => a.id === saved)) return (cached = saved as AvatarId);
  } catch {}
  return saveAvatar(AVATARS[Math.floor(Math.random() * AVATARS.length)].id);
}

export async function saveAvatar(id: AvatarId): Promise<AvatarId> {
  cached = id;
  await AsyncStorage.setItem(KEY, id).catch(() => {});
  return id;
}
