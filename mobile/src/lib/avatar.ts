import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ImageSourcePropType } from "react-native";

const KEY = "avatar";

/**
 * Preset 3D avatars (docs/design/avatar-brief.md → mobile/assets/brand/avatar/).
 * Original characters, not real players. `bg` is the circle behind the bust.
 * The ids are stored on the account (server-accounts.js AVATARS): keep them stable.
 */
export const AVATARS = [
  { id: "striker", image: require("../../assets/brand/avatar/striker.png"), bg: "#DCFCE7" },
  { id: "keeper", image: require("../../assets/brand/avatar/keeper.png"), bg: "#DBEAFE" },
  { id: "captain", image: require("../../assets/brand/avatar/captain.png"), bg: "#FEF3C7" },
  { id: "playmaker", image: require("../../assets/brand/avatar/playmaker.png"), bg: "#EDE9FE" },
  { id: "coach", image: require("../../assets/brand/avatar/coach.png"), bg: "#E2E8F0" },
  { id: "fan", image: require("../../assets/brand/avatar/fan.png"), bg: "#FFE4E6" },
  { id: "referee", image: require("../../assets/brand/avatar/referee.png"), bg: "#FEF9C3" },
  { id: "ball", image: require("../../assets/brand/avatar/ball.png"), bg: "#DCFCE7" },
  { id: "legend-curls", image: require("../../assets/brand/avatar/legend-curls.png"), bg: "#F1F5F9" },
  { id: "legend-mohawk", image: require("../../assets/brand/avatar/legend-mohawk.png"), bg: "#FEE2E2" },
  { id: "legend-bun", image: require("../../assets/brand/avatar/legend-bun.png"), bg: "#E0F2FE" },
  { id: "legend-bald", image: require("../../assets/brand/avatar/legend-bald.png"), bg: "#D1FAE5" },
  { id: "legend-braids", image: require("../../assets/brand/avatar/legend-braids.png"), bg: "#FEF9C3" },
  { id: "legend-shades", image: require("../../assets/brand/avatar/legend-shades.png"), bg: "#E5E7EB" },
  { id: "legend-celebration", image: require("../../assets/brand/avatar/legend-celebration.png"), bg: "#FFEDD5" },
  { id: "legend-retro-keeper", image: require("../../assets/brand/avatar/legend-retro-keeper.png"), bg: "#F3F4F6" },
] as const satisfies readonly { id: string; image: ImageSourcePropType; bg: string }[];

export type AvatarId = (typeof AVATARS)[number]["id"];

/** v1.1 betas stored colour ids: each maps to the character of that colour. */
const LEGACY: Record<string, AvatarId> = {
  c1: "striker",
  c2: "keeper",
  c3: "fan",
  c4: "captain",
  c5: "playmaker",
  c6: "coach",
  c7: "legend-bun",
  c8: "ball",
  c9: "legend-braids",
  c10: "legend-mohawk",
  c11: "legend-curls",
  c12: "legend-bald",
};

const normalise = (id: string | null | undefined) => (id ? (LEGACY[id] ?? id) : id);

export const avatarById = (id: string | null | undefined) => AVATARS.find((a) => a.id === normalise(id)) ?? AVATARS[0];

let cached: AvatarId | null = null;

/** This phone's avatar: picked at random once, kept until the player changes it. */
export async function loadAvatar(): Promise<AvatarId> {
  if (cached) return cached;
  try {
    const saved = normalise(await AsyncStorage.getItem(KEY));
    if (saved && AVATARS.some((a) => a.id === saved)) return (cached = saved as AvatarId);
  } catch {}
  return saveAvatar(AVATARS[Math.floor(Math.random() * AVATARS.length)].id);
}

export async function saveAvatar(id: AvatarId | string): Promise<AvatarId> {
  cached = avatarById(id).id;
  await AsyncStorage.setItem(KEY, cached).catch(() => {});
  return cached;
}
