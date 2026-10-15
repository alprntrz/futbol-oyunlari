/** Release switches. v1 ships without these; flip them on for v2. */
export const ONBOARDING = false;

/**
 * Live Activities (lib/liveActivity.ts, widgets/MatchActivity.tsx). Needs the App
 * Groups capability (group.com.alprntrz.tiktako) on com.alprntrz.tiktako and
 * com.alprntrz.tiktako.ExpoWidgetsTarget (set in the Apple portal by hand; build
 * with EXPO_NO_CAPABILITY_SYNC=1, EAS can't sync it) and "expo-widgets" in app.json plugins.
 */
export const LIVE_ACTIVITIES = true;

/**
 * Live Activity updates over APNs while the app is in the background (server-live.js).
 * Must match app.json: "expo-widgets" with enablePushNotifications and
 * ./plugins/withApsProduction (aps-environment = production). Needs the Push
 * Notifications capability on com.alprntrz.tiktako (Apple portal) and an APNs key
 * on the server (APNS_KEY, APNS_KEY_ID; APPLE_TEAM_ID).
 */
export const LIVE_PUSH = true;

/**
 * Home layout: "list" (status, quick play, today's puzzles, quests, versus modes),
 * "fixtures" (draft B, components/HomeFixtures.tsx: today's dailies as a match-day list)
 * or "pitch" (draft C, components/HomePitch.tsx, not liked: kept for reference).
 */
export const HOME_LAYOUT: "list" | "fixtures" | "pitch" = "fixtures";
