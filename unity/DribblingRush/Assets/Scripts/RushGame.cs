// Dribbling Rush in 3D: the run (RushEngine) drawn as a stadium pitch rushing forward. The app owns the
// screens around it (start, HUD, question text, result, XP, quests, sounds, haptics); this draws the world
// and tells the app what happened. One object, "RushGame", made at load; the app drives it with Cmd / Swipe.
using System.Collections.Generic;
using System.Globalization;
using System.Text;
using UnityEngine;

namespace Rush
{
    public class RushGame : MonoBehaviour
    {
        const float LANE = RunState.LANE;
        /// <summary>the touchlines and where the boards and stands start</summary>
        const float HALF = 4.6f;
        const float BOARD_X = 5.6f, BOARD_LEN = 5.4f, BOARD_GAP = 6f;
        const int BOARDS = 32;
        const float STAND_X = 8.5f, STAND_LEN = 36f;
        const int STANDS = 7;
        const float GROUND_BACK = 20f, GROUND_LEN = 190f;
        /// <summary>how long a fall plays before the app shows the result</summary>
        const float FALL_S = 0.45f;

        static readonly CultureInfo Inv = CultureInfo.InvariantCulture;

        public RunState S { get; private set; }
        bool running, paused, started;
        string pending = "";
        AppMsg setup;
        Camera cam;
        Transform world;

        // world pieces
        Transform ground;
        Material groundMat;
        readonly List<Transform> boards = new List<Transform>();
        readonly List<Transform> stands = new List<Transform>();
        // the runner
        Transform runnerHolder, ball, runnerShadow, auraT, armbandT;
        Figure runner;
        Renderer auraR;
        float ballSpin, ballHidden;
        Color kitBody = new Color32(220, 38, 38, 255), kitSleeves = new Color32(220, 38, 38, 255);
        string kitNum = "10";
        Color oppBody, oppSleeves, oppShorts;
        // pooled things on the pitch, by the rules' ids
        readonly Dictionary<int, Thing> live = new Dictionary<int, Thing>();
        readonly Dictionary<int, Stack<Thing>> pool = new Dictionary<int, Stack<Thing>>();
        readonly HashSet<int> seen = new HashSet<int>();
        readonly List<int> drop = new List<int>();
        readonly Dictionary<Goal, GoalView> goalViews = new Dictionary<Goal, GoalView>();
        readonly Stack<GoalView> goalPool = new Stack<GoalView>();
        // flying coins (taken, on their way to the runner) and the shot at goal
        readonly List<Fly> flying = new List<Fly>();
        Transform shot;
        Vector3 shotFrom, shotTo;
        float shotT = -1;
        // effects
        ParticleSystem sparkle, confetti, splash, dust, speedLines;
        Material shadowMat, glowMat;
        Texture2D blobTex;
        // what the app was last told
        string lastHud = "";
        float hudTimer;
        bool overSent;

        class Thing
        {
            public GameObject go;
            public int kind;
            public Figure fig;
            public Figure[] figs;
            public Transform spin;
            public ParticleSystem ps;
            public float side = 1;
        }

        class GoalView
        {
            public GameObject go;
            public Figure keeper;
            public Transform keeperHolder;
            public TextMesh[] texts = new TextMesh[3];
            public Renderer[] signs = new Renderer[3];
            public Renderer[] net;
            public float resultAt = -1;
            public float diveSide;
            public int q = -1;
        }

        struct Fly
        {
            public Transform t;
            public Vector3 from;
            public float at;
        }

        // ---------------------------------------------------------------- set-up

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Boot()
        {
            if (GameObject.Find("RushGame")) return;
            var go = new GameObject("RushGame");
            go.AddComponent<RushGame>().Init();
        }

        bool inited;

        public void Init()
        {
            if (inited) return;
            inited = true;
            Application.targetFrameRate = 60;
            QualitySettings.vSyncCount = 0;
            world = new GameObject("World").transform;
            BuildCamera();
            BuildLight();
            blobTex = Look.Blob();
            shadowMat = Look.Glow(new Color(0, 0.08f, 0, 0.42f), blobTex);
            glowMat = Look.Glow(Color.white, blobTex, true);
            BuildPitch();
            BuildEffects();
            PickOpponents();
            BuildRunner();
            Menu();
            Bridge.Send("{\"t\":\"ready\"}");
        }

        void Awake()
        {
            if (Application.isPlaying) Init();
        }

        void BuildCamera()
        {
            var go = new GameObject("Camera");
            cam = go.AddComponent<Camera>();
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color32(124, 196, 242, 255);
            cam.fieldOfView = 62;
            cam.nearClipPlane = 0.3f;
            cam.farClipPlane = 220;
            cam.allowMSAA = true;
            cam.allowHDR = false;
            go.tag = "MainCamera";
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.Linear;
            RenderSettings.fogColor = new Color32(176, 220, 246, 255);
            RenderSettings.fogStartDistance = 55;
            RenderSettings.fogEndDistance = 175;
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
            RenderSettings.ambientLight = new Color(0.5f, 0.5f, 0.5f);
        }

        void BuildLight()
        {
            var go = new GameObject("Sun");
            var l = go.AddComponent<Light>();
            l.type = LightType.Directional;
            l.color = new Color32(255, 246, 228, 255);
            l.intensity = 1;
            l.shadows = LightShadows.None;
            go.transform.rotation = Quaternion.Euler(48, -35, 0);
        }

