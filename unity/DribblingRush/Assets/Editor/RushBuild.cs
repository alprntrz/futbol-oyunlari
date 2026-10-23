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
        words = new[] { "KAKA", "MESSI", "PELE" },
    };

    /// <summary>A bus in this lane that a runner on the grass can't get past between z0 and z1 (one with a ramp
    /// still ahead can be run up; a driving one counts from where it will be).</summary>
    static bool BlockedLane(RunState s, int lane, float z0, float z1)
    {
        foreach (var b in s.blocks)
        {
            if (b.lane != lane) continue;
            // a ramp can be taken from the front or from the side all the way up (it carries you up)
            if (b.ramp && s.z < b.z - 0.5f) continue;
            float front = b.v > 0 ? s.z + (b.z - s.z) * s.speed / (s.speed + b.v) : b.z;
            if (front < z1 && b.z + b.len > z0) return true;
        }
        return false;
    }

    /// <summary>Dodges like a decent player: off blocks it can't climb, hops roof gaps, the next goal's lane,
    /// jump tackles / cones / sprinklers, roll boards, step around defenders and walls.</summary>
    public static string Pilot(RunState s)
    {
        // never step into the side of a bus
        var d = PilotWish(s);
        if (d != "left" && d != "right" || s.gy >= RunState.ROOF_H - 0.01f) return d;
        int to = s.lane + (d == "left" ? -1 : 1);
        return BlockedLane(s, to, s.z - 1.5f, s.z + 6) ? "" : d;
    }

    static string PilotWish(RunState s)
    {
        const float L = RunState.LANE;
        if (Mathf.Abs(s.x - s.lane * L) > 0.3f) return "";
        if (s.jet > 0) return "";
        bool onRoof = s.gy >= RunState.ROOF_H - 0.01f;
        if (onRoof)
        {
            if (s.y - s.gy > 0.05f) return "";
            foreach (var b in s.blocks)
            {
                if (b.lane != s.lane || s.z < b.z || s.z > b.z + b.len) continue;
                float end = b.z + b.len;
                bool hop = s.blocks.Any(o => o.lane == s.lane && o.z > end && o.z - end < 8);
                return hop && end - s.z < 1.4f ? "up" : "";
            }
            return "";
        }
        // on a ramp: keep going up
        if (s.gy > 0.01f) return "";
        if (BlockedLane(s, s.lane, s.z, s.z + 18))
        {
            if (s.spring > 0 && s.blocks.Any(b => b.lane == s.lane && b.z - s.z < 3.2f && b.z > s.z)) return s.y <= s.gy + 0.001f ? "up" : "";
            foreach (var to in new[] { s.lane - 1, s.lane + 1 })
                if (to >= -1 && to <= 1 && !BlockedLane(s, to, s.z - 1.5f, s.z + 12)) return to < s.lane ? "left" : "right";
            return "";
        }
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
            // go for the next letter of the name
            foreach (var l in s.letters)
                if (!l.taken && l.lane != s.lane && l.z - s.z > 4 && l.z - s.z < 30 && !BlockedLane(s, s.lane + (l.lane < s.lane ? -1 : 1), s.z - 1.5f, l.z + 1))
                    return l.lane < s.lane ? "left" : "right";
            // climb a ramp when one is coming up next door
            foreach (var b in s.blocks)
                if (b.ramp && b.lane != s.lane && Mathf.Abs(b.lane - s.lane) == 1 && b.z - RunState.RAMP_LEN - s.z > 3 && b.z - RunState.RAMP_LEN - s.z < 12 && !BlockedLane(s, b.lane, s.z - 1.5f, b.z - RunState.RAMP_LEN))
                    return b.lane < s.lane ? "left" : "right";
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
                // the nearest open lane; one two lanes away is reached a step at a time
                foreach (var to in new[] { s.lane - 1, s.lane + 1, s.lane - 2, s.lane + 2 })
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
        // moments worth a picture: the first roof, a bus driving at us, the jet, the spring boots, the chaser
        var once = new HashSet<string>();
        void Moment(string name, bool when)
        {
            if (when && once.Add(name)) Capture(dir, name);
        }
        float bumpAt = -1;
        while (game.S.t < 60 && next < at.Length)
        {
            var s = game.S;
            var inp = Pilot(s);
            // a jet and spring boots dropped in front of the runner, and one bump into the touchline
            // a ramp right ahead, and a second bus a hop away
            if (s.t > 7 && s.gy < 0.01f && s.blocks.Count == 0 && once.Add("give-ramp"))
            {
                s.obstacles.RemoveAll(o => o.z > s.z + 20);
                s.coins.RemoveAll(c => c.z > s.z + 20);
                s.pickups.RemoveAll(p => p.z > s.z + 20);
                s.letters.RemoveAll(l => l.z > s.z + 20);
                s.next = s.z + 100;
                s.blocks.Add(new Block { z = s.z + 34, len = 24, lane = s.lane, ramp = true, id = 900003 });
                s.blocks.Add(new Block { z = s.z + 63, len = 18, lane = s.lane, id = 900004 });
                Debug.Log($"RushBuild.Shots: ramp at {s.z + 27:0} lane {s.lane}, t={s.t:0.00}");
            }
            // the mower coming down the next lane
            if (s.t > 44 && s.gy < 0.01f && once.Add("give-mower"))
            {
                int ln = s.lane == 0 ? 1 : 0;
                s.obstacles.RemoveAll(o => o.z > s.z + 10 && o.lane == ln);
                s.blocks.Add(new Block { z = s.z + 70, len = 4.5f, lane = ln, v = RunState.MOVER_V, id = 900005 });
            }
            if (s.t > 14 && once.Add("give-jet")) s.pickups.Add(new Pickup { z = s.z + 12, lane = s.lane, kind = 4, id = 900001 });
            if (s.t > 27 && once.Add("give-spring")) s.pickups.Add(new Pickup { z = s.z + 12, lane = s.lane, kind = 5, id = 900002 });
            if (s.t > 36 && s.lane != 0 && s.gy < 0.01f && s.jet <= 0 && once.Add("bump"))
            {
                inp = s.lane > 0 ? "right" : "left";
                bumpAt = s.t;
            }
            if (inp != "") game.Swipe(inp);
            game.Tick(1 / 60f);
            frame++;
            s = game.S;
            if (s.stepEvents.Contains(Ev.Bump) || s.stepEvents.Contains(Ev.Dead))
                Debug.Log($"RushBuild.Shots: {string.Join(",", s.stepEvents)} t={s.t:0.00} z={s.z:0.0} x={s.x:0.00} y={s.y:0.00} gy={s.gy:0.00} lane={s.lane} from={s.from} input={inp} blocks=[{string.Join(" ", s.blocks.Select(b => $"{b.lane}:{b.z:0.0}+{b.len}{(b.ramp ? "r" : "")}{(b.v > 0 ? "m" : "")}"))}] obs=[{string.Join(" ", s.obstacles.Where(o => Mathf.Abs(o.z - s.z) < 3).Select(o => $"{o.lane}>{o.moveTo}:{o.z:0.0}k{o.kind}"))}]");
            if (inp != "" && s.t > 7 && s.t < 11) Debug.Log($"RushBuild.Shots: input {inp} t={s.t:0.00} lane={s.lane} y={s.y:0.00}");
            Moment("m-ramp", s.gy > 0.8f && s.gy < 2.2f);
            Moment("m-roof", s.gy >= RunState.ROOF_H - 0.01f && s.y - s.gy < 0.05f && once.Contains("m-ramp"));
            Moment("m-mover", s.blocks.Any(b => b.v > 0 && b.z - s.z < 26 && b.z > s.z + 8));
            Moment("m-jet", s.jet > 0 && s.jet < RunState.POWER_S[4] - 1.5f);
            Moment("m-spring", s.spring > 0 && s.y - s.gy > 2.3f);
            Moment("m-letter", s.letters.Any(l => !l.taken && l.z - s.z < 14 && l.z > s.z + 6));
            Moment("m-word", s.stepEvents.Contains(Ev.Word));
            Moment("m-mower2", s.blocks.Any(b => b.v > 0 && b.z - s.z < 14 && b.z > s.z + 4));
            Moment("m-chaser", bumpAt > 0 && s.t - bumpAt > 0.4f);
            Moment("m-chaser2", bumpAt > 0 && s.t - bumpAt > 1.2f);
            Moment("m-gap", s.gy < 0.01f && s.y > 2 && once.Contains("m-roof"));
            if (bumpAt > 0 && once.Add("log-bump")) Debug.Log($"RushBuild.Shots: bump at {s.t:0.00}, stumble {s.stumble:0.00}, lane {s.lane}");
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

    /// <summary>The jet and spring-boot power-ups rendered on transparent PNGs for the app's HUD chips.</summary>
    public static void Icons()
    {
        Setup();
        var dir = Path.Combine(Root, "Builds/icons");
        Directory.CreateDirectory(dir);
        EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        var game = new GameObject("RushGame").AddComponent<RushGame>();
        game.Init();
        var cam = Camera.main;
        RenderSettings.fog = false;
        foreach (var pk in new[] { 4, 5 })
        {
            var go = game.PowerIcon(pk);
            // well away from the pitch, so only the model is in the picture
            go.transform.position = new Vector3(0, -300, 0);
            var spin = go.transform.Find("spin");
            spin.localRotation = Quaternion.Euler(0, pk == 4 ? 20 : -35, pk == 4 ? -12 : 0);
            var c = spin.position;
            cam.transform.position = c + new Vector3(0, 0.7f, -2.6f);
            cam.transform.LookAt(c);
            cam.fieldOfView = 30;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0, 0, 0, 0);
            const int S = 256;
            var rt = new RenderTexture(S, S, 24, RenderTextureFormat.ARGB32) { antiAliasing = 8 };
            cam.targetTexture = rt;
            cam.aspect = 1;
            cam.Render();
            RenderTexture.active = rt;
            var tex = new Texture2D(S, S, TextureFormat.RGBA32, false);
            tex.ReadPixels(new Rect(0, 0, S, S), 0, 0);
            tex.Apply();
            File.WriteAllBytes(Path.Combine(dir, (pk == 4 ? "pick-jet" : "pick-spring") + ".png"), tex.EncodeToPNG());
            cam.targetTexture = null;
            RenderTexture.active = null;
            Object.DestroyImmediate(rt);
            Object.DestroyImmediate(tex);
            Object.DestroyImmediate(go);
        }
        Debug.Log("RushBuild.Icons: " + dir);
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

/// <summary>Import rules for the drawn textures in Assets/Resources/Art: the backdrop stays readable (the game takes its
/// sky colour from it).</summary>
public class RushArtImport : AssetPostprocessor
{
    void OnPreprocessTexture()
    {
        if (assetPath.EndsWith("Resources/Art/backdrop.png")) ((TextureImporter)assetImporter).isReadable = true;
    }
}
