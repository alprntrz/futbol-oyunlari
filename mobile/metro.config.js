// Metro must watch the web project's src/ too: the game logic and data
// (src/lib/*.ts, src/data/*.ts) are shared with the Next.js app.
const path = require("path");
// getSentryExpoConfig = Expo's default config plus the debug ids Sentry needs to match source maps.
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, "../src")];

module.exports = config;