        void BuildPitch()
        {
            // the grass: one long quad that follows the runner, its texture scrolled to match the ground
            groundMat = Look.Mat(Color.white, Look.Pitch(LANE, HALF), 0, 0);
            groundMat.mainTextureScale = new Vector2(1, GROUND_LEN / 12f);
            ground = Look.Part("ground", world, Look.GroundQuad(), groundMat, Vector3.zero, new Vector3(60, 1, GROUND_LEN)).transform;

            // advertising boards along both touchlines (blank colours, our name now and then)
            Color[] boardCols = { new Color32(37, 99, 235, 255), new Color32(22, 163, 74, 255), new Color32(234, 88, 12, 255), new Color32(124, 58, 237, 255), new Color32(220, 38, 38, 255) };
            var font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            for (int i = 0; i < BOARDS; i++)
            {
                int side = i % 2 == 0 ? -1 : 1;
                var b = new GameObject("board").transform;
                b.SetParent(world, false);
                var col = boardCols[(i / 2) % boardCols.Length];
                Look.Part("face", b, PrimitiveType.Cube, Look.Mat(col, Look.Stripe(col, Color.Lerp(col, Color.white, 0.25f)), 0.35f, 0.1f), new Vector3(0, 0.5f, 0), new Vector3(0.12f, 0.9f, BOARD_LEN));
                Look.Part("leg", b, PrimitiveType.Cube, Look.Mat(new Color32(40, 44, 52, 255)), new Vector3(side * 0.25f, 0.25f, 0), new Vector3(0.05f, 0.5f, BOARD_LEN * 0.9f), new Vector3(0, 0, side * 25));
                if ((i / 2) % 2 == 0)
                {
                    var t = new GameObject("name");
                    t.transform.SetParent(b, false);
                    t.transform.localPosition = new Vector3(-side * 0.07f, 0.5f, 0);
                    t.transform.localRotation = Quaternion.Euler(0, side * 90, 0);
                    var tm = t.AddComponent<TextMesh>();
                    tm.font = font;
                    tm.text = "TIKTAKO";
                    tm.fontSize = 64;
                    tm.characterSize = 0.07f;
                    tm.fontStyle = FontStyle.Bold;
                    tm.anchor = TextAnchor.MiddleCenter;
                    tm.color = Color.white;
                    t.GetComponent<MeshRenderer>().sharedMaterial = font.material;
                }
                b.localPosition = new Vector3(side * BOARD_X, 0, (i / 2) * BOARD_GAP);
                boards.Add(b);
            }

            // the stands: a wall, rows of crowd climbing away, a roof, floodlights now and then
            var crowd = Look.Crowd();
            var crowdMat = Look.Mat(Color.white, crowd, 0.25f, 0);
            crowdMat.mainTextureScale = new Vector2(STAND_LEN / 9f, 1);
            var wallMat = Look.Mat(new Color32(30, 41, 59, 255));
            var roofMat = Look.Mat(new Color32(226, 232, 240, 255));
            var poleMat = Look.Mat(new Color32(148, 163, 184, 255));
            var lampMat = Look.Mat(new Color32(255, 251, 235, 255), null, 1);
            for (int i = 0; i < STANDS * 2; i++)
            {
                int side = i % 2 == 0 ? -1 : 1;
                var st = new GameObject("stand").transform;
                st.SetParent(world, false);
                Look.Part("wall", st, PrimitiveType.Cube, wallMat, new Vector3(0, 0.6f, 0), new Vector3(0.4f, 1.2f, STAND_LEN));
                var tiers = Look.Part("crowd", st, PrimitiveType.Quad, crowdMat, new Vector3(side * 4.2f, 4.4f, 0), new Vector3(STAND_LEN, 9.6f, 1));
                // facing the pitch, the rows climbing away from it
                tiers.transform.localRotation = Quaternion.Euler(0, side * 90, 0) * Quaternion.Euler(35, 0, 0);
                Look.Part("back", st, PrimitiveType.Cube, wallMat, new Vector3(side * 8.2f, 4.5f, 0), new Vector3(0.6f, 9f, STAND_LEN));
                Look.Part("roof", st, PrimitiveType.Cube, roofMat, new Vector3(side * 5.6f, 9.6f, 0), new Vector3(7.5f, 0.35f, STAND_LEN), new Vector3(0, 0, side * -8));
                if (i % 4 < 2)
                {
                    Look.Part("pole", st, PrimitiveType.Cylinder, poleMat, new Vector3(side * 9f, 9f, 0), new Vector3(0.35f, 9f, 0.35f));
                    Look.Part("lamps", st, PrimitiveType.Cube, lampMat, new Vector3(side * 9f, 18.4f, 0), new Vector3(0.4f, 1.4f, 2.6f), new Vector3(0, 0, side * 20));
                }
                st.localPosition = new Vector3(side * STAND_X, 0, (i / 2) * STAND_LEN);
                stands.Add(st);
            }
        }

        ParticleSystem Particles(string name, Color a, Color b, float size, float life, bool additive, int max = 200)
        {
            var go = new GameObject(name);
            go.transform.SetParent(world, false);
            var ps = go.AddComponent<ParticleSystem>();
            ps.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
            var main = ps.main;
            main.playOnAwake = false;
            // always playing with no steady rate: bursts come from Emit, loops set a rate
            main.loop = true;
            main.startLifetime = life;
            main.startSize = new ParticleSystem.MinMaxCurve(size * 0.6f, size);
            main.startColor = new ParticleSystem.MinMaxGradient(a, b);
            main.maxParticles = max;
            main.simulationSpace = ParticleSystemSimulationSpace.World;
            var em = ps.emission;
            em.rateOverTime = 0;
            var r = go.GetComponent<ParticleSystemRenderer>();
            r.sharedMaterial = Look.Glow(Color.white, blobTex, additive);
            var col = ps.colorOverLifetime;
            col.enabled = true;
            var g = new Gradient();
            g.SetKeys(new[] { new GradientColorKey(Color.white, 0), new GradientColorKey(Color.white, 1) }, new[] { new GradientAlphaKey(1, 0), new GradientAlphaKey(1, 0.6f), new GradientAlphaKey(0, 1) });
            col.color = g;
            ps.Play();
            return ps;
        }

        void BuildEffects()
        {
            sparkle = Particles("sparkle", new Color(1, 0.85f, 0.2f), new Color(1, 1, 0.7f), 0.28f, 0.45f, true);
            var m = sparkle.main;
            m.startSpeed = new ParticleSystem.MinMaxCurve(2, 5);
            m.gravityModifier = 0.6f;
            var sh = sparkle.shape;
            sh.shapeType = ParticleSystemShapeType.Sphere;
            sh.radius = 0.2f;

            confetti = Particles("confetti", new Color(1, 0.3f, 0.3f), new Color(0.3f, 0.6f, 1), 0.22f, 1.6f, false, 400);
            m = confetti.main;
            m.startSpeed = new ParticleSystem.MinMaxCurve(6, 12);
            m.gravityModifier = 0.9f;
            m.startColor = new ParticleSystem.MinMaxGradient(Rainbow());
            sh = confetti.shape;
            sh.shapeType = ParticleSystemShapeType.Cone;
            sh.angle = 35;
            sh.radius = 2;
            confetti.transform.rotation = Quaternion.Euler(-90, 0, 0);

            splash = Particles("splash", new Color(0.6f, 0.85f, 1, 0.9f), new Color(1, 1, 1, 0.8f), 0.35f, 0.6f, false);
            m = splash.main;
            m.startSpeed = new ParticleSystem.MinMaxCurve(2, 6);
            m.gravityModifier = 1.4f;
            sh = splash.shape;
            sh.shapeType = ParticleSystemShapeType.Hemisphere;
            sh.radius = 0.5f;

            dust = Particles("dust", new Color(0.85f, 0.9f, 0.75f, 0.7f), new Color(1, 1, 1, 0.5f), 0.6f, 0.5f, false);
            m = dust.main;
            m.startSpeed = new ParticleSystem.MinMaxCurve(0.5f, 2);
            sh = dust.shape;
            sh.shapeType = ParticleSystemShapeType.Sphere;
            sh.radius = 0.3f;

            speedLines = Particles("speed", new Color(1, 1, 1, 0.6f), new Color(1, 0.9f, 0.6f, 0.6f), 0.08f, 0.35f, true, 300);
            m = speedLines.main;
            m.startSpeed = new ParticleSystem.MinMaxCurve(-60, -40);
            var em = speedLines.emission;
            em.rateOverTime = 120;
            sh = speedLines.shape;
            sh.shapeType = ParticleSystemShapeType.Box;
            sh.scale = new Vector3(9, 5, 1);
            var r = speedLines.GetComponent<ParticleSystemRenderer>();
            r.renderMode = ParticleSystemRenderMode.Stretch;
            r.velocityScale = 0.06f;
            r.lengthScale = 2;
        }

