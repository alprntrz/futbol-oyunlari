# Dribbling Rush 3D (Unity)

The 3D version of Dribbling Rush. It is a Unity 6 project (`DribblingRush/`, Unity 6000.6.6f1, built-in
render pipeline) embedded in the Tiktako app with
[`@azesmway/react-native-unity`](https://github.com/azesmway/react-native-unity).

## How it fits together

- **The rules** live in `Assets/Scripts/RushEngine.cs`. They are a line-by-line port of
  `src/lib/kosu/engine.ts`: same numbers, same seeded random numbers. `RushBuild.Parity` prints a seeded run so
  the two can be compared. When a rule changes, change it in both files.
- **The world** is built in code at load (`RushGame.cs`, `Figure.cs`, `Look.cs`): pitch, stands, boards,
  players, coins, power-ups, goals. There are no imported models or textures, and no faces, crests or logos.
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
./unity/build.sh shots     # → DribblingRush/Builds/shots: screenshots of an autopiloted run
```

- The builds are not in git (`mobile/.gitignore`). The root `.easignore` lets EAS Build upload them, so run
  the build script before `eas build`. Prebuild stops with a message if they are missing
  (`mobile/plugins/withUnity.js`).
- Rebuild after any change under `DribblingRush/Assets`, then run a native build: `npx expo run:ios` locally,
  or a store build. Unity changes are native, so they cannot ship as an OTA update.
- Local iOS builds need CocoaPods. On this Mac it is installed for the user with the system Ruby, so put
  `~/.gem/ruby/2.6.0/bin` on `PATH` and set `LANG=en_US.UTF-8`.
- Android: the Unity library needs `minSdk` 26.
