import { confirmRoomLink } from "~/lib/roomLink";

/** Every link the system opens the app with (never in-app navigation): room links ask first (lib/roomLink.ts). */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  try {
    return confirmRoomLink(path, initial);
  } catch {
    // never join unasked
    return null;
  }
}