        static Gradient Rainbow()
        {
            var g = new Gradient { mode = GradientMode.Fixed };
            g.SetKeys(new[]
            {
                new GradientColorKey(new Color(0.94f, 0.27f, 0.27f), 0.2f), new GradientColorKey(new Color(0.98f, 0.8f, 0.08f), 0.4f),
                new GradientColorKey(new Color(0.13f, 0.77f, 0.37f), 0.6f), new GradientColorKey(new Color(0.23f, 0.51f, 0.96f), 0.8f),
                new GradientColorKey(Color.white, 1f),
            }, new[] { new GradientAlphaKey(1, 0), new GradientAlphaKey(1, 1) });
            return g;
        }

        /// <summary>The other team plays in a kit that stands out from the runner's.</summary>
        void PickOpponents()
        {
            Color.RGBToHSV(kitBody, out float h, out float sat, out float v);
            bool blueish = sat > 0.3f && h > 0.5f && h < 0.75f;
            oppBody = blueish ? (Color)new Color32(185, 28, 28, 255) : new Color32(30, 58, 138, 255);
            oppSleeves = oppBody;
            oppShorts = Color.white;
        }

        void BuildRunner()
        {
            if (runnerHolder) Destroy0(runnerHolder.gameObject);
            runnerHolder = new GameObject("runner").transform;
            runnerHolder.SetParent(world, false);
            float lum = kitBody.r * 0.3f + kitBody.g * 0.59f + kitBody.b * 0.11f;
            Color shorts = lum > 0.75f ? (Color)new Color32(30, 41, 59, 255) : Color.white;
            runner = new Figure(runnerHolder, kitBody, kitSleeves, shorts, kitBody, Figure.Skins[0], Figure.Hairs[0], kitNum);
            if (!runnerShadow) runnerShadow = Look.Part("shadow", world, PrimitiveType.Quad, shadowMat, Vector3.zero, new Vector3(1.1f, 1.1f, 1), new Vector3(90, 0, 0)).transform;
            if (!ball)
            {
                ball = Look.Part("ball", world, PrimitiveType.Sphere, Look.Mat(Color.white, Look.Ball(), 0.05f, 0.15f), Vector3.zero, Vector3.one * 0.44f).transform;
                shot = Look.Part("shot", world, PrimitiveType.Sphere, ball.GetComponent<Renderer>().sharedMaterial, Vector3.zero, Vector3.one * 0.44f).transform;
                shot.gameObject.SetActive(false);
            }
            // a glow ring under the runner while a power-up runs, and the captain's armband
            auraT = Look.Part("aura", runnerHolder, PrimitiveType.Quad, Look.Glow(Color.white, blobTex, true), new Vector3(0, 0.05f, 0), new Vector3(2.4f, 2.4f, 1), new Vector3(90, 0, 0)).transform;
            auraR = auraT.GetComponent<Renderer>();
            auraT.gameObject.SetActive(false);
            var arm = runnerHolder.Find("figure/body/armL");
            armbandT = Look.Part("armband", arm, Look.Torus(), Look.Mat(new Color32(250, 204, 21, 255), null, 0.4f), new Vector3(0, -0.14f, 0), new Vector3(0.3f, 0.3f, 0.7f), new Vector3(90, 0, 0)).transform;
            armbandT.gameObject.SetActive(false);
        }

        static void Destroy0(Object o)
        {
            if (Application.isPlaying) Destroy(o);
            else DestroyImmediate(o);
        }

        // ---------------------------------------------------------------- app commands

        /// <summary>A command from the app as JSON (see AppMsg).</summary>
        public void Cmd(string json)
        {
            AppMsg m;
            try { m = JsonUtility.FromJson<AppMsg>(json); }
            catch { Debug.LogWarning("bad command: " + json); return; }
            if (m == null) return;
            switch (m.t)
            {
                // the app asks until it hears back: the first "ready" can go out before the app is listening
                case "ping": Bridge.Send("{\"t\":\"ready\"}"); break;
                case "start": StartRun(m); break;
                case "menu":
                    // back to the start line, in this kit if one came along
                    if (SetKit(m)) BuildRunner();
                    Menu();
                    break;
                case "pause": paused = true; break;
                case "resume": paused = false; break;
            }
        }

        /// <summary>A swipe from the app: "left" | "right" | "up" | "down".</summary>
        public void Swipe(string dir)
        {
            if (running && !paused) pending = dir;
        }

        public void StartRun(AppMsg m)
        {
            setup = m;
            SetKit(m);
            ClearPitch();
            BuildRunner();
            S = new RunState((uint)m.seed, m.answers);
            running = true;
            started = true;
            paused = false;
            overSent = false;
            pending = "";
            lastHud = "";
            ballHidden = 0;
            speedLines.Play();
        }

        /// <summary>Take the kit from a command; true if it came with one.</summary>
        bool SetKit(AppMsg m)
        {
            if (string.IsNullOrEmpty(m.body)) return false;
            kitBody = Look.Hex(m.body, kitBody);
            kitSleeves = !string.IsNullOrEmpty(m.sleeves) ? Look.Hex(m.sleeves, kitBody) : kitBody;
            if (!string.IsNullOrEmpty(m.num)) kitNum = m.num;
            PickOpponents();
            return true;
        }

        /// <summary>Back to the start line: the runner waits, nothing moves.</summary>
        public void Menu()
        {
            ClearPitch();
            S = new RunState(1, new int[0]);
            running = false;
            started = false;
            paused = false;
            if (speedLines) speedLines.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
            Draw(0);
        }

        void ClearPitch()
        {
            foreach (var kv in live) Release(kv.Value);
            live.Clear();
            foreach (var kv in goalViews)
            {
                kv.Value.go.SetActive(false);
                goalPool.Push(kv.Value);
            }
            goalViews.Clear();
            foreach (var f in flying) if (f.t) f.t.gameObject.SetActive(false);
            flying.Clear();
            shotT = -1;
            if (shot) shot.gameObject.SetActive(false);
        }

        // ---------------------------------------------------------------- the loop

        void Update()
        {
            if (!Application.isPlaying) return;
            Tick(Mathf.Min(0.05f, Time.deltaTime));
        }

        /// <summary>One frame: step the rules, tell the app, draw. Public so editor tests can drive it.</summary>
        public void Tick(float dt)
        {
            if (S == null) return;
            if (running && !paused)
            {
                string inp = pending;
                pending = "";
                S.Step(inp, dt);
                foreach (var e in S.stepEvents) OnEvent(e);
                hudTimer -= dt;
                if (hudTimer <= 0)
                {
                    hudTimer = 0.1f;
                    SendHud();
                }
                if (S.Dead && !overSent && S.t - S.dead > FALL_S)
                {
                    overSent = true;
                    SendHud();
                    Bridge.Send(string.Format(Inv, "{{\"t\":\"over\",\"score\":{0},\"coins\":{1},\"metres\":{2},\"goals\":{3}}}", S.Score, S.coinsTaken, (int)S.z, S.goalsScored));
                }
            }
            if (!paused) Draw(dt);
        }

