// Dribbling Rush 3D: the Unity player (unity/DribblingRush → unity/build.sh) embedded with
// @azesmway/react-native-unity.
// - iOS: the package's podspec vendors ios/UnityFramework.xcframework from its own folder, so the framework
//   built into mobile/unity/builds/ios is copied there before `pod install` (its prepare_command doesn't run
//   for local pods).
// - Android: the package's own plugin adds unity/builds/android/unityLibrary to the Gradle build. Unity's manifest
//   turns enableOnBackInvokedCallback on while the app (Expo) turns it off; the app's value wins (tools:replace).
// Without those builds prebuild stops with a pointer to unity/build.sh (EAS gets them through .easignore).
const fs = require("fs");
const path = require("path");
const { withAndroidManifest, withDangerousMod } = require("expo/config-plugins");
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
      patchUnityView(pkg);
      return mod;
    },
  ]);
}

/**
 * Opening Dribbling Rush a second time: the player made for the first visit is handed to the new view while it's
 * created, then the screen transition detaches and re-attaches that view, and the detach parks the player in the
 * background where nothing takes it back (a flat green screen). So the view takes the player back when
 * it's attached again, and re-parenting finishes a pending view transition first (the old parent can still be
 * animating out and would keep the player: "The specified child already has a parent", a crash).
 */
function patchUnityView(pkg) {
  const dir = path.join(pkg, "android/src/main/java/com/azesmwayreactnativeunity");
  const edit = (file, mark, from, to) => {
    const f = path.join(dir, file);
    const src = fs.readFileSync(f, "utf8");
    if (src.includes(mark)) return;
    if (!src.includes(from)) throw new Error(`withUnity: ${file} changed upstream, check patchUnityView`);
    fs.writeFileSync(f, src.replace(from, to));
  };
  edit(
    "ReactNativeUnityView.java",
    "tiktako: take the player back",
    "  @Override\n  protected void onDetachedFromWindow() {",
    `  @Override
  protected void onAttachedToWindow() {
    super.onAttachedToWindow();
    // tiktako: take the player back (plugins/withUnity.js)
    if (view != null && !keepPlayerMounted) {
      try {
        addUnityViewToGroup(this);
      } catch (InvocationTargetException | NoSuchMethodException | IllegalAccessException e) {
        Log.e(TAG, "Failed to take the Unity view back", e);
      }
    }
  }

  @Override
  protected void onDetachedFromWindow() {`
  );
  edit(
    "ReactNativeUnity.java",
    "tiktako: finish the transition",
    `        if (unityPlayer.getParentPlayer() != null) {
            ((ViewGroup) unityPlayer.getParentPlayer()).removeView(frame);
        }

        ViewGroup.LayoutParams layoutParams = new ViewGroup.LayoutParams(MATCH_PARENT, MATCH_PARENT);`,
    `        if (frame.getParent() == group) {
            return;
        }
        if (unityPlayer.getParentPlayer() != null) {
            // tiktako: finish the transition (plugins/withUnity.js)
            ((ViewGroup) unityPlayer.getParentPlayer()).endViewTransition(frame);
            ((ViewGroup) unityPlayer.getParentPlayer()).removeView(frame);
        }

        ViewGroup.LayoutParams layoutParams = new ViewGroup.LayoutParams(MATCH_PARENT, MATCH_PARENT);`
  );
  edit(
    "ReactNativeUnity.java",
    "tiktako: show it again",
    `        group.addView(frame, 0, layoutParams);`,
    `        frame.setVisibility(android.view.View.VISIBLE); // tiktako: show it again (plugins/withUnity.js)
        group.addView(frame, 0, layoutParams);`
  );
  // it resumes the player here, so say so: otherwise the view's attach (restoreUnityUserState) still sees the pause
  // from leaving the screen and pauses it again 300 ms later (a frozen picture)
  edit(
    "ReactNativeUnity.java",
    "tiktako: resumed",
    `        unityPlayer.requestFocusPlayer();
        unityPlayer.resume();`,
    `        unityPlayer.requestFocusPlayer();
        unityPlayer.resume();
        _isUnityPaused = false; // tiktako: resumed (plugins/withUnity.js)`
  );
  // re-parenting keeps the SurfaceView's surface, so Unity (which let go of it on the detach) never hears of a new
  // one: the game runs on but the picture stays frozen. Hiding and showing the surface once makes a real new one,
  // as coming back from the background does
  edit(
    "ReactNativeUnity.java",
    "tiktako: new surface",
    `        _isUnityPaused = false; // tiktako: resumed (plugins/withUnity.js)`,
    `        _isUnityPaused = false; // tiktako: resumed (plugins/withUnity.js)
        // tiktako: new surface (plugins/withUnity.js)
        final android.view.View surface = frame.findViewById(frame.getResources().getIdentifier("unitySurfaceView", "id", frame.getContext().getPackageName()));
        if (surface != null) {
            surface.setVisibility(android.view.View.GONE);
            surface.post(() -> surface.setVisibility(android.view.View.VISIBLE));
        }`
  );
  // the parking spot itself: full size but hidden instead of 1×1 — Unity keeps rendering at the size it was parked
  // at, so after a 1×1 park it fills the screen with one stretched pixel even once it's back in a full-size view
  edit(
    "ReactNativeUnity.java",
    "tiktako: park full size",
    `        ViewGroup.LayoutParams layoutParams = new ViewGroup.LayoutParams(1, 1);`,
    `        // tiktako: park full size (plugins/withUnity.js)
        ViewGroup.LayoutParams layoutParams = new ViewGroup.LayoutParams(MATCH_PARENT, MATCH_PARENT);
        frame.setVisibility(android.view.View.INVISIBLE);`
  );
}

function withUnityManifest(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    manifest.$["xmlns:tools"] ??= "http://schemas.android.com/tools";
    const app = manifest.application[0].$;
    const replace = new Set((app["tools:replace"] ?? "").split(",").filter(Boolean));
    replace.add("android:enableOnBackInvokedCallback");
    app["tools:replace"] = [...replace].join(",");
    return mod;
  });
}

module.exports = function withUnity(config) {
  return withUnityManifest(withUnityAndroidChecked(withUnityIos(config)));
};
