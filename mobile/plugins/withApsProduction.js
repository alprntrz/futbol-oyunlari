// expo-widgets writes aps-environment = development when push updates are on;
// TestFlight and the App Store need production (Live Activity updates over APNs,
// server-live.js). Listed before "expo-widgets" in app.json so this mod runs after
// the widgets one (mods run in reverse order).
const { withEntitlementsPlist } = require("expo/config-plugins");

module.exports = function withApsProduction(config) {
  return withEntitlementsPlist(config, (mod) => {
    mod.modResults["aps-environment"] = "production";
    return mod;
  });
};
