#!/usr/bin/env node
/**
 * Over-the-air JS update to the store builds (expo-updates, channel "production").
 * Usage (in mobile/): npm run ota -- "what changed"
 *
 * `eas update` bundles on this machine, so the EXPO_PUBLIC_* values must come from the
 * production build profile in eas.json (else the update would talk to localhost). It
 * reaches only builds with the same app version (runtimeVersion policy "appVersion"):
 * JS / asset fixes only; a new native module, permission or plugin needs a store build.
 * With SENTRY_AUTH_TOKEN set, the update's source maps go to Sentry too (else crash stacks stay minified).
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const message = process.argv.slice(2).join(" ").trim();
if (!message) {
  console.error('usage: npm run ota -- "what changed"');
  process.exit(1);
}
const env = JSON.parse(readFileSync(new URL("../eas.json", import.meta.url), "utf8")).build.production.env;
if (!env?.EXPO_PUBLIC_SOCKET_URL?.startsWith("https://")) {
  console.error("eas.json production env has no https EXPO_PUBLIC_SOCKET_URL; refusing to publish");
  process.exit(1);
}
execFileSync("npx", ["eas-cli", "update", "--channel", "production", "--message", message, "--non-interactive"], {
  stdio: "inherit",
  env: { ...process.env, ...env },
});
if (process.env.SENTRY_AUTH_TOKEN) {
  execFileSync("npx", ["sentry-expo-upload-sourcemaps", "dist"], { stdio: "inherit" });
} else {
  console.warn("SENTRY_AUTH_TOKEN not set: source maps not uploaded to Sentry");
}
