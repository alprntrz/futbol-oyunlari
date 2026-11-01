# Dribbling Rush 3D (Unity)

The 3D version of Dribbling Rush. It is a Unity 6 project (`DribblingRush/`, Unity 6000.6.6f1, built-in
render pipeline) embedded in the Tiktako app with
[`@azesmway/react-native-unity`](https://github.com/azesmway/react-native-unity).

## How it fits together

- **The rules** live in `Assets/Scripts/RushEngine.cs`. They are a line-by-line port of
  `src/lib/kosu/engine.ts`: same numbers, same seeded random numbers. `RushBuild.Parity` prints a seeded run so
  the two can be compared. When a rule changes, change it in both files.
- **The world** is built in code at load (`RushGame.cs`, `Figure.cs`, `Look.cs`): pitch, stands, boards,
  players, coins, power-ups, goals. There are no imported models, and no faces, crests or logos; the only textures
  are the optional pictures in `Assets/Resources/Art` (docs/design/kosu-3d-brief.md).
- **The look** (docs/design/futbol-kosu.md, "Sahne"): the camera sits low behind the runner and never turns; the
  world bends away under the horizon (`Resources/RushCurve.cginc`, shared by the `Rush/Toon`, `Rush/Glow` and
  `Rush/Text` shaders; `RushGame.CURVE`), so what the rules lay 90 m ahead rises into view instead of popping in.
  Long pieces use the sliced meshes `Look.LongCube` / `Look.GridQuad` so they bend without kinks. Materials
  instance on the GPU; `Prewarm` builds one of everything into the pools at load and compiles the shaders.
- **The app** (`mobile/src/components/kosu/Rush3D.tsx`) owns everything around the run: swipes, HUD, the
  goal's question, the result card, XP, quests, sounds and haptics. Unity's own audio is switched off.
- **Messages** go app → game with `postMessage("RushGame", "Cmd" | "Swipe", …)`. They go game → app as JSON
  through `Bridge.Send`: `ready`, `hud`, `ev` and `over` (see the types at the top of `Rush3D.tsx`).
- **Fallback**: builds without the Unity player (Expo Go, store builds from before) get the 2.5D game
  (`Rush2D.tsx`), chosen by `hasUnity()` in `mobile/src/lib/unity.ts`.

## Building

You need Unity 6000.6.6f1 with iOS and Android Build Support and Xcode. In Unity Hub on this Mac the editor
lives in `~/Applications/Unity/Hub/Editor`. Set `UNITY=` to use another path.

```bash
./unity/build.sh ios       # → mobile/unity/builds/ios/UnityFramework.xcframework (device + simulator)
./unity/build.sh android   # → mobile/unity/builds/android (unityLibrary with a precompiled libil2cpp.so)
./unity/build.sh shots     # → DribblingRush/Builds/shots: screenshots of an autopiloted run (ramp, roof, jet, chaser…)
./unity/build.sh icons     # → DribblingRush/Builds/icons: the jet / spring-boot power-ups as PNGs for the app's HUD
```

- The builds are not in git (`mobile/.gitignore`). The root `.easignore` lets EAS Build upload them, so run
  the build script before `eas build`. Prebuild stops with a message if they are missing
  (`mobile/plugins/withUnity.js`).
- Rebuild after any change under `DribblingRush/Assets`, then run a native build: `npx expo run:ios` locally,
  or a store build. Unity changes are native, so they cannot ship as an OTA update.
- Local iOS builds need CocoaPods. On this Mac it is installed for the user with the system Ruby, so put
  `~/.gem/ruby/2.6.0/bin` on `PATH` and set `LANG=en_US.UTF-8`.
- Android: the Unity library needs `minSdk` 26.
- Quick check on the iOS simulator without a full `expo run:ios` (the app is already installed there): copy the app
  bundle out of the simulator (`xcrun simctl get_app_container booted com.alprntrz.tiktako`), replace
  `Frameworks/UnityFramework.framework` with `…/UnityFramework.xcframework/ios-arm64-simulator/UnityFramework.framework`,
  `codesign --force --sign -` the framework and then the app (with its entitlements), `xcrun simctl install booted` it and
  open `tiktako://kosu/oyun`. Unity's errors land in the system log: `xcrun simctl spawn booted log show --last 5m
  --predicate 'process == "Tiktako"'`.
