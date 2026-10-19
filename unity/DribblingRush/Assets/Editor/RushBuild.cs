// Batch-mode entry points for Dribbling Rush (run by unity/build.sh; no editor clicks needed):
//   RushBuild.Setup        project settings + the (empty) scene; the game builds itself at load
//   RushBuild.IOSDevice    Xcode export for iPhones      → Builds/ios-device
//   RushBuild.IOSSim       Xcode export for the simulator → Builds/ios-sim
//   RushBuild.Android      Gradle export (unityLibrary)  → ../../mobile/unity/builds/android
//   RushBuild.Shots        screenshots of an autopiloted run → Builds/shots (look checks)
//   RushBuild.Parity       the first rows of a seeded run as JSON (compared with the TypeScript rules)
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using Rush;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Callbacks;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEditor.iOS.Xcode;

public static class RushBuild
{
    const string Scene = "Assets/Scenes/Main.unity";
    static string Root => Path.GetFullPath(Path.Combine(Application.dataPath, ".."));

    public static void Setup()
    {
        PlayerSettings.companyName = "Tiktako";
        PlayerSettings.productName = "DribblingRush";
        PlayerSettings.bundleVersion = "1.0";
        PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.iOS, "com.alprntrz.tiktako.rush");
        PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Android, "com.alprntrz.tiktako.rush");
        PlayerSettings.colorSpace = ColorSpace.Gamma;
        PlayerSettings.SplashScreen.show = false;
        PlayerSettings.SplashScreen.showUnityLogo = false;
        PlayerSettings.enableCrashReportAPI = false;
        // nothing leaves the phone: no hardware statistics to Unity (the privacy page promises no analytics)
        SetProjectSetting("ProjectSettings/ProjectSettings.asset", "submitAnalytics", false);
        PlayerSettings.muteOtherAudioSources = false;
        PlayerSettings.stripEngineCode = true;
        PlayerSettings.defaultInterfaceOrientation = UIOrientation.Portrait;
        PlayerSettings.SetScriptingBackend(NamedBuildTarget.iOS, ScriptingImplementation.IL2CPP);
        PlayerSettings.SetScriptingBackend(NamedBuildTarget.Android, ScriptingImplementation.IL2CPP);
        PlayerSettings.SetManagedStrippingLevel(NamedBuildTarget.iOS, ManagedStrippingLevel.High);
        PlayerSettings.SetManagedStrippingLevel(NamedBuildTarget.Android, ManagedStrippingLevel.High);
        PlayerSettings.iOS.targetOSVersionString = "15.1";
        PlayerSettings.iOS.appleEnableAutomaticSigning = false;
        PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
        // react-native-unity hosts UnityPlayerForActivityOrService: the classic Activity entry, not GameActivity
        PlayerSettings.Android.applicationEntry = AndroidApplicationEntry.Activity;
        PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel26;

        // the app plays its own sounds: Unity's audio stays off so it never takes the audio session
        SetProjectSetting("ProjectSettings/AudioManager.asset", "m_DisableAudio", true);
        // one quality level for phones: 4× MSAA, no real-time shadows (the game draws blob shadows)
        QualitySettings.antiAliasing = 4;
        QualitySettings.shadows = ShadowQuality.Disable;

        if (!File.Exists(Path.Combine(Root, Scene)))
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            EditorSceneManager.SaveScene(scene, Scene);
        }
        EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(Scene, true) };
        AssetDatabase.SaveAssets();
        Debug.Log("RushBuild.Setup done");
    }

    /// <summary>A switch in a ProjectSettings file that has no PlayerSettings API.</summary>
    static void SetProjectSetting(string asset, string property, bool value)
    {
        var obj = AssetDatabase.LoadAllAssetsAtPath(asset).FirstOrDefault();
        var so = obj != null ? new SerializedObject(obj) : null;
        var p = so?.FindProperty(property);
        if (p == null)
        {
            Debug.LogError($"RushBuild: {asset} has no {property}");
            return;
        }
        p.boolValue = value;
        so.ApplyModifiedProperties();
    }

    static void Build(BuildTarget target, string outDir)
    {
        Setup();
        EditorUserBuildSettings.development = false;
        EditorUserBuildSettings.connectProfiler = false;
        if (Directory.Exists(outDir)) Directory.Delete(outDir, true);
        var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
        {
            scenes = new[] { Scene },
            locationPathName = outDir,
            target = target,
            options = BuildOptions.None,
        });
        Debug.Log($"RushBuild {target}: {report.summary.result}, {report.summary.totalSize / 1024 / 1024} MB, {report.summary.totalErrors} errors");
        if (report.summary.result != UnityEditor.Build.Reporting.BuildResult.Succeeded) EditorApplication.Exit(1);
    }

    public static void IOSDevice()
    {
        PlayerSettings.iOS.sdkVersion = iOSSdkVersion.DeviceSDK;
        Build(BuildTarget.iOS, Path.Combine(Root, "Builds/ios-device"));
    }

    public static void IOSSim()
    {
        PlayerSettings.iOS.sdkVersion = iOSSdkVersion.SimulatorSDK;
        Build(BuildTarget.iOS, Path.Combine(Root, "Builds/ios-sim"));
        PlayerSettings.iOS.sdkVersion = iOSSdkVersion.DeviceSDK;
    }

    public static void Android()
    {
        EditorUserBuildSettings.exportAsGoogleAndroidProject = true;
        Build(BuildTarget.Android, Path.Combine(Root, "Builds/android"));
    }

    /// <summary>What the react-native-unity README asks to do by hand in Xcode: the Data folder goes into
    /// UnityFramework, and NativeCallProxy.h becomes a public header of it.</summary>
    [PostProcessBuild(100)]
    public static void OnPostBuild(BuildTarget target, string path)
    {
        if (target != BuildTarget.iOS) return;
        var projPath = PBXProject.GetPBXProjectPath(path);
        var proj = new PBXProject();
        proj.ReadFromFile(projPath);
        var fw = proj.GetUnityFrameworkTargetGuid();
        var data = proj.FindFileGuidByProjectPath("Data");
        if (data != null)
        {
            var phase = proj.GetResourcesBuildPhaseByTarget(fw);
            proj.AddFileToBuildSection(fw, phase, data);
        }
        else Debug.LogError("RushBuild: no Data folder in the Xcode project");
        var header = proj.FindFileGuidByProjectPath("Libraries/Plugins/iOS/NativeCallProxy.h");
        if (header != null) proj.AddPublicHeaderToBuild(fw, header);
        else Debug.LogError("RushBuild: NativeCallProxy.h missing");
        proj.WriteToFile(projPath);
        Debug.Log("RushBuild: Xcode project patched for UnityFramework");
    }

    // ---------------------------------------------------------------- checks

    static AppMsg TestMsg(int seed) => new AppMsg
    {
        t = "start",
        seed = seed,
        body = "#A50044",
        sleeves = "#004D98",
        num = "10",
        answers = new[] { 1, -1, 0, 1 },
        goals = new[]
        {
            new GoalOptions { lanes = new[] { "Kylian Mbappé", "Erling Haaland", "Vinícius Júnior" } },
            new GoalOptions { lanes = new[] { "Arda Güler", "Hakan Çalhanoğlu", "Kenan Yıldız" } },
            new GoalOptions { lanes = new[] { "Messi", "Ronaldo", "Neymar" } },
            new GoalOptions { lanes = new[] { "Modrić", "Kroos", "Pedri" } },
        },
    };

    /// <summary>Dodges like a decent player: the next goal's lane, jump tackles / cones / sprinklers,
    /// roll boards, step around defenders and walls.</summary>
    public static string Pilot(RunState s)
    {
        const float L = RunState.LANE;
        if (Mathf.Abs(s.x - s.lane * L) > 0.3f) return "";
        Obstacle threat = null;
        float best = 99;
        foreach (var o in s.obstacles)
        {
            float dz = o.z - s.z;
            if (dz < -0.3f || dz > 16) continue;
            if (Mathf.Abs(s.ObstacleX(o) - s.lane * L) > 1.4f && !(o.moveTo != o.lane && o.moveTo == s.lane)) continue;
            if (dz < best) { best = dz; threat = o; }
        }
        var g = s.NextGoal();
        if (threat == null)
        {
            if (g != null && g.z - s.z < 70 && s.lane != g.correct) return g.correct < s.lane ? "left" : "right";
            return "";
        }
        switch (threat.kind)
        {
            case 0:
            case 3:
            case 5:
                return best < 3.6f && s.y <= 0.001f ? "up" : "";
            case 1:
                return best < 4.5f && s.slide <= 0 ? "down" : "";
            default:
                foreach (var to in new[] { s.lane - 1, s.lane + 1 })
                {
                    if (to < -1 || to > 1) continue;
                    bool blocked = s.obstacles.Any(o => Mathf.Abs(o.z - threat.z) < 4 && (o.kind == 2 || o.kind == 4) && (o.lane == to || o.moveTo == to));
                    if (!blocked) return to < s.lane ? "left" : "right";
                }
                return "";
        }
    }

    public static void Shots()
    {
        Setup();
        var dir = Path.Combine(Root, "Builds/shots");
        Directory.CreateDirectory(dir);
        EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        var go = new GameObject("RushGame");
        var game = go.AddComponent<RushGame>();
        var log = new List<string>();
        Bridge.EditorSink = m => log.Add(m);
        game.Init();
        Capture(dir, "00-menu");
        game.StartRun(TestMsg(20261019));
        float[] at = { 1.5f, 6f, 12f, 18f, 24f, 30f, 40f, 50f };
        int next = 0, frame = 0;
        float goalShot = -1;
        while (game.S.t < 60 && next < at.Length)
        {
            var inp = Pilot(game.S);
            if (inp != "") game.Swipe(inp);
            game.Tick(1 / 60f);
            frame++;
            var gl = game.S.NextGoal();
            if (gl != null && gl.z - game.S.z < 22 && gl.z - game.S.z > 20 && goalShot < 0)
            {
                goalShot = game.S.t;
                Capture(dir, "goal-near");
            }
            if (game.S.t >= at[next])
            {
                Capture(dir, $"{next + 1:00}-t{at[next]:0}s");
                next++;
            }
            if (game.S.Dead && game.S.t - game.S.dead > 0.4f)
            {
                Capture(dir, "zz-dead");
                break;
            }
        }
        File.WriteAllLines(Path.Combine(dir, "messages.txt"), log.Where(l => !l.Contains("\"hud\"")).Concat(log.Where(l => l.Contains("\"hud\"")).Skip(Mathf.Max(0, log.Count(l => l.Contains("\"hud\"")) - 3))));
        Debug.Log($"RushBuild.Shots: {frame} frames, t={game.S.t:0.0}s, z={game.S.z:0}m, score {game.S.Score}, coins {game.S.coinsTaken}, goals {game.S.goalsScored}/{game.S.goalsScored + game.S.saves}, dead={game.S.Dead} ({game.S.deadKind})");
    }

    static void Capture(string dir, string name)
    {
        var cam = Camera.main;
        const int W = 590, H = 1278;
        var rt = new RenderTexture(W, H, 24) { antiAliasing = 4 };
        cam.targetTexture = rt;
        cam.aspect = (float)W / H;
        cam.Render();
        RenderTexture.active = rt;
        var tex = new Texture2D(W, H, TextureFormat.RGB24, false);
        tex.ReadPixels(new Rect(0, 0, W, H), 0, 0);
        tex.Apply();
        File.WriteAllBytes(Path.Combine(dir, name + ".png"), tex.EncodeToPNG());
        cam.targetTexture = null;
        RenderTexture.active = null;
        Object.DestroyImmediate(rt);
        Object.DestroyImmediate(tex);
    }

    /// <summary>A seeded run with a fixed input script, as JSON, to compare with src/lib/kosu/engine.ts.</summary>
    public static void Parity()
    {
        var s = new RunState(12345, new[] { 1, -1, 0 });
        var script = new Dictionary<int, string> { { 30, "left" }, { 90, "up" }, { 150, "right" }, { 151, "right" }, { 240, "down" }, { 400, "left" } };
        for (int f = 0; f < 600; f++) s.Step(script.TryGetValue(f, out var i) ? i : "", 1 / 60f);
        var sb = new StringBuilder();
        sb.Append("{\"z\":").Append(s.z.ToString("0.###", System.Globalization.CultureInfo.InvariantCulture))
          .Append(",\"x\":").Append(s.x.ToString("0.###", System.Globalization.CultureInfo.InvariantCulture))
          .Append(",\"score\":").Append(s.Score).Append(",\"coins\":").Append(s.coinsTaken).Append(",\"dead\":").Append(s.Dead ? 1 : 0)
          .Append(",\"rows\":[");
        sb.Append(string.Join(",", s.obstacles.Take(12).Select(o => $"[{o.z.ToString("0.##", System.Globalization.CultureInfo.InvariantCulture)},{o.lane},{o.kind},{o.moveTo}]")));
        sb.Append("]}");
        var path = Path.Combine(Root, "Builds/parity.json");
        Directory.CreateDirectory(Path.GetDirectoryName(path));
        File.WriteAllText(path, sb.ToString());
        Debug.Log("RushBuild.Parity: " + sb);
    }
}