        void OnEvent(Ev e)
        {
            string name = null;
            switch (e)
            {
                case Ev.Coin: name = "coin"; break;
                case Ev.Bump: name = "bump"; break;
                case Ev.Dead: name = "dead"; break;
                case Ev.Goal: name = "goal"; Shoot(true); break;
                case Ev.Save: name = "save"; Shoot(false); break;
                case Ev.Power: name = "power"; Burst(sparkle, RunnerPos() + Vector3.up, 30); break;
                case Ev.Saved: name = "saved"; break;
                case Ev.Splash: name = "splash"; Burst(splash, RunnerPos() + Vector3.up * 0.6f, 40); break;
                case Ev.Roll: if (S.y <= 0.01f) Burst(dust, RunnerPos() + new Vector3(0, 0.2f, 0.6f), 14); break;
            }
            if (name == null) return;
            if (e == Ev.Power) Bridge.Send("{\"t\":\"ev\",\"e\":\"power\",\"k\":" + S.lastPowerKind + "}");
            else if (e == Ev.Goal || e == Ev.Save) Bridge.Send("{\"t\":\"ev\",\"e\":\"" + name + "\",\"mult\":" + S.mult + "}");
            else Bridge.Send("{\"t\":\"ev\",\"e\":\"" + name + "\"}");
        }

        void SendHud()
        {
            var g = S.NextGoal();
            int q = g != null && g.z - S.z < 95 ? g.q : -1;
            var sb = new StringBuilder(160);
            sb.Append("{\"t\":\"hud\",\"score\":").Append(S.Score)
              .Append(",\"coins\":").Append(S.coinsTaken)
              .Append(",\"mult\":").Append(S.Mult)
              .Append(",\"boots\":").Append((Mathf.Ceil(S.boots * 10) / 10).ToString(Inv))
              .Append(",\"magnet\":").Append((Mathf.Ceil(S.magnet * 10) / 10).ToString(Inv))
              .Append(",\"double\":").Append((Mathf.Ceil(S.dbl * 10) / 10).ToString(Inv))
              .Append(",\"armband\":").Append(S.armband)
              .Append(",\"q\":").Append(q)
              .Append(",\"m\":").Append((int)S.z)
              .Append('}');
            var s = sb.ToString();
            if (s == lastHud) return;
            lastHud = s;
            Bridge.Send(s);
        }

        static void Burst(ParticleSystem ps, Vector3 at, int n)
        {
            if (!ps) return;
            ps.transform.position = at;
            ps.Emit(n);
        }

        Vector3 RunnerPos() => new Vector3(S.x, S.y, S.z);

        // ---------------------------------------------------------------- drawing

        void Draw(float dt)
        {
            var s = S;
            float time = Application.isPlaying ? Time.time : s.t;
            float phase = s.z * 1.05f;

            // camera: behind and above, easing after the runner's lane and jumps; wider as the run gets faster
            float shake = s.shake > 0 ? s.shake * 0.5f : 0;
            Vector3 sh = shake > 0 ? new Vector3(Mathf.Sin(s.t * 90) * shake, Mathf.Cos(s.t * 80) * shake * 0.6f, 0) : Vector3.zero;
            cam.transform.position = new Vector3(s.camX, 4.3f + s.camY, s.z - 7.4f) + sh;
            cam.transform.LookAt(new Vector3(s.camX * 0.9f, 0.5f + s.camY * 0.6f, s.z + 10));
            float fov = 58 + Mathf.Clamp01((s.speed - RunState.SPEED0) / (RunState.SPEED_MAX - RunState.SPEED0)) * 8 + (s.boots > 0 ? 7 : 0);
            cam.fieldOfView = dt > 0 ? Mathf.Lerp(cam.fieldOfView, fov, Mathf.Min(1, dt * 4)) : fov;

            // the ground scrolls under a quad that follows; boards and stands leapfrog forward
            float g0 = s.z - GROUND_BACK;
            ground.position = new Vector3(0, 0, g0 + GROUND_LEN / 2);
            groundMat.mainTextureOffset = new Vector2(0, Mathf.Repeat(g0 / 12f, 1));
            float span = BOARDS / 2 * BOARD_GAP;
            foreach (var b in boards)
                if (b.position.z < s.z - 12) b.position += new Vector3(0, 0, span);
                else if (b.position.z > s.z - 12 + span) b.position -= new Vector3(0, 0, span * Mathf.Floor((b.position.z - (s.z - 12)) / span));
            float sspan = STANDS * STAND_LEN;
            foreach (var st in stands)
                if (st.position.z < s.z - 30) st.position += new Vector3(0, 0, sspan);
                else if (st.position.z > s.z - 30 + sspan) st.position -= new Vector3(0, 0, sspan * Mathf.Floor((st.position.z - (s.z - 30)) / sspan));

            DrawRunner(dt, time, phase);
            DrawThings(dt, time);
            DrawGoals(dt, time);
            DrawFlying(dt);
            if (speedLines)
            {
                speedLines.transform.position = new Vector3(s.camX, 2.5f, s.z + 30);
                var em = speedLines.emission;
                em.rateOverTime = running && !s.Dead ? (s.boots > 0 ? 260 : Mathf.Lerp(0, 70, (s.speed - 16) / 11)) : 0;
            }
        }

