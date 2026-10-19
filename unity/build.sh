#!/usr/bin/env bash
# Builds Dribbling Rush (unity/DribblingRush) for the app:
#   ./unity/build.sh ios       → mobile/unity/builds/ios/UnityFramework.xcframework (device + simulator)
#   ./unity/build.sh android   → mobile/unity/builds/android/unityLibrary
#   ./unity/build.sh shots     → unity/DribblingRush/Builds/shots/*.png (an autopiloted run, for look checks)
# Needs Unity 6000.6.6f1 with iOS / Android support (UNITY=… to point elsewhere) and Xcode.
# The outputs are not in git (see mobile/.gitignore); EAS Build picks them up through mobile/.easignore.
set -euo pipefail
cd "$(dirname "$0")"
HERE="$PWD"
PROJ="$HERE/DribblingRush"
OUT="$HERE/../mobile/unity/builds"
UNITY="${UNITY:-$HOME/Applications/Unity/Hub/Editor/6000.6.6f1/Unity.app/Contents/MacOS/Unity}"
LOGS="$PROJ/Builds/logs"
mkdir -p "$LOGS"

unity() { # target method
  echo "▸ Unity $2"
  if ! "$UNITY" -batchmode -quit -projectPath "$PROJ" -buildTarget "$1" -executeMethod "$2" -logFile "$LOGS/$2.log"; then
    grep -E "error|Error|Exception" "$LOGS/$2.log" | tail -30
    echo "✗ $2 failed (log: $LOGS/$2.log)"
    exit 1
  fi
}

framework() { # export-dir sdk out-dir
  echo "▸ xcodebuild UnityFramework ($2)"
  xcodebuild -project "$1/Unity-iPhone.xcodeproj" -scheme UnityFramework -configuration Release -sdk "$2" \
    BUILD_DIR="$3" CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO SKIP_INSTALL=NO -quiet build > "$LOGS/xcodebuild-$2.log" 2>&1 \
    || { tail -40 "$LOGS/xcodebuild-$2.log"; exit 1; }
}

case "${1:-}" in
  ios)
    unity iOS RushBuild.IOSDevice
    unity iOS RushBuild.IOSSim
    rm -rf "$PROJ/Builds/xc"
    framework "$PROJ/Builds/ios-device" iphoneos "$PROJ/Builds/xc/device"
    framework "$PROJ/Builds/ios-sim" iphonesimulator "$PROJ/Builds/xc/sim"
    mkdir -p "$OUT/ios"
    rm -rf "$OUT/ios/UnityFramework.xcframework" "$OUT/ios/UnityFramework.framework"
    xcodebuild -create-xcframework \
      -framework "$PROJ/Builds/xc/device/Release-iphoneos/UnityFramework.framework" \
      -framework "$PROJ/Builds/xc/sim/Release-iphonesimulator/UnityFramework.framework" \
      -output "$OUT/ios/UnityFramework.xcframework"
    du -sh "$OUT/ios/UnityFramework.xcframework"/*
    echo "✓ iOS framework ready. In mobile/: rm -rf node_modules/@azesmway/react-native-unity/ios/UnityFramework.* && npx expo run:ios"
    ;;
  android)
    unity Android RushBuild.Android
    EXP="$PROJ/Builds/android"
    LIB="$EXP/unityLibrary"
    NDK="$(sed -n 's/^unity.androidNdkPath=//p' "$EXP/gradle.properties")"
    SDK="$(sed -n 's/^unity.androidSdkPath=//p' "$EXP/gradle.properties")"
    # IL2CPP is compiled here (its compiler is a macOS binary in the export), so the app's Gradle build —
    # on this Mac or on EAS — only packs ready .so files (the same command the export's buildIl2Cpp task runs)
    echo "▸ IL2CPP → libil2cpp.so (arm64)"
    ANDROID_SDK_ROOT="$SDK" ANDROID_NDK_ROOT="$NDK" NDK_ROOT="$NDK" ANDROID_NDK_HOME="$NDK" \
      "$LIB/src/main/Il2CppOutputProject/IL2CPP/build/deploy/il2cpp" --compile-cpp --platform=Android --architecture=arm64 \
      --outputpath="$LIB/src/main/jniLibs/arm64-v8a/libil2cpp.so" --baselib-directory="$LIB/src/main/jniStaticLibs/arm64-v8a" \
      --incremental-g-c-time-slice=3 --lto-mode=Thin --configuration=Release --dotnetprofile=unityaot-linux \
      --usymtool-path="$LIB/src/main/Il2CppOutputProject/usymtool" --static-lib-il2-cpp \
      --data-folder="$LIB/src/main/Il2CppOutputProject/Source/il2cppOutput/data" \
      --generatedcppdir="$LIB/src/main/Il2CppOutputProject/Source/il2cppOutput" \
      --cachedirectory="$PROJ/Builds/il2cpp-cache" --tool-chain-path="$NDK" > "$LOGS/il2cpp-android.log" 2>&1 \
      || { tail -30 "$LOGS/il2cpp-android.log"; exit 1; }
    rm -f "$LIB/src/main/jniLibs/arm64-v8a/"libil2cpp.*.so
    rm -rf "$OUT/android"
    mkdir -p "$OUT/android"
    rsync -a --exclude "src/main/Il2CppOutputProject" --exclude "src/main/jniStaticLibs" --exclude "build" --exclude "symbols" "$LIB/" "$OUT/android/unityLibrary/"
    cp -R "$EXP/shared" "$OUT/android/shared"
    python3 - "$OUT/android/unityLibrary" <<'PY'
import re, sys
lib = sys.argv[1]
# integrated as a library: no launcher entry of its own
p = lib + "/src/main/AndroidManifest.xml"
s = open(p).read()
s = re.sub(r"\s*<intent-filter>.*?</intent-filter>", "", s, flags=re.S)
# and not startable from other apps
s = s.replace('android:exported="true"', 'android:exported="false"')
open(p, "w").write(s)
# no IL2CPP step in the app's build (libil2cpp.so is already in jniLibs), and the app's own NDK
p = lib + "/build.gradle"
s = open(p).read()
s = re.sub(r'\n\s*ndkPath "[^"]*"', "", s)
s = re.sub(r'ndkVersion "[^"]*"', 'ndkVersion rootProject.ext.has("ndkVersion") ? rootProject.ext.ndkVersion : "27.2.12479018"', s)
s = re.sub(r"\nandroid \{\n    sourceSets \{\n        main \{\n            jni.srcDirs = \[[^\]]*\]\n        \}\n    \}\n\}\n", "\n", s)
s = re.sub(r"\nandroidComponents \{.*?\n\}\n", "\n", s, flags=re.S)
open(p, "w").write(s)
assert "ndkPath" not in s and "dependsOn buildIl2Cpp" not in s and "jni.srcDirs" not in s, "unityLibrary/build.gradle patch failed"
PY
    du -sh "$OUT/android"/*
    echo "✓ Android library ready."
    ;;
  shots)
    unity iOS RushBuild.Shots
    ls "$PROJ/Builds/shots"
    ;;
  *)
    echo "usage: unity/build.sh ios|android|shots"
    exit 2
    ;;
esac
