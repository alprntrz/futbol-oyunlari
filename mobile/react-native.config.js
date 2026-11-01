// 1.1 ships without ads and purchases (docs/release/monetization.md): the JS packages stay installed so
// lib/ads.ts and lib/plus.ts still bundle, but their native SDKs are left out of the build; with
// MONETIZE off (lib/features.ts) nothing asks for them. 1.2 deletes this file (see the tag monetization-full).
module.exports = {
  dependencies: {
    "react-native-google-mobile-ads": { platforms: { ios: null, android: null } },
    "react-native-purchases": { platforms: { ios: null, android: null } },
  },
};