        void DrawRunner(float dt, float time, float phase)
        {
            var s = S;
            runnerHolder.position = new Vector3(s.x, s.y, s.z);
            // lean into a lane change
            float lean = Mathf.Clamp((s.lane * LANE - s.x) * 9, -22, 22);
            runnerHolder.rotation = Quaternion.Euler(0, lean * 0.6f, -lean * 0.5f);
            Pose pose;
            float k = 0, side = 1;
            if (!started) pose = Pose.Idle;
            else if (s.Dead)
            {
                pose = s.deadKind == "caught" ? Pose.Caught : Pose.Fall;
                k = (s.t - s.dead) / 0.35f;
                side = s.lane >= s.from ? 1 : -1;
            }
            else if (s.slide > 0 && s.y < 0.3f) pose = Pose.Slide;
            else if (s.y > 0.05f) pose = Pose.Jump;
            else pose = Pose.Run;
            runner.Apply(pose, started ? phase : time * 3, k, side);
            // flicker while passing through after a forgiven crash; a bump wobbles
            bool flicker = s.ghost > 0 && s.boots <= 0 && Mathf.Repeat(s.t * 12, 1) < 0.5f;
            runner.SetVisible(!flicker);
            if (s.stumble < 0.5f && !s.Dead) runnerHolder.rotation *= Quaternion.Euler(0, 0, Mathf.Sin(s.stumble * 40) * 10 * (0.5f - s.stumble));

            runnerShadow.position = new Vector3(s.x, 0.02f, s.z + 0.1f);
            float hs = Mathf.Clamp(1.2f - s.y * 0.25f, 0.5f, 1.2f);
            runnerShadow.localScale = new Vector3(hs, hs * 1.3f, 1);

            // the ball: dribbled just ahead of the feet, kept up in a jump, rolling away after a foul
            if (ballHidden > 0) ballHidden -= dt;
            Vector3 bp;
            if (s.Dead) bp = new Vector3(s.x + 0.3f, 0.22f, ball.position.z + Mathf.Max(0, s.speed * 0.6f + 3) * dt);
            else if (!started) bp = new Vector3(s.x + 0.2f, 0.22f, s.z + 0.55f);
            else if (pose == Pose.Slide) bp = new Vector3(s.x, 0.22f, s.z + 1.25f);
            else
            {
                float touch = Mathf.Abs(Mathf.Sin(phase)) * 0.2f;
                bp = new Vector3(s.x + 0.16f, 0.22f + (s.y > 0 ? s.y * 0.85f : 0), s.z + 0.62f + touch);
            }
            ball.position = bp;
            ballSpin += (started && !s.Dead ? s.speed : 4) * dt / 0.22f * Mathf.Rad2Deg;
            ball.rotation = Quaternion.Euler(ballSpin, 0, 0);
            ball.gameObject.SetActive(ballHidden <= 0);

            // power-up glow ring, armband
            Color aura = s.boots > 0 ? new Color(1, 0.45f, 0.1f) : s.magnet > 0 ? new Color(0.95f, 0.2f, 0.2f) : s.dbl > 0 ? new Color(0.6f, 0.35f, 1f) : s.wet > 0 ? new Color(0.3f, 0.65f, 1f) : Color.clear;
            bool auraOn = started && !s.Dead && aura.a > 0;
            auraT.gameObject.SetActive(auraOn);
            if (auraOn)
            {
                aura.a = 0.55f + Mathf.Sin(time * 10) * 0.2f;
                auraR.sharedMaterial.color = aura;
                auraT.position = new Vector3(s.x, 0.04f, s.z);
                auraT.rotation = Quaternion.Euler(90, 0, 0);
            }
            armbandT.gameObject.SetActive(s.armband > 0);
        }

        // ---------- obstacles, coins, power-ups

        const int K_COIN = 100, K_PICK = 200, K_REF = 6;

        Thing Get(int kind)
        {
            if (pool.TryGetValue(kind, out var st) && st.Count > 0)
            {
                var t = st.Pop();
                t.go.SetActive(true);
                return t;
            }
            return Make(kind);
        }

        void Release(Thing t)
        {
            t.go.SetActive(false);
            if (t.ps) t.ps.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
            if (!pool.TryGetValue(t.kind, out var st)) pool[t.kind] = st = new Stack<Thing>();
            st.Push(t);
        }

        void Shadow(Transform parent, float w, float d)
        {
            Look.Part("shadow", parent, PrimitiveType.Quad, shadowMat, new Vector3(0, 0.015f, 0), new Vector3(w, d, 1), new Vector3(90, 0, 0));
        }

        Thing Make(int kind)
        {
            var t = new Thing { kind = kind, go = new GameObject("thing" + kind) };
            var tr = t.go.transform;
            tr.SetParent(world, false);
            int skin = Random.Range(0, Figure.Skins.Length);
            switch (kind)
            {
                case 0: // slide tackle: a defender lying across the lane, studs first
                    {
                        var h = Look.Pivot("h", tr, Vector3.zero);
                        t.fig = new Figure(h, oppBody, oppSleeves, oppShorts, oppBody, Figure.Skins[skin], Figure.Hairs[Random.Range(0, 4)]);
                        Shadow(tr, 2.2f, 1.2f);
                        break;
                    }
                case 1: // a board on two posts: roll under it
                    {
                        var post = Look.Mat(new Color32(226, 232, 240, 255));
                        Look.Part("postL", tr, PrimitiveType.Cylinder, post, new Vector3(-1.05f, 0.9f, 0), new Vector3(0.12f, 0.9f, 0.12f));
                        Look.Part("postR", tr, PrimitiveType.Cylinder, post, new Vector3(1.05f, 0.9f, 0), new Vector3(0.12f, 0.9f, 0.12f));
                        var orange = new Color32(249, 115, 22, 255);
                        Look.Part("board", tr, PrimitiveType.Cube, Look.Mat(orange, Look.Stripe(orange, Color.white), 0.25f), new Vector3(0, 1.45f, 0), new Vector3(2.3f, 0.7f, 0.14f));
                        Look.Part("hint", tr, PrimitiveType.Cube, Look.Mat(new Color32(30, 41, 59, 255)), new Vector3(0, 1.05f, 0), new Vector3(2.3f, 0.1f, 0.1f));
                        Shadow(tr, 2.6f, 0.6f);
                        break;
                    }
                case 2: // a defender standing in the lane, arms out
                    {
                        var h = Look.Pivot("h", tr, Vector3.zero);
                        h.localRotation = Quaternion.Euler(0, 180, 0);
                        t.fig = new Figure(h, oppBody, oppSleeves, oppShorts, oppBody, Figure.Skins[skin], Figure.Hairs[Random.Range(0, 4)]);
                        Shadow(tr, 1.4f, 1.1f);
                        break;
                    }
                case 3: // a row of training cones
                    {
                        var orange = Look.Mat(new Color32(251, 146, 60, 255), null, 0.15f);
                        var band = Look.Mat(Color.white);
                        for (int i = -1; i <= 1; i++)
                        {
                            Look.Part("cone", tr, Look.Cone(), orange, new Vector3(i * 0.72f, 0, 0), new Vector3(0.46f, 0.55f, 0.46f));
                            Look.Part("band", tr, Look.Cone(), band, new Vector3(i * 0.72f, 0.2f, 0), new Vector3(0.31f, 0.2f, 0.31f));
                            Look.Part("base", tr, PrimitiveType.Cube, orange, new Vector3(i * 0.72f, 0.02f, 0), new Vector3(0.52f, 0.04f, 0.52f));
                        }
                        Shadow(tr, 2.4f, 0.8f);
                        break;
                    }
                case 4: // a wall of four
                    {
                        t.figs = new Figure[4];
                        for (int i = 0; i < 4; i++)
                        {
                            var h = Look.Pivot("h" + i, tr, new Vector3(-0.84f + i * 0.56f, 0, 0));
                            h.localRotation = Quaternion.Euler(0, 180, 0);
                            h.localScale = Vector3.one * 0.86f;
                            t.figs[i] = new Figure(h, oppBody, oppSleeves, oppShorts, oppBody, Figure.Skins[(skin + i) % 4], Figure.Hairs[(i * 3 + skin) % 4]);
                        }
                        Shadow(tr, 2.6f, 1f);
                        break;
                    }
                case 5: // a pitch sprinkler throwing water across the lane
                    {
                        var grey = Look.Mat(new Color32(100, 116, 139, 255));
                        Look.Part("base", tr, PrimitiveType.Cylinder, grey, new Vector3(0, 0.06f, 0), new Vector3(0.5f, 0.06f, 0.5f));
                        t.spin = Look.Part("head", tr, PrimitiveType.Cylinder, Look.Mat(new Color32(234, 179, 8, 255)), new Vector3(0, 0.25f, 0), new Vector3(0.18f, 0.18f, 0.18f)).transform;
                        Look.Part("puddle", tr, Look.Disc(), Look.Glow(new Color(0.45f, 0.75f, 1f, 0.45f)), new Vector3(0, 0.02f, 0), new Vector3(2.4f, 1, 2.0f));
                        var ps = Particles("water", new Color(0.65f, 0.85f, 1, 0.85f), new Color(1, 1, 1, 0.7f), 0.22f, 0.9f, false, 300);
                        ps.transform.SetParent(tr, false);
                        ps.transform.localPosition = new Vector3(0, 0.35f, 0);
                        var m = ps.main;
                        m.loop = true;
                        m.startSpeed = new ParticleSystem.MinMaxCurve(4, 6.5f);
                        m.gravityModifier = 1.2f;
                        m.simulationSpace = ParticleSystemSimulationSpace.Local;
                        var em = ps.emission;
                        em.rateOverTime = 110;
                        var sh = ps.shape;
                        sh.shapeType = ParticleSystemShapeType.Cone;
                        sh.angle = 28;
                        sh.radius = 0.05f;
                        ps.transform.localRotation = Quaternion.Euler(-60, 0, 0);
                        t.ps = ps;
                        break;
                    }
                case K_REF: // the referee drifting across, a yellow card up
                    {
                        var h = Look.Pivot("h", tr, Vector3.zero);
                        h.localRotation = Quaternion.Euler(0, 180, 0);
                        t.fig = new Figure(h, new Color32(17, 24, 39, 255), new Color32(17, 24, 39, 255), new Color32(17, 24, 39, 255), new Color32(17, 24, 39, 255), Figure.Skins[skin], Figure.Hairs[1], null, false, true);
                        Shadow(tr, 1.4f, 1.1f);
                        break;
                    }
                case K_COIN:
                    {
                        t.spin = Look.Pivot("spin", tr, Vector3.zero);
                        var gold = Look.Mat(new Color32(250, 190, 30, 255), null, 0.35f, 0.7f);
                        Look.Part("coin", t.spin, PrimitiveType.Cylinder, gold, Vector3.zero, new Vector3(0.62f, 0.05f, 0.62f), new Vector3(90, 0, 0));
                        Look.Part("face", t.spin, PrimitiveType.Cylinder, Look.Mat(new Color32(255, 220, 90, 255), null, 0.5f, 0.5f), Vector3.zero, new Vector3(0.42f, 0.055f, 0.42f), new Vector3(90, 0, 0));
                        break;
                    }
                default: // power-ups: K_PICK + kind
                    {
                        int pk = kind - K_PICK;
                        Color[] glow = { new Color(1, 0.5f, 0.1f, 0.8f), new Color(1, 0.25f, 0.25f, 0.8f), new Color(1, 0.85f, 0.2f, 0.8f), new Color(0.65f, 0.4f, 1, 0.8f) };
                        Look.Part("glow", tr, PrimitiveType.Quad, Look.Glow(glow[pk], blobTex, true), new Vector3(0, 1.1f, 0.3f), new Vector3(1.9f, 1.9f, 1));
                        t.spin = Look.Pivot("spin", tr, new Vector3(0, 1.1f, 0));
                        PowerModel(pk, t.spin);
                        Shadow(tr, 0.9f, 0.9f);
                        break;
                    }
            }
            return t;
        }

