/** Release switches. v1 ships without these; flip them on for v2. */
export const ONBOARDING = false;

/**
 * Live Activities (lib/liveActivity.ts, widgets/MatchActivity.tsx). Off until the
 * App ID has the App Groups capability (group.com.alprntrz.tiktako) for both
 * com.alprntrz.tiktako and com.alprntrz.tiktako.ExpoWidgetsTarget in the Apple
 * Developer portal; then set true and put "expo-widgets" back in app.json plugins.
 */
export const LIVE_ACTIVITIES = false;
