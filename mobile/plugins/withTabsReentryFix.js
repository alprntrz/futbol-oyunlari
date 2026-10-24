// Android native tabs (react-native-screens 4.26 "gamma" TabsContainer) crash with "FragmentManager is already executing
// transactions" (Sentry TIKTAKO-APP-4) when a tab change arrives while another one is being committed: the old tab's
// onPause emits onWillDisappear, Reanimated flushes mount items inside that event, TabsHost.didMountItems calls
// flushPendingUpdates and the pending selection starts a second commitNow inside the first. Newer screens versions don't
// fit Expo SDK 57, so the package is patched at prebuild (like plugins/withUnity.js does): while a fragment
// transaction is running, flushPendingUpdates waits for the next frame instead.
const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("expo/config-plugins");

const FILE = "android/src/main/java/com/swmansion/rnscreens/gamma/tabs/container/TabsContainer.kt";
const MARK = "tiktako: no nested tab commit";

function patch(src) {
  if (src.includes(MARK)) return src;
  const from = "    fun flushPendingUpdates() {\n";
  if (!src.includes(from)) throw new Error("withTabsReentryFix: TabsContainer.kt changed upstream, check the patch");
  src = src.replace(
    from,
    `    // ${MARK} (plugins/withTabsReentryFix.js)
    private var isCommittingTabs = false

    fun flushPendingUpdates() {
        if (isCommittingTabs) {
            post { flushPendingUpdates() }
            return
        }
`
  );
  // both sync commits run with the flag up
  const commit = /\n(\s*)requireFragmentManager\n(\s*\.createTransactionWithReordering\(\)[\s\S]*?\}\.commitNowAllowingStateLoss\(\))/g;
  const found = src.match(commit)?.length ?? 0;
  if (found < 2) throw new Error("withTabsReentryFix: expected two fragment commits in TabsContainer.kt");
  return src.replace(
    commit,
    (_, indent, rest) =>
      `\n${indent}isCommittingTabs = true\n${indent}try {\n${indent}    requireFragmentManager\n    ${rest.replace(/\n/g, "\n    ")}\n${indent}} finally {\n${indent}    isCommittingTabs = false\n${indent}}`
  );
}

module.exports = function withTabsReentryFix(config) {
  return withDangerousMod(config, [
    "android",
    (mod) => {
      const pkg = path.dirname(require.resolve("react-native-screens/package.json", { paths: [mod.modRequest.projectRoot] }));
      const file = path.join(pkg, FILE);
      const src = fs.readFileSync(file, "utf8");
      const next = patch(src);
      if (next !== src) fs.writeFileSync(file, next);
      return mod;
    },
  ]);
};

module.exports.patch = patch;
