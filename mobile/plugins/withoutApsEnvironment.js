// expo-widgets adds the aps-environment entitlement even with push updates off
// (enablePushNotifications: false), and the App Store profile has no Push
// Notifications capability, so the build fails. Live Activities here are local
// only: drop the entitlement again. Listed before "expo-widgets" in app.json so
// its mod runs after the widgets one (mods run in reverse order).
const { withEntitlementsPlist } = require("expo/config-plugins");

module.exports = function withoutApsEnvironment(config) {
  return withEntitlementsPlist(config, (mod) => {
    delete mod.modResults["aps-environment"];
    return mod;
  });
};