        void PowerModel(int pk, Transform p)
        {
            var font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            switch (pk)
            {
                case 0: // winged boots
                    {
                        var o = Look.Mat(new Color32(249, 115, 22, 255), null, 0.3f, 0.5f);
                        Look.Part("boot", p, PrimitiveType.Cube, o, new Vector3(0, 0, 0.05f), new Vector3(0.3f, 0.22f, 0.55f));
                        Look.Part("ankle", p, PrimitiveType.Cube, o, new Vector3(0, 0.2f, -0.12f), new Vector3(0.28f, 0.3f, 0.28f));
                        Look.Part("sole", p, PrimitiveType.Cube, Look.Mat(new Color32(30, 30, 36, 255)), new Vector3(0, -0.13f, 0.05f), new Vector3(0.32f, 0.05f, 0.58f));
                        var w = Look.Mat(Color.white, null, 0.6f);
                        Look.Part("wingL", p, PrimitiveType.Cube, w, new Vector3(-0.22f, 0.25f, -0.15f), new Vector3(0.03f, 0.22f, 0.36f), new Vector3(0, 0, 30));
                        Look.Part("wingR", p, PrimitiveType.Cube, w, new Vector3(0.22f, 0.25f, -0.15f), new Vector3(0.03f, 0.22f, 0.36f), new Vector3(0, 0, -30));
                        break;
                    }
                case 1: // magnet
                    {
                        var r = Look.Mat(new Color32(220, 38, 38, 255), null, 0.3f, 0.5f);
                        var tip = Look.Mat(new Color32(226, 232, 240, 255), null, 0.3f);
                        Look.Part("arc", p, Look.Torus(), r, new Vector3(0, 0.05f, 0), new Vector3(0.7f, 0.7f, 1.6f), new Vector3(0, 0, 0));
                        Look.Part("legL", p, PrimitiveType.Cube, r, new Vector3(-0.35f, -0.2f, 0), new Vector3(0.17f, 0.45f, 0.17f));
                        Look.Part("legR", p, PrimitiveType.Cube, r, new Vector3(0.35f, -0.2f, 0), new Vector3(0.17f, 0.45f, 0.17f));
                        Look.Part("tipL", p, PrimitiveType.Cube, tip, new Vector3(-0.35f, -0.47f, 0), new Vector3(0.18f, 0.12f, 0.18f));
                        Look.Part("tipR", p, PrimitiveType.Cube, tip, new Vector3(0.35f, -0.47f, 0), new Vector3(0.18f, 0.12f, 0.18f));
                        break;
                    }
                case 2: // captain's armband
                    {
                        Look.Part("band", p, Look.Torus(), Look.Mat(new Color32(250, 204, 21, 255), null, 0.35f, 0.5f), Vector3.zero, new Vector3(1.1f, 1.1f, 2.4f));
                        Text(p, "C", new Vector3(0, 0, -0.32f), 0.09f, new Color32(30, 41, 59, 255), font);
                        break;
                    }
                default: // double points
                    {
                        Look.Part("disc", p, PrimitiveType.Cylinder, Look.Mat(new Color32(139, 92, 246, 255), null, 0.35f, 0.5f), Vector3.zero, new Vector3(0.9f, 0.06f, 0.9f), new Vector3(90, 0, 0));
                        Text(p, "×2", new Vector3(0, 0, -0.08f), 0.075f, Color.white, font);
                        break;
                    }
            }
        }

