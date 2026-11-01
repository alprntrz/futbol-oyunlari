import { usePathname } from "expo-router";
import { useEffect } from "react";
import { Alert } from "react-native";

import { dict, type TKey } from "@/lib/strings";

import { useI18n } from "./i18n";
import { roomOfLink } from "./roomLinkPath";

/**
 * A tiktako:// room link (a Live Activity, a link from another app) joins that room, and joining
 * leaves the match this phone is seated in (a live series counts as a loss). So a link that
 * arrives while the app runs asks first, unless it is the room already on screen (the match's own
 * Live Activity). In-app navigation (lobby, queue, invites, rematch) never comes through here.
 * A cold start opens the link directly: a new run holds no seat it could lose.
 */
let openPath = "";
let say: (k: TKey) => string = (k) => dict.en[k];

/** Root layout: keeps the screen on show and the language for the question. */
export function RoomLinkWatch() {
  const pathname = usePathname();
  const { t } = useI18n();
  useEffect(() => {
    openPath = pathname;
    say = t;
  });
  return null;
}

/** app/+native-intent.tsx: the path to open, or null to stay where the player is. */
export function confirmRoomLink(path: string, initial: boolean): string | null | Promise<string | null> {
  const room = roomOfLink(path);
  if (!room || initial || room === roomOfLink(openPath)) return path;
  return new Promise((resolve) =>
    Alert.alert(
      say("linkJoinAsk"),
      say("linkJoinDesc"),
      [
        { text: say("cancel"), style: "cancel", onPress: () => resolve(null) },
        { text: say("linkJoin"), onPress: () => resolve(path) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    ),
  );
}
