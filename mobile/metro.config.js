// Metro must watch the web project's src/ too: the game logic and data
// (src/lib/*.ts, src/data/*.ts) are shared with the Next.js app.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, "../src")];

module.exports = config;