        static TextMesh Text(Transform parent, string text, Vector3 pos, float size, Color color, Font font)
        {
            var t = new GameObject("text");
            t.transform.SetParent(parent, false);
            t.transform.localPosition = pos;
            var tm = t.AddComponent<TextMesh>();
            tm.font = font;
            tm.text = text;
            tm.fontSize = 64;
            tm.characterSize = size;
            tm.fontStyle = FontStyle.Bold;
            tm.anchor = TextAnchor.MiddleCenter;
            tm.alignment = TextAlignment.Center;
            tm.color = color;
            t.GetComponent<MeshRenderer>().sharedMaterial = font.material;
            return tm;
        }

        void DrawThings(float dt, float time)
        {
            var s = S;
            seen.Clear();
            foreach (var o in s.obstacles)
            {
                seen.Add(o.id);
                int kind = o.kind == 2 && o.moveTo != o.lane ? K_REF : o.kind;
                if (!live.TryGetValue(o.id, out var t))
                {
                    t = Get(kind);
                    t.side = (o.id & 1) == 0 ? 1 : -1;
                    live[o.id] = t;
                    if (t.ps) t.ps.Play();
                }
                float x = s.ObstacleX(o);
                t.go.transform.position = new Vector3(x, 0, o.z);
                float near = o.z - s.z;
                // once passed it's out of the way (and would only block the camera)
                bool show = near > -1.6f;
                if (t.go.activeSelf != show) t.go.SetActive(show);
                if (!show) continue;
                switch (kind)
                {
                    case 0:
                        t.fig.Apply(Pose.Tackle, 0, 0, t.side);
                        // slides in as you come
                        t.fig.root.parent.localPosition = new Vector3(-t.side * Mathf.Clamp01((near - 4) / 20) * 1.2f, 0, 0);
                        break;
                    case 2: t.fig.Apply(Pose.Stand, time * 2 + o.id); break;
                    case 4:
                        for (int i = 0; i < 4; i++) t.figs[i].Apply(Pose.Wall, time * 9 + i * 0.7f, near < 18 && near > -2 ? 1 : 0);
                        break;
                    case 5: t.spin.localRotation = Quaternion.Euler(0, time * 360, 0); break;
                    case K_REF:
                        t.fig.Apply(near < RunState.DRIFT_AT && near > RunState.DRIFT_AT - 10 ? Pose.Run : Pose.Ref, time * 9);
                        t.go.transform.rotation = near < RunState.DRIFT_AT && near > RunState.DRIFT_AT - 10 ? Quaternion.Euler(0, (o.moveTo - o.lane) * -70, 0) : Quaternion.identity;
                        break;
                }
            }
            foreach (var c in s.coins)
            {
                if (c.taken)
                {
                    if (live.TryGetValue(c.id, out var tk))
                    {
                        flying.Add(new Fly { t = tk.go.transform, from = tk.go.transform.position, at = time });
                        live.Remove(c.id);
                        tk.kind = K_COIN;
                    }
                    continue;
                }
                seen.Add(c.id);
                if (!live.TryGetValue(c.id, out var t)) live[c.id] = t = Get(K_COIN);
                t.go.transform.position = new Vector3(c.lane * LANE, c.y + 0.75f, c.z);
                t.spin.localRotation = Quaternion.Euler(0, time * 220 + c.z * 10, 0);
            }
            foreach (var p in s.pickups)
            {
                if (p.taken) continue;
                seen.Add(p.id);
                if (!live.TryGetValue(p.id, out var t)) live[p.id] = t = Get(K_PICK + p.kind);
                t.go.transform.position = new Vector3(p.lane * LANE, 0, p.z);
                t.spin.localPosition = new Vector3(0, 1.1f + Mathf.Sin(time * 3 + p.id) * 0.15f, 0);
                t.spin.localRotation = Quaternion.Euler(0, time * 120, Mathf.Sin(time * 2) * 10);
            }
            drop.Clear();
            foreach (var kv in live) if (!seen.Contains(kv.Key)) drop.Add(kv.Key);
            foreach (var id in drop)
            {
                Release(live[id]);
                live.Remove(id);
            }
        }

        void DrawFlying(float dt)
        {
            float time = Application.isPlaying ? Time.time : S.t;
            var target = RunnerPos() + new Vector3(0, 1.2f, 0.4f);
            for (int i = flying.Count - 1; i >= 0; i--)
            {
                var f = flying[i];
                float k = (time - f.at) / 0.16f;
                if (k >= 1 || !f.t)
                {
                    if (f.t)
                    {
                        f.t.localScale = Vector3.one;
                        var th = new Thing { go = f.t.gameObject, kind = K_COIN, spin = f.t.Find("spin") };
                        Release(th);
                    }
                    if (k >= 1 && i % 3 == 0) Burst(sparkle, target, 4);
                    flying.RemoveAt(i);
                    continue;
                }
                f.t.position = Vector3.Lerp(f.from, target, k * k);
                f.t.localScale = Vector3.one * (1 - k * 0.6f);
            }
        }

        // ---------- goals

        GoalView MakeGoal()
        {
            var v = new GoalView { go = new GameObject("goal") };
            var tr = v.go.transform;
            tr.SetParent(world, false);
            float w = LANE * 1.5f + 0.35f;
            const float H = 2.7f, D = 2.4f;
            var white = Look.Mat(Color.white, null, 0.2f, 0.3f);
            Look.Part("postL", tr, PrimitiveType.Cylinder, white, new Vector3(-w, H / 2, 0), new Vector3(0.22f, H / 2, 0.22f));
            Look.Part("postR", tr, PrimitiveType.Cylinder, white, new Vector3(w, H / 2, 0), new Vector3(0.22f, H / 2, 0.22f));
            Look.Part("bar", tr, PrimitiveType.Cylinder, white, new Vector3(0, H, 0), new Vector3(0.22f, w + 0.11f, 0.22f), new Vector3(0, 0, 90));
            Look.Part("backL", tr, PrimitiveType.Cylinder, white, new Vector3(-w, H * 0.5f, D), new Vector3(0.08f, H * 0.5f, 0.08f));
            Look.Part("backR", tr, PrimitiveType.Cylinder, white, new Vector3(w, H * 0.5f, D), new Vector3(0.08f, H * 0.5f, 0.08f));
            var netTex = Look.Net();
            var net = Look.Glow(Color.white, netTex);
            net.mainTextureScale = new Vector2(w * 2 / 0.7f, H / 0.7f);
            var nets = new List<Renderer>
            {
                Look.Part("netBack", tr, PrimitiveType.Quad, net, new Vector3(0, H / 2, D), new Vector3(w * 2, H, 1)).GetComponent<Renderer>(),
                Look.Part("netTop", tr, PrimitiveType.Quad, net, new Vector3(0, H, D / 2), new Vector3(w * 2, D, 1), new Vector3(90, 0, 0)).GetComponent<Renderer>(),
                Look.Part("netL", tr, PrimitiveType.Quad, net, new Vector3(-w, H / 2, D / 2), new Vector3(D, H, 1), new Vector3(0, 90, 0)).GetComponent<Renderer>(),
                Look.Part("netR", tr, PrimitiveType.Quad, net, new Vector3(w, H / 2, D / 2), new Vector3(D, H, 1), new Vector3(0, -90, 0)).GetComponent<Renderer>(),
            };
            v.net = nets.ToArray();
            // the three answers on signs over the bar, one per lane
            var font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            for (int i = 0; i < 3; i++)
            {
                float x = (i - 1) * LANE;
                var sign = Look.Part("sign" + i, tr, PrimitiveType.Cube, Look.Mat(Color.white, null, 0.55f, 0.1f), new Vector3(x, H + 1.0f, 0), new Vector3(LANE - 0.12f, 1.45f, 0.1f));
                v.signs[i] = sign.GetComponent<Renderer>();
                Look.Part("rim" + i, tr, PrimitiveType.Cube, Look.Mat(new Color32(30, 41, 59, 255)), new Vector3(x, H + 1.0f, 0.03f), new Vector3(LANE - 0.02f, 1.57f, 0.08f));
                v.texts[i] = Text(tr, "", new Vector3(x, H + 1.0f, -0.07f), 0.04f, new Color32(15, 23, 42, 255), font);
                v.texts[i].lineSpacing = 0.9f;
            }
            // the keeper
            v.keeperHolder = Look.Pivot("keeper", tr, new Vector3(0, 0, 0.6f));
            var kh = Look.Pivot("k", v.keeperHolder, Vector3.zero);
            kh.localRotation = Quaternion.Euler(0, 180, 0);
            v.keeper = new Figure(kh, new Color32(34, 197, 94, 255), new Color32(21, 128, 61, 255), new Color32(20, 20, 24, 255), new Color32(34, 197, 94, 255), Figure.Skins[1], Figure.Hairs[1], null, true);
            Shadow(v.keeperHolder, 1.3f, 1f);
            return v;
        }

