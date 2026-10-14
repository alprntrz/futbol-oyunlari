/** Release switches. v1 ships without these; flip them on for v2. */
export const ONBOARDING = false;

/**
 * Live Activities (lib/liveActivity.ts, widgets/MatchActivity.tsx). Needs the App
 * Groups capability (group.com.alprntrz.tiktako) on com.alprntrz.tiktako and
 * com.alprntrz.tiktako.ExpoWidgetsTarget (set in the Apple portal by hand; build
 * with EXPO_NO_CAPABILITY_SYNC=1, EAS can't sync it) and "expo-widgets" in app.json plugins.
 */
export const LIVE_ACTIVITIES = true;
