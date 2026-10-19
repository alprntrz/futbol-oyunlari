// Dribbling Rush 3D: the Unity player (unity/DribblingRush → unity/build.sh) embedded with
// @azesmway/react-native-unity.
// - iOS: the package's podspec vendors ios/UnityFramework.xcframework from its own folder, so the framework
//   built into mobile/unity/builds/ios is copied there before `pod install` (its prepare_command doesn't run
//   for local pods).
// - Android: the package's own plugin adds unity/builds/android/unityLibrary to the Gradle build.
// Without those builds prebuild stops with a pointer to unity/build.sh (EAS gets them through .easignore).
const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("expo/config-plugins");
const withUnityAndroid = require("@azesmway/react-native-unity/app.plugin.js").default ?? require("@azesmway/react-native-unity/app.plugin.js");

const missing = (what) =>
  new Error(`Dribbling Rush: ${what} is missing. Build it first: ./unity/build.sh ${what.includes("android") ? "android" : "ios"} (see unity/README.md).`);

function withUnityIos(config) {
  return withDangerousMod(config, [
    "ios",
    (mod) => {
      const root = mod.modRequest.projectRoot;
      const src = path.join(root, "unity/builds/ios/UnityFramework.xcframework");
      if (!fs.existsSync(src)) throw missing("unity/builds/ios/UnityFramework.xcframework");
      const pkg = path.dirname(require.resolve("@azesmway/react-native-unity/package.json", { paths: [root] }));
      const dest = path.join(pkg, "ios/UnityFramework.xcframework");
      fs.rmSync(dest, { recursive: true, force: true });
      fs.rmSync(path.join(pkg, "ios/UnityFramework.framework"), { recursive: true, force: true });
      fs.cpSync(src, dest, { recursive: true });
      return mod;
    },
  ]);
}

function withUnityAndroidChecked(config) {
  return withDangerousMod(withUnityAndroid(config), [
    "android",
    (mod) => {
      const root = mod.modRequest.projectRoot;
      const lib = path.join(root, "unity/builds/android/unityLibrary");
      if (!fs.existsSync(lib)) throw missing("unity/builds/android/unityLibrary");
      // the package's Gradle script predates Gradle 9 / AGP 9: jcenter() and lintOptions {} no longer exist
      const pkg = path.dirname(require.resolve("@azesmway/react-native-unity/package.json", { paths: [root] }));
      const gradle = path.join(pkg, "android/build.gradle");
      const src = fs.readFileSync(gradle, "utf8");
      const fixed = src.replace(/^\s*jcenter\(\)\s*$/m, "").replace(/\blintOptions\s*\{/, "lint {");
      if (fixed !== src) fs.writeFileSync(gradle, fixed);
      return mod;
    },
  ]);
}

module.exports = function withUnity(config) {
  return withUnityAndroidChecked(withUnityIos(config));
};