        static string Wrap(string s, int width)
        {
            if (string.IsNullOrEmpty(s)) return "";
            var words = s.Split(' ');
            var sb = new StringBuilder();
            int line = 0, lines = 1;
            foreach (var w in words)
            {
                if (line > 0 && line + 1 + w.Length > width)
                {
                    if (lines == 3) { sb.Append('…'); break; }
                    sb.Append('\n');
                    line = 0;
                    lines++;
                }
                else if (line > 0)
                {
                    sb.Append(' ');
                    line++;
                }
                sb.Append(w);
                line += w.Length;
            }
            return sb.ToString();
        }

        void DrawGoals(float dt, float time)
        {
            var s = S;
            foreach (var g in s.goals)
            {
                if (!goalViews.TryGetValue(g, out var v))
                {
                    v = goalPool.Count > 0 ? goalPool.Pop() : MakeGoal();
                    v.go.SetActive(true);
                    v.resultAt = -1;
                    v.q = g.q;
                    var opts = setup != null && setup.goals != null && setup.goals.Length > 0 ? setup.goals[g.q % setup.goals.Length].lanes : null;
                    for (int i = 0; i < 3; i++)
                    {
                        string txt = opts != null && i < opts.Length ? opts[i] : "";
                        int len = txt.Length;
                        v.texts[i].text = Wrap(txt, 12);
                        v.texts[i].characterSize = len > 22 ? 0.032f : len > 12 ? 0.037f : 0.045f;
                        v.signs[i].sharedMaterial = Look.Mat(Color.white, null, 0.55f, 0.1f);
                    }
                    foreach (var n in v.net) n.enabled = true;
                    goalViews[g] = v;
                }
                v.go.transform.position = new Vector3(0, 0, g.z);
                if (g.result != 0 && v.resultAt < 0)
                {
                    v.resultAt = time;
                    int runLane = Mathf.Clamp(Mathf.RoundToInt(s.x / LANE), -1, 1);
                    // scored: the keeper goes the wrong way; saved: he gets there
                    v.diveSide = g.result > 0 ? (runLane >= 0 ? -1 : 1) : (runLane == 0 ? 1 : runLane);
                    var green = new Color32(34, 197, 94, 255);
                    var red = new Color32(239, 68, 68, 255);
                    v.signs[g.correct + 1].sharedMaterial = Look.Mat(green, null, 0.6f, 0.1f);
                    if (g.result < 0) v.signs[runLane + 1].sharedMaterial = Look.Mat(red, null, 0.6f, 0.1f);
                    if (g.result > 0) Burst(confetti, new Vector3(0, 0.5f, g.z + 1), 160);
                }
                if (v.resultAt < 0)
                {
                    v.keeperHolder.localPosition = new Vector3(Mathf.Sin(time * 2.2f + g.q) * 1.1f, 0, 0.6f);
                    v.keeper.Apply(Pose.Keeper, time * 4);
                }
                else
                {
                    float k = (time - v.resultAt) / 0.45f;
                    v.keeper.Apply(Pose.Dive, 0, k, -v.diveSide);
                    float x0 = v.keeperHolder.localPosition.x;
                    v.keeperHolder.localPosition = new Vector3(Mathf.Lerp(x0, v.diveSide * LANE * 0.8f, Mathf.Min(1, dt * 8)), 0, 0.6f);
                }
                // let the runner through the net once he gets there
                bool through = s.z > g.z - 1.5f;
                foreach (var n in v.net) if (n.name == "netBack" || n.name == "netTop") n.enabled = !through || s.z > g.z + 6;
            }
            drop.Clear();
            foreach (var kv in goalViews)
                if (!s.goals.Contains(kv.Key))
                {
                    kv.Value.go.SetActive(false);
                    goalPool.Push(kv.Value);
                    drop.Add(kv.Key.q);
                }
            if (drop.Count > 0)
            {
                var keys = new List<Goal>(goalViews.Keys);
                foreach (var key in keys) if (!s.goals.Contains(key)) goalViews.Remove(key);
            }

            // the shot: from the feet into the net (or the keeper's gloves)
            if (shotT >= 0)
            {
                float k = (time - shotT) / 0.35f;
                if (k > 2.2f)
                {
                    shotT = -1;
                    shot.gameObject.SetActive(false);
                }
                else
                {
                    float kk = Mathf.Clamp01(k);
                    var p = Vector3.Lerp(shotFrom, shotTo, kk);
                    p.y += Mathf.Sin(kk * Mathf.PI) * 0.8f;
                    shot.position = p;
                    shot.Rotate(720 * dt, 0, 0);
                }
            }
        }

        void Shoot(bool scored)
        {
            var g = (Goal)null;
            foreach (var gg in S.goals) if (gg.result != 0 && gg.z <= S.z + 0.5f) g = gg;
            if (g == null) return;
            int runLane = Mathf.Clamp(Mathf.RoundToInt(S.x / LANE), -1, 1);
            shotFrom = ball.position;
            float corner = runLane == 0 ? (g.q % 2 == 0 ? 0.7f : -0.7f) : runLane * 0.6f;
            shotTo = scored
                ? new Vector3(runLane * LANE + corner, 1.9f, g.z + 2.2f)
                : new Vector3((runLane == 0 ? 1 : runLane) * LANE * 0.8f, 1.2f, g.z + 0.6f);
            shotT = Application.isPlaying ? Time.time : S.t;
            shot.gameObject.SetActive(true);
            ballHidden = 0.7f;
        }
    }
}
