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
        /// <summary>stands in short pieces so they bend with the world without visible kinks</summary>
        const float STAND_X = 8.5f, STAND_LEN = 18f;
        const int STANDS = 14;
        const float GROUND_BACK = 20f, GROUND_LEN = 190f;
        /// <summary>how long a fall plays before the app shows the result</summary>
        const float FALL_S = 0.45f;
        /// <summary>the world's curve: a point d metres ahead of the camera drops CURVE · d² (the pitch rolls away under the
        /// horizon about 50 m out, so what the rules lay 90 m ahead rises into view instead of popping up)</summary>
        const float CURVE = 0.0018f;
        /// <summary>the camera: height, distance behind the runner, pitch down</summary>
        const float CAM_H = 4.1f, CAM_BACK = 7.2f, CAM_PITCH = 13f;

        static readonly CultureInfo Inv = CultureInfo.InvariantCulture;

        public RunState S { get; private set; }
        bool running, paused, started;
        string pending = "";
        AppMsg setup;
        Camera cam;
        Transform world;

        // world pieces
        Transform ground, backdrop;
        Material groundMat;
        readonly List<Transform> boards = new List<Transform>();
        readonly List<Transform> stands = new List<Transform>();
        /// <summary>the LED boards' pictures (they scroll), the corner flags (they flutter), the crowd tiers (cameras flash in them)</summary>
        readonly List<Material> boardMats = new List<Material>();
        readonly List<Transform> flags = new List<Transform>();
        readonly List<Transform> tiers = new List<Transform>();
        readonly List<Flash> crowdFlashes = new List<Flash>();
        float nextCrowdFlash;
        /// <summary>the camera's own smoothing across the lanes (it never yaws: the lanes stay straight on screen)</summary>
        float viewX, viewFov = 60;
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
        ParticleSystem sparkle, confetti, splash, dust, speedLines, jetTrail;
        Material shadowMat, glowMat, starMat, raysMat;
        Texture2D blobTex;
        // coin flashes (a pool of sparkles that pop and fade) and the burst of rays when a power-up is picked
        readonly List<Flash> flashes = new List<Flash>();
        Transform rays;
        float raysAt = -9, fovKick, camDip, jetK;
        // the chaser: the referee, close behind after a bump, far back otherwise
        Transform referee;
        Figure refereeFig;
        float chaseD = 30, chaseX, chaseY;
        // what the runner wears for the jet and the spring boots
        Transform jetPack;
        readonly List<GameObject> springParts = new List<GameObject>();
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
            public Transform[] parts;
        }

        class Flash
        {
            public Transform t;
            public float at = -9, size;
            /// <summary>where it is from the runner (it travels along with him); for a crowd flash, where it is in the world</summary>
            public Vector3 off;
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
            // as fast as the screen goes (120 Hz phones included), never under 60
            int hz = Mathf.RoundToInt((float)Screen.currentResolution.refreshRateRatio.value);
            Application.targetFrameRate = Mathf.Clamp(hz, 60, 120);
            QualitySettings.vSyncCount = 0;
            Shader.SetGlobalFloat("_RushCurve", CURVE);
            Shader.SetGlobalFloat("_RushCamZ", -CAM_BACK);
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
            BuildChaser();
            Prewarm();
            Menu();
            Bridge.Send("{\"t\":\"ready\"}");
        }

        /// <summary>Build one of everything now and put it in the pools, so nothing is made (and no frame is dropped)
        /// when it first comes up mid-run. The shaders are the same three the first frame already draws, so they need no
        /// warm-up (Shader.WarmupAllShaders aborts under Metal: it makes pipelines with no render target).</summary>
        void Prewarm()
        {
            var made = new List<Thing>();
            foreach (int kind in new[] { 0, 0, 1, 1, 2, 2, 2, 3, 3, 4, 5, K_REF, K_LETTER, K_LETTER, K_PICK, K_PICK + 1, K_PICK + 2, K_PICK + 3, K_PICK + 4, K_PICK + 5 })
                made.Add(Make(kind));
            for (int i = 0; i < 24; i++) made.Add(Make(K_COIN));
            foreach (int len in new[] { 12, 18, 24, 30 }) made.Add(MakeDugout(K_DUGOUT + len, len));
            made.Add(MakeMower(K_MOWER + 4, 4));
            made.Add(MakeRamp());
            made.Add(MakeRamp());
            foreach (var t in made) Release(t);
            var g = MakeGoal();
            g.go.SetActive(false);
            goalPool.Push(g);
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
            cam.fieldOfView = 60;
            cam.nearClipPlane = 0.3f;
            cam.farClipPlane = 260;
            cam.allowMSAA = true;
            cam.allowHDR = false;
            go.tag = "MainCamera";
            // a close haze: what is far goes pale and quiet, what is near stays bold (the far backdrop takes less of it)
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.Linear;
            RenderSettings.fogColor = new Color32(176, 220, 246, 255);
            RenderSettings.fogStartDistance = 16;
            RenderSettings.fogEndDistance = 85;
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
            // the grass: one long strip that follows the runner, its texture scrolled to match the ground
            groundMat = Look.Mat(Color.white, Look.Pitch(LANE, HALF), 0, 0);
            groundMat.mainTextureScale = new Vector2(1, GROUND_LEN / Look.PITCH_TILE);
            ground = Look.Part("ground", world, Look.GroundQuad(), groundMat, Vector3.zero, new Vector3(60, 1, GROUND_LEN)).transform;

            // advertising boards along both touchlines (blank colours, our name now and then), a corner flag every few
            Color[] boardCols = { new Color32(37, 99, 235, 255), new Color32(22, 163, 74, 255), new Color32(234, 88, 12, 255), new Color32(124, 58, 237, 255), new Color32(220, 38, 38, 255) };
            var font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            var pole = Look.Mat(new Color32(241, 245, 249, 255), null, 0.2f);
            var flagMat = Look.Mat(new Color32(250, 204, 21, 255), null, 0.35f, 0.2f);
            var artMats = new Dictionary<string, Material>();
            for (int i = 0; i < BOARDS; i++)
            {
                int side = i % 2 == 0 ? -1 : 1;
                var b = new GameObject("board").transform;
                b.SetParent(world, false);
                var col = boardCols[(i / 2) % boardCols.Length];
                // the board graphics from the brief when they are there (board-1 … board-4), else plain colours
                string artName = "board-" + ((i / 2) % 4 + 1);
                var art = Look.Art(artName);
                Material faceMat;
                if (art != null)
                {
                    // one material per picture, a touch darker than the pitch-side things so it stays in the background
                    if (!artMats.TryGetValue(artName, out faceMat))
                    {
                        faceMat = new Material(Look.Mat(new Color(0.82f, 0.82f, 0.82f), art, 0.35f, 0.05f));
                        // a picture repeats along the board at its own shape (never squashed)
                        faceMat.mainTextureScale = new Vector2(BOARD_LEN / 0.9f / ((float)art.width / art.height), 1);
                        artMats[artName] = faceMat;
                        boardMats.Add(faceMat);
                    }
                }
                else faceMat = Look.Mat(col, Look.Stripe(col, Color.Lerp(col, Color.white, 0.25f)), 0.35f, 0.1f);
                Look.Part("face", b, Look.LongCube(), faceMat, new Vector3(0, 0.5f, 0), new Vector3(0.12f, 0.9f, BOARD_LEN));
                Look.Part("leg", b, Look.LongCube(), Look.Mat(new Color32(40, 44, 52, 255)), new Vector3(side * 0.25f, 0.25f, 0), new Vector3(0.05f, 0.5f, BOARD_LEN * 0.9f), new Vector3(0, 0, side * 25));
                if (art == null && (i / 2) % 2 == 0)
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
                    t.GetComponent<MeshRenderer>().sharedMaterial = Look.TextMat(font);
                }
                if ((i / 2) % 4 == 0)
                {
                    // a corner flag at the board's near end, just inside the touchline
                    var f = Look.Pivot("flag", b, new Vector3(-side * 0.7f, 0, -BOARD_LEN / 2 + 0.2f));
                    Look.Part("pole", f, PrimitiveType.Cylinder, pole, new Vector3(0, 0.8f, 0), new Vector3(0.06f, 0.8f, 0.06f));
                    Look.Part("tip", f, PrimitiveType.Sphere, Look.Mat(new Color32(220, 38, 38, 255), null, 0.3f), new Vector3(0, 1.62f, 0), Vector3.one * 0.1f);
                    var cloth = Look.Pivot("cloth", f, new Vector3(0, 1.4f, 0));
                    Look.Part("c", cloth, PrimitiveType.Cube, flagMat, new Vector3(0, 0, 0.22f), new Vector3(0.03f, 0.34f, 0.44f));
                    flags.Add(cloth);
                }
                b.localPosition = new Vector3(side * BOARD_X, 0, (i / 2) * BOARD_GAP);
                boards.Add(b);
            }

            // the far end of the stadium, when its picture is there: a big unlit card at the horizon, following along.
            // It does not bend with the world: it sits where the pitch has rolled away under the horizon
            var far = Look.Art("backdrop");
            if (far != null)
            {
                var farMat = Look.Glow(Color.white, far);
                farMat.SetFloat("_Fog", 0.35f);
                farMat.SetFloat("_Curve", 0);
                farMat.renderQueue = 2900;
                // its top fades into the sky behind it: paint that in the picture's sky colour (just under the fade),
                // and let the haze take the same colour so the far pitch dissolves into it
                if (far.isReadable)
                {
                    Color sky = Color.black;
                    for (int i = 0; i < 8; i++) sky += far.GetPixelBilinear((i + 0.5f) / 8, 0.76f) / 8;
                    sky.a = 1;
                    cam.backgroundColor = sky;
                    RenderSettings.fogColor = Color.Lerp(sky, new Color(0.78f, 0.9f, 0.86f), 0.25f);
                }
                backdrop = Look.Part("backdrop", world, PrimitiveType.Quad, farMat, Vector3.zero, new Vector3(230, 230f * far.height / far.width, 1)).transform;
            }

            // the stands: a wall, rows of crowd climbing away, a roof, floodlights now and then
            var crowdArt = Look.Art("crowd");
            var crowd = crowdArt != null ? crowdArt : Look.Crowd();
            // the crowd a little dimmer than the pitch, so the lanes stay the brightest thing
            var crowdMat = Look.Mat(new Color(0.78f, 0.78f, 0.8f), crowd, 0.2f, 0);
            // the drawn crowd repeats twice up the stand at its own shape; the code-drawn one is one tile per 9 m
            crowdMat.mainTextureScale = crowdArt != null ? new Vector2(STAND_LEN / (9.6f / 2 * crowdArt.width / crowdArt.height), 2) : new Vector2(STAND_LEN / 9f, 1);
            var wallMat = Look.Mat(new Color32(30, 41, 59, 255));
            var roofMat = Look.Mat(new Color32(100, 116, 139, 255), null, 0, 0.1f);
            var poleMat = Look.Mat(new Color32(148, 163, 184, 255));
            var lampMat = Look.Mat(new Color32(255, 251, 235, 255), null, 1);
            for (int i = 0; i < STANDS * 2; i++)
            {
                int side = i % 2 == 0 ? -1 : 1;
                var st = new GameObject("stand").transform;
                st.SetParent(world, false);
                Look.Part("wall", st, Look.LongCube(), wallMat, new Vector3(0, 0.6f, 0), new Vector3(0.4f, 1.2f, STAND_LEN));
                var tier = Look.Part("crowd", st, Look.GridQuad(8, 1), crowdMat, new Vector3(side * 4.2f, 4.4f, 0), new Vector3(STAND_LEN, 9.6f, 1));
                // facing the pitch, the rows climbing away from it
                tier.transform.localRotation = Quaternion.Euler(0, side * 90, 0) * Quaternion.Euler(35, 0, 0);
                tiers.Add(tier.transform);
                Look.Part("back", st, Look.LongCube(), wallMat, new Vector3(side * 8.2f, 4.5f, 0), new Vector3(0.6f, 9f, STAND_LEN));
                Look.Part("roof", st, Look.LongCube(), roofMat, new Vector3(side * 7.3f, 9.8f, 0), new Vector3(3.4f, 0.3f, STAND_LEN));
                if (i % 8 < 2)
                {
                    Look.Part("pole", st, PrimitiveType.Cylinder, poleMat, new Vector3(side * 9f, 9f, 0), new Vector3(0.35f, 9f, 0.35f));
                    Look.Part("lamps", st, PrimitiveType.Cube, lampMat, new Vector3(side * 9f, 18.4f, 0), new Vector3(0.4f, 1.4f, 2.6f), new Vector3(0, 0, side * 20));
                }
                st.localPosition = new Vector3(side * STAND_X, 0, (i / 2) * STAND_LEN);
                stands.Add(st);
            }

            // the crowd's cameras: little flashes popping in the stands (a pool, placed on the tiers as they go off)
            var flashMat = Look.Glow(new Color(1, 1, 1, 0.9f), Look.Star(), true);
            for (int i = 0; i < 12; i++)
            {
                var f = Look.Part("camflash", world, PrimitiveType.Quad, flashMat, Vector3.zero, Vector3.one).transform;
                f.gameObject.SetActive(false);
                crowdFlashes.Add(new Flash { t = f });
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

            // the jet's exhaust: a rainbow pouring down and back from the nozzles; short-lived, so it is gone
            // before the camera (following the runner) gets there
            jetTrail = Particles("jet", Color.white, Color.white, 0.42f, 0.3f, false, 400);
            m = jetTrail.main;
            m.startSpeed = new ParticleSystem.MinMaxCurve(5, 7);
            m.gravityModifier = 0.4f;
            sh = jetTrail.shape;
            sh.shapeType = ParticleSystemShapeType.Cone;
            sh.angle = 6;
            sh.radius = 0.08f;
            jetTrail.transform.rotation = Quaternion.Euler(70, 0, 0);
            var jcol = jetTrail.colorOverLifetime;
            var rb = Rainbow();
            rb.mode = GradientMode.Blend;
            rb.SetKeys(rb.colorKeys, new[] { new GradientAlphaKey(1, 0), new GradientAlphaKey(0.9f, 0.7f), new GradientAlphaKey(0, 1) });
            jcol.color = rb;
            var size = jetTrail.sizeOverLifetime;
            size.enabled = true;
            size.size = new ParticleSystem.MinMaxCurve(1, AnimationCurve.Linear(0, 0.5f, 1, 1.5f));

            // pooled coin flashes and the power-up rays, all facing the camera
            starMat = Look.Glow(new Color(1, 0.93f, 0.6f, 1), Look.Star(), true);
            for (int i = 0; i < 10; i++)
            {
                var f = Look.Part("flash", world, PrimitiveType.Quad, starMat, Vector3.zero, Vector3.one).transform;
                f.gameObject.SetActive(false);
                flashes.Add(new Flash { t = f });
            }
            raysMat = Look.Glow(Color.white, Look.Rays(), true);
            rays = Look.Part("rays", world, PrimitiveType.Quad, raysMat, Vector3.zero, Vector3.one).transform;
            rays.gameObject.SetActive(false);
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

            // the jet: a big ball on the back with two nozzles and a flame under each
            var body = runnerHolder.Find("figure/body");
            jetPack = Look.Pivot("jet", body, new Vector3(0, 0.36f, -0.32f));
            Look.Part("tank", jetPack, PrimitiveType.Sphere, ball.GetComponent<Renderer>().sharedMaterial, new Vector3(0, 0.05f, -0.08f), Vector3.one * 0.46f);
            var steel = Look.Mat(new Color32(71, 85, 105, 255), null, 0.1f, 0.4f);
            var flame = Look.Glow(new Color(1, 0.62f, 0.15f, 0.95f), blobTex, true);
            foreach (int sd in new[] { -1, 1 })
            {
                Look.Part("nozzle", jetPack, PrimitiveType.Cylinder, steel, new Vector3(sd * 0.17f, -0.2f, -0.1f), new Vector3(0.13f, 0.12f, 0.13f));
                Look.Part("flame", jetPack, Look.Cone(), Look.Mat(new Color32(255, 200, 60, 255), null, 1), new Vector3(sd * 0.17f, -0.33f, -0.1f), new Vector3(0.14f, 0.34f, 0.14f), new Vector3(180, 0, 0));
                Look.Part("glow", jetPack, PrimitiveType.Quad, flame, new Vector3(sd * 0.17f, -0.5f, -0.2f), Vector3.one * 0.7f);
            }
            jetPack.gameObject.SetActive(false);

            // the spring boots: green boots with a coil under each sole
            springParts.Clear();
            var green = Look.Mat(new Color32(34, 197, 94, 255), null, 0.45f, 0.4f);
            var coil = Look.Mat(new Color32(203, 213, 225, 255), null, 0.2f, 0.5f);
            foreach (var hip in new[] { "hipL", "hipR" })
            {
                var knee = body.Find(hip + "/knee");
                springParts.Add(Look.Part("springBoot", knee, PrimitiveType.Cube, green, new Vector3(0, -0.4f, 0.05f), new Vector3(0.18f, 0.12f, 0.29f)));
                for (int i = 0; i < 3; i++)
                    springParts.Add(Look.Part("coil", knee, Look.Torus(), coil, new Vector3(0, -0.48f - i * 0.06f, 0.05f), new Vector3(0.13f, 0.13f, 0.35f), new Vector3(90, 0, 0)));
            }
            foreach (var p in springParts) p.SetActive(false);
        }

        /// <summary>The referee who chases the runner after a bump (and books him on the second).</summary>
        void BuildChaser()
        {
            referee = new GameObject("referee").transform;
            referee.SetParent(world, false);
            var black = new Color32(17, 24, 39, 255);
            refereeFig = new Figure(referee, black, black, black, black, Figure.Skins[1], Figure.Hairs[1], null, false, true);
            referee.localScale = Vector3.one * 0.95f;
            // a whistle on a cord, bright cuffs so he reads as the ref from behind
            var body = referee.Find("figure/body");
            var yellow = Look.Mat(new Color32(250, 204, 21, 255), null, 0.4f);
            Look.Part("collar", body, PrimitiveType.Cylinder, yellow, new Vector3(0, 0.6f, 0), new Vector3(0.3f, 0.025f, 0.3f));
            foreach (var arm in new[] { "armL", "armR" })
                Look.Part("cuff", body.Find(arm), PrimitiveType.Cylinder, yellow, new Vector3(0, -0.2f, 0), new Vector3(0.19f, 0.02f, 0.19f));
            Look.Part("whistle", body, PrimitiveType.Cube, Look.Mat(new Color32(226, 232, 240, 255), null, 0.3f), new Vector3(0.08f, 0.45f, 0.2f), new Vector3(0.07f, 0.05f, 0.1f));
            Look.Part("shadow", referee, PrimitiveType.Quad, shadowMat, new Vector3(0, 0.015f, 0), new Vector3(1.1f, 1.1f, 1), new Vector3(90, 0, 0));
            referee.gameObject.SetActive(false);
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
            S = new RunState((uint)m.seed, m.answers, true, m.words);
            running = true;
            started = true;
            paused = false;
            overSent = false;
            pending = "";
            lastHud = "";
            ballHidden = 0;
            chaseD = 2.2f;
            chaseX = 0;
            chaseY = 0;
            jetK = 0;
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
            // the letter shirts wear the kit: the pooled ones are thrown away
            if (pool.TryGetValue(K_LETTER, out var shirts))
            {
                foreach (var t in shirts) Destroy0(t.go);
                shirts.Clear();
            }
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
            foreach (var f in flashes)
            {
                f.at = -9;
                f.t.gameObject.SetActive(false);
            }
            if (rays) rays.gameObject.SetActive(false);
            if (jetTrail) jetTrail.Clear();
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
                    Bridge.Send(string.Format(Inv, "{{\"t\":\"over\",\"score\":{0},\"coins\":{1},\"metres\":{2},\"goals\":{3},\"words\":{4}}}", S.Score, S.coinsTaken, (int)S.z, S.goalsScored, S.wordsDone));
                }
            }
            if (!paused) Draw(dt);
            // editor checks (RushBuild.Shots) tick by hand, outside play mode: move the particles along too
            if (!Application.isPlaying && dt > 0)
                foreach (var ps in world.GetComponentsInChildren<ParticleSystem>()) ps.Simulate(dt, false, false, false);
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
                case Ev.Power:
                    name = "power";
                    Burst(sparkle, RunnerPos() + Vector3.up, 40);
                    raysAt = Application.isPlaying ? Time.time : S.t;
                    raysMat.color = PowerGlow(S.lastPowerKind);
                    fovKick = 9;
                    break;
                case Ev.Land:
                    Burst(dust, RunnerPos() + new Vector3(0, 0.15f, 0.2f), 16);
                    camDip = 0.22f;
                    break;
                case Ev.Letter:
                    name = "letter";
                    Burst(sparkle, RunnerPos() + Vector3.up * 1.2f, 30);
                    Pop(RunnerPos() + new Vector3(0, 1.4f, 0.4f), Application.isPlaying ? Time.time : S.t);
                    break;
                case Ev.Word:
                    name = "word";
                    Burst(confetti, RunnerPos() + new Vector3(0, 0.5f, 3), 160);
                    CrowdStorm(Application.isPlaying ? Time.time : S.t);
                    raysAt = Application.isPlaying ? Time.time : S.t;
                    raysMat.color = new Color(1, 0.85f, 0.2f, 0.9f);
                    fovKick = 10;
                    break;
                case Ev.Jump:
                    Burst(dust, RunnerPos() + new Vector3(0, 0.15f, 0), S.spring > 0 ? 22 : 6);
                    break;
                case Ev.Saved: name = "saved"; break;
                case Ev.Splash: name = "splash"; Burst(splash, RunnerPos() + Vector3.up * 0.6f, 40); break;
                case Ev.Roll: if (S.y <= 0.01f) Burst(dust, RunnerPos() + new Vector3(0, 0.2f, 0.6f), 14); break;
            }
            if (name == null) return;
            if (e == Ev.Power) Bridge.Send("{\"t\":\"ev\",\"e\":\"power\",\"k\":" + S.lastPowerKind + "}");
            else if (e == Ev.Word) Bridge.Send("{\"t\":\"ev\",\"e\":\"word\",\"mult\":" + S.mult + ",\"name\":\"" + S.words[(S.wordIdx - 1 + S.words.Length) % S.words.Length] + "\"}");
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
              .Append(",\"jet\":").Append((Mathf.Ceil(S.jet * 10) / 10).ToString(Inv))
              .Append(",\"spring\":").Append((Mathf.Ceil(S.spring * 10) / 10).ToString(Inv))
              .Append(",\"q\":").Append(q)
              .Append(",\"word\":\"").Append(S.Word).Append('"')
              .Append(",\"got\":").Append(S.letterIdx)
              .Append(",\"words\":").Append(S.wordsDone)
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

            // camera: low behind the runner, never turning (the lanes stay straight on screen), sliding across after
            // the runner's lane with its own quick easing and up after jumps; a landing dips it, the jet lifts it and
            // tips it up, a power-up kicks the field of view out for a moment
            float shake = s.shake > 0 ? s.shake * 0.5f : 0;
            Vector3 sh = shake > 0 ? new Vector3(Mathf.Sin(s.t * 90) * shake, Mathf.Cos(s.t * 80) * shake * 0.6f, 0) : Vector3.zero;
            jetK = Mathf.MoveTowards(jetK, s.jet > 0 ? 1 : 0, dt * 1.6f);
            float jk = jetK * jetK * (3 - 2 * jetK);
            camDip = Mathf.MoveTowards(camDip, 0, dt * 1.2f);
            fovKick = Mathf.MoveTowards(fovKick, 0, dt * 14);
            float wantX = s.x * 0.9f;
            viewX = dt > 0 ? viewX + (wantX - viewX) * Mathf.Min(1, dt * 10) : wantX;
            cam.transform.position = new Vector3(viewX, CAM_H + s.camY + jk * 1.6f - camDip, s.z - CAM_BACK) + sh;
            cam.transform.rotation = Quaternion.Euler(CAM_PITCH - jk * 9 + camDip * 4, 0, 0);
            float fov = 60 + Mathf.Clamp01((s.speed - RunState.SPEED0) / (RunState.SPEED_MAX - RunState.SPEED0)) * 3 + (s.boots > 0 ? 5 : 0) + jk * 5;
            viewFov = dt > 0 ? Mathf.Lerp(viewFov, fov, Mathf.Min(1, dt * 4)) : fov;
            cam.fieldOfView = viewFov + fovKick;
            // the world bends away from here
            Shader.SetGlobalFloat("_RushCamZ", cam.transform.position.z);

            // the ground scrolls under a strip that follows; boards and stands leapfrog forward
            float g0 = s.z - GROUND_BACK;
            ground.position = new Vector3(0, 0, g0 + GROUND_LEN / 2);
            // the tile's centre circle sits on the start line: the run kicks off from the centre spot
            groundMat.mainTextureOffset = new Vector2(0, Mathf.Repeat(g0 / Look.PITCH_TILE + 0.5f, 1));
            // the far stand sits where the pitch has rolled under the horizon, its foreground just below that line
            // (its picture's stand starts about a quarter of the way up; the pitch's edge is about 33 m down out there)
            if (backdrop) backdrop.position = new Vector3(viewX * 0.5f, -13 + jk * 4, cam.transform.position.z + 215);
            float span = BOARDS / 2 * BOARD_GAP;
            foreach (var b in boards)
                if (b.position.z < s.z - 12) b.position += new Vector3(0, 0, span);
                else if (b.position.z > s.z - 12 + span) b.position -= new Vector3(0, 0, span * Mathf.Floor((b.position.z - (s.z - 12)) / span));
            float sspan = STANDS * STAND_LEN;
            foreach (var st in stands)
                if (st.position.z < s.z - 30) st.position += new Vector3(0, 0, sspan);
                else if (st.position.z > s.z - 30 + sspan) st.position -= new Vector3(0, 0, sspan * Mathf.Floor((st.position.z - (s.z - 30)) / sspan));
            // the LED boards run their pictures along, the corner flags flutter
            foreach (var m in boardMats) m.mainTextureOffset = new Vector2(Mathf.Repeat(time * 0.06f, 1), 0);
            for (int i = 0; i < flags.Count; i++)
                flags[i].localRotation = Quaternion.Euler(0, 20 + Mathf.Sin(time * 5 + i * 1.3f) * 14, Mathf.Sin(time * 7 + i) * 5);
            DrawCrowdFlashes(dt, time);

            DrawRunner(dt, time, phase);
            DrawChaser(dt, time);
            DrawThings(dt, time);
            DrawGoals(dt, time);
            DrawFlying(dt);
            DrawFlashes(time);
            if (speedLines)
            {
                speedLines.transform.position = new Vector3(viewX, 2.5f + s.camY, s.z + 30);
                var em = speedLines.emission;
                em.rateOverTime = running && !s.Dead ? (s.boots > 0 || s.jet > 0 ? 260 : Mathf.Lerp(0, 70, (s.speed - 16) / 11)) : 0;
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
            else if (s.jet > 0 && s.y > 1) pose = Pose.Fly;
            else if (s.slide > 0 && s.y - s.gy < 0.3f) pose = Pose.Slide;
            else if (s.y - s.gy > 0.05f) pose = Pose.Jump;
            else pose = Pose.Run;
            runner.Apply(pose, started ? phase : time * 3, k, side);
            // flicker while passing through after a forgiven crash; a bump wobbles
            bool flicker = s.ghost > 0 && s.boots <= 0 && Mathf.Repeat(s.t * 12, 1) < 0.5f;
            runner.SetVisible(!flicker);
            if (s.stumble < 0.5f && !s.Dead) runnerHolder.rotation *= Quaternion.Euler(0, 0, Mathf.Sin(s.stumble * 40) * 10 * (0.5f - s.stumble));

            runnerShadow.position = new Vector3(s.x, s.gy + 0.02f, s.z + 0.1f);
            float hs = Mathf.Clamp(1.2f - (s.y - s.gy) * 0.25f, 0.4f, 1.2f);
            runnerShadow.localScale = new Vector3(hs, hs * 1.3f, 1);

            // the ball: dribbled just ahead of the feet, kept up in a jump, rolling away after a foul
            if (ballHidden > 0) ballHidden -= dt;
            Vector3 bp;
            float air = s.y - s.gy;
            if (s.Dead) bp = new Vector3(s.x + 0.3f, s.gy + 0.22f, ball.position.z + Mathf.Max(0, s.speed * 0.6f + 3) * dt);
            else if (!started) bp = new Vector3(s.x + 0.2f, 0.22f, s.z + 0.55f);
            else if (pose == Pose.Slide) bp = new Vector3(s.x, s.gy + 0.22f, s.z + 1.25f);
            else if (pose == Pose.Fly) bp = new Vector3(s.x, s.y + 0.05f, s.z + 0.7f);
            else
            {
                float touch = Mathf.Abs(Mathf.Sin(phase)) * 0.2f;
                bp = new Vector3(s.x + 0.16f, s.gy + 0.22f + (air > 0 ? air * 0.85f : 0), s.z + 0.62f + touch);
            }
            ball.position = bp;
            ballSpin += (started && !s.Dead ? s.speed : 4) * dt / 0.22f * Mathf.Rad2Deg;
            ball.rotation = Quaternion.Euler(ballSpin, 0, 0);
            ball.gameObject.SetActive(ballHidden <= 0);

            // power-up glow ring, armband
            Color aura = s.boots > 0 ? new Color(1, 0.45f, 0.1f) : s.magnet > 0 ? new Color(0.95f, 0.2f, 0.2f) : s.dbl > 0 ? new Color(0.6f, 0.35f, 1f) : s.spring > 0 ? new Color(0.2f, 0.9f, 0.35f) : s.wet > 0 ? new Color(0.3f, 0.65f, 1f) : Color.clear;
            bool auraOn = started && !s.Dead && aura.a > 0 && s.jet <= 0;
            auraT.gameObject.SetActive(auraOn);
            if (auraOn)
            {
                aura.a = 0.55f + Mathf.Sin(time * 10) * 0.2f;
                auraR.sharedMaterial.color = aura;
                auraT.position = new Vector3(s.x, s.gy + 0.04f, s.z);
                auraT.rotation = Quaternion.Euler(90, 0, 0);
            }
            armbandT.gameObject.SetActive(s.armband > 0);

            // the jet pack and its rainbow, the spring boots
            bool jetOn = started && !s.Dead && s.jet > 0;
            jetPack.gameObject.SetActive(jetOn);
            if (jetTrail)
            {
                var em = jetTrail.emission;
                em.rateOverTime = jetOn ? 220 : 0;
                if (jetOn) jetTrail.transform.position = jetPack.position + new Vector3(0, -0.45f, -0.15f);
            }
            bool springOn = started && !s.Dead && s.spring > 0;
            if (springParts.Count > 0 && springParts[0].activeSelf != springOn) foreach (var p in springParts) p.SetActive(springOn);
        }

        /// <summary>The referee: right behind after a bump (and at the start), far back otherwise; he catches the
        /// runner after a second bump and shows the card.</summary>
        void DrawChaser(float dt, float time)
        {
            var s = S;
            float target = !started ? 40 : s.Dead ? 1.3f : s.stumble < RunState.STUMBLE_S ? 4.4f : s.t < 2.2f ? 4.4f : 12;
            // he drops back slowly and closes in fast
            float rate = target < chaseD ? 3.2f : 0.5f;
            chaseD = dt > 0 ? chaseD + (target - chaseD) * Mathf.Min(1, dt * rate) : target;
            bool show = started && chaseD < 11;
            if (referee.gameObject.activeSelf != show) referee.gameObject.SetActive(show);
            if (!show) return;
            float z = s.z - chaseD;
            // a little to one side so the runner stays in sight
            float side = s.x > 0.5f ? -0.95f : 0.95f;
            chaseX = dt > 0 ? chaseX + (s.x + side - chaseX) * Mathf.Min(1, dt * 4) : s.x + side;
            float floor = s.FloorAt(chaseX, z, out _);
            chaseY = dt > 0 ? Mathf.MoveTowards(chaseY, floor, dt * 9) : floor;
            referee.position = new Vector3(chaseX, chaseY, z);
            refereeFig.Apply(s.Dead && chaseD < 1.8f ? Pose.Ref : Pose.Run, s.Dead ? time * 3 : z * 1.05f);
        }

        // ---------- obstacles, coins, power-ups

        const int K_COIN = 100, K_PICK = 200, K_REF = 6, K_LETTER = 300;

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
                case 1: // a training crossbar across the lane: roll under it (red and white, a clear gap below)
                    {
                        var post = Look.Mat(new Color32(241, 245, 249, 255), null, 0.2f);
                        var bar = Look.Mat(Color.white, Look.Candy(new Color32(220, 38, 38, 255), Color.white), 0.25f, 0.3f);
                        bar.mainTextureScale = new Vector2(6, 1);
                        foreach (int sd in new[] { -1, 1 })
                        {
                            Look.Part("post", tr, PrimitiveType.Cylinder, post, new Vector3(sd * 1.08f, 0.95f, 0), new Vector3(0.12f, 0.95f, 0.12f));
                            Look.Part("foot", tr, PrimitiveType.Cylinder, Look.Mat(new Color32(30, 41, 59, 255)), new Vector3(sd * 1.08f, 0.04f, 0), new Vector3(0.42f, 0.04f, 0.42f));
                            Look.Part("flag", tr, PrimitiveType.Cube, Look.Mat(new Color32(250, 204, 21, 255), null, 0.4f), new Vector3(sd * 1.08f + sd * 0.16f, 1.82f, 0), new Vector3(0.3f, 0.22f, 0.02f));
                        }
                        Look.Part("bar", tr, PrimitiveType.Cylinder, bar, new Vector3(0, 1.5f, 0), new Vector3(0.26f, 1.12f, 0.26f), new Vector3(0, 0, 90));
                        Shadow(tr, 2.6f, 0.5f);
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
                case K_REF: // a defender who steps across into the next lane as you come
                    {
                        var h = Look.Pivot("h", tr, Vector3.zero);
                        h.localRotation = Quaternion.Euler(0, 180, 0);
                        t.fig = new Figure(h, oppBody, oppSleeves, oppShorts, oppBody, Figure.Skins[skin], Figure.Hairs[Random.Range(0, 4)]);
                        Shadow(tr, 1.4f, 1.1f);
                        break;
                    }
                case K_LETTER: // a letter of the name: a shirt in the runner's kit hanging in the lane, the letter on it like a
                               // squad number (a chunky 3D letter that shows through both faces), a soft beam of light over it
                    {
                        Look.Part("beam", tr, PrimitiveType.Quad, Look.Glow(new Color(0.5f, 0.85f, 1, 0.22f), Look.Beam(), true), new Vector3(0, 2.6f, 0.25f), new Vector3(1.0f, 5.2f, 1));
                        t.spin = Look.Pivot("spin", tr, new Vector3(0, 1.5f, 0));
                        Look.Part("halo", t.spin, PrimitiveType.Quad, Look.Glow(new Color(0.55f, 0.9f, 1, 0.55f), blobTex, true), new Vector3(0, 0, 0.25f), Vector3.one * 2.3f);
                        float lum = kitBody.r * 0.3f + kitBody.g * 0.59f + kitBody.b * 0.11f;
                        var body = Look.Mat(kitBody, null, 0.12f, 0.35f);
                        var sleeve = Look.Mat(kitSleeves, null, 0.12f, 0.35f);
                        var letterMat = Look.Mat(lum > 0.6f ? (Color)new Color32(20, 24, 32, 255) : Color.white, null, 0.3f, 0.25f);
                        Look.Part("body", t.spin, PrimitiveType.Cube, body, new Vector3(0, -0.05f, 0), new Vector3(0.9f, 1.05f, 0.16f));
                        Look.Part("hem", t.spin, PrimitiveType.Cube, Look.Mat(Color.Lerp(kitBody, lum > 0.6f ? Color.black : Color.white, 0.25f), null, 0.12f, 0.3f), new Vector3(0, -0.56f, 0), new Vector3(0.92f, 0.06f, 0.18f));
                        Look.Part("collar", t.spin, PrimitiveType.Cube, Look.Mat(lum > 0.6f ? (Color)new Color32(30, 41, 59, 255) : Color.white, null, 0.2f, 0.2f), new Vector3(0, 0.47f, 0), new Vector3(0.34f, 0.08f, 0.2f));
                        foreach (int sd in new[] { -1, 1 })
                            Look.Part("sleeve", t.spin, PrimitiveType.Cube, sleeve, new Vector3(sd * 0.56f, 0.3f, 0), new Vector3(0.36f, 0.3f, 0.16f), new Vector3(0, 0, sd * 28));
                        // the hanger's hook
                        Look.Part("hook", t.spin, Look.Torus(), Look.Mat(new Color32(250, 204, 21, 255), null, 0.5f, 0.3f), new Vector3(0, 0.62f, 0), new Vector3(0.22f, 0.22f, 0.5f));
                        var letter = Look.Part("letter", t.spin, Look.BlockLetter('A'), letterMat, new Vector3(0, -0.07f, 0), new Vector3(0.74f, 0.74f, 0.3f));
                        t.parts = new[] { letter.transform };
                        Shadow(tr, 1.1f, 0.9f);
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
                        Look.Part("glow", tr, PrimitiveType.Quad, Look.Glow(PowerGlow(pk), blobTex, true), new Vector3(0, 1.1f, 0.3f), new Vector3(1.9f, 1.9f, 1));
                        t.spin = Look.Pivot("spin", tr, new Vector3(0, 1.1f, 0));
                        PowerModel(pk, t.spin);
                        Shadow(tr, 0.9f, 0.9f);
                        break;
                    }
            }
            return t;
        }

        /// <summary>A power-up model on its own (for the app's icons, RushBuild.Icons).</summary>
        public GameObject PowerIcon(int pk)
        {
            var t = Make(K_PICK + pk);
            t.go.transform.position = Vector3.zero;
            foreach (var r in t.go.GetComponentsInChildren<Renderer>()) if (r.name == "glow" || r.name == "shadow") r.enabled = false;
            return t.go;
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
                case 4: // the rocket ball: a ball with fins and a flame
                    {
                        Look.Part("ball", p, PrimitiveType.Sphere, Look.Mat(Color.white, Look.Ball(), 0.1f, 0.2f), Vector3.zero, Vector3.one * 0.62f);
                        var red = Look.Mat(new Color32(220, 38, 38, 255), null, 0.3f, 0.4f);
                        for (int i = 0; i < 3; i++)
                        {
                            var fin = Look.Pivot("fin", p, Vector3.zero);
                            fin.localRotation = Quaternion.Euler(0, i * 120, 0);
                            Look.Part("f", fin, PrimitiveType.Cube, red, new Vector3(0, -0.3f, 0.3f), new Vector3(0.04f, 0.26f, 0.2f), new Vector3(-25, 0, 0));
                        }
                        Look.Part("flame", p, Look.Cone(), Look.Mat(new Color32(255, 190, 50, 255), null, 1), new Vector3(0, -0.32f, 0), new Vector3(0.26f, 0.42f, 0.26f), new Vector3(180, 0, 0));
                        break;
                    }
                case 5: // a spring boot
                    {
                        var g = Look.Mat(new Color32(34, 197, 94, 255), null, 0.35f, 0.5f);
                        Look.Part("boot", p, PrimitiveType.Cube, g, new Vector3(0, 0.12f, 0.05f), new Vector3(0.3f, 0.22f, 0.55f));
                        Look.Part("ankle", p, PrimitiveType.Cube, g, new Vector3(0, 0.32f, -0.12f), new Vector3(0.28f, 0.3f, 0.28f));
                        Look.Part("sole", p, PrimitiveType.Cube, Look.Mat(new Color32(30, 30, 36, 255)), new Vector3(0, -0.01f, 0.05f), new Vector3(0.32f, 0.05f, 0.58f));
                        var c = Look.Mat(new Color32(203, 213, 225, 255), null, 0.3f, 0.5f);
                        for (int i = 0; i < 4; i++) Look.Part("coil", p, Look.Torus(), c, new Vector3(0, -0.08f - i * 0.09f, 0.05f), new Vector3(0.3f, 0.3f, 0.5f), new Vector3(90, 0, 0));
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
            t.GetComponent<MeshRenderer>().sharedMaterial = Look.TextMat(font);
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
                        bool stepping = near < RunState.DRIFT_AT && near > RunState.DRIFT_AT - 10;
                        t.fig.Apply(stepping ? Pose.Run : Pose.Stand, stepping ? time * 9 : time * 2 + o.id);
                        t.go.transform.rotation = stepping ? Quaternion.Euler(0, (o.moveTo - o.lane) * -70, 0) : Quaternion.identity;
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
            foreach (var l in s.letters)
            {
                if (l.taken) continue;
                seen.Add(l.id);
                if (!live.TryGetValue(l.id, out var t))
                {
                    live[l.id] = t = Get(K_LETTER);
                    t.parts[0].GetComponent<MeshFilter>().sharedMesh = Look.BlockLetter(l.ch);
                }
                t.go.transform.position = new Vector3(l.lane * LANE, 0, l.z);
                // hanging: a slow bob and a gentle sway that keeps the letter facing the runner
                t.spin.localPosition = new Vector3(0, 1.5f + Mathf.Sin(time * 2.4f + l.id) * 0.12f, 0);
                t.spin.localRotation = Quaternion.Euler(Mathf.Sin(time * 1.3f + l.id) * 4, Mathf.Sin(time * 1.1f + l.id) * 16, 0);
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
            DrawBlocks(time);
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
                    if (k >= 1)
                    {
                        Pop(target + new Vector3(Random.Range(-0.3f, 0.3f), Random.Range(-0.2f, 0.3f), 0), time);
                        if (i % 3 == 0) Burst(sparkle, target, 3);
                    }
                    flying.RemoveAt(i);
                    continue;
                }
                f.t.position = Vector3.Lerp(f.from, target, k * k);
                f.t.localScale = Vector3.one * (1 - k * 0.6f);
            }
        }

        /// <summary>Pop a sparkle here (the oldest one is reused).</summary>
        void Pop(Vector3 at, float time)
        {
            Flash best = flashes[0];
            foreach (var f in flashes) if (f.at < best.at) best = f;
            best.at = time;
            best.size = Random.Range(0.9f, 1.3f);
            best.off = at - RunnerPos();
            best.t.gameObject.SetActive(true);
        }

        void DrawFlashes(float time)
        {
            var face = cam.transform.rotation;
            foreach (var f in flashes)
            {
                if (!f.t.gameObject.activeSelf) continue;
                float k = (time - f.at) / 0.22f;
                if (k >= 1 || k < 0)
                {
                    f.t.gameObject.SetActive(false);
                    continue;
                }
                // pop out fast, shrink away
                float sz = (k < 0.3f ? k / 0.3f : 1 - (k - 0.3f) / 0.7f) * f.size;
                f.t.rotation = face * Quaternion.Euler(0, 0, f.size * 90 + k * 60);
                f.t.localScale = Vector3.one * sz;
                f.t.position = RunnerPos() + f.off;
            }
            // the power-up's rays: grow, turn and fade over half a second
            float rk = (time - raysAt) / 0.55f;
            bool on = rk >= 0 && rk < 1;
            if (rays.gameObject.activeSelf != on) rays.gameObject.SetActive(on);
            if (on)
            {
                rays.position = RunnerPos() + new Vector3(0, 1.1f, 0.6f);
                rays.rotation = face * Quaternion.Euler(0, 0, rk * 70);
                rays.localScale = Vector3.one * (1.5f + rk * 4.5f);
                var c = raysMat.color;
                c.a = 1 - rk * rk;
                raysMat.color = c;
            }
        }

        /// <summary>Cameras going off in the stands: a few a second near the runner, a storm when a name is done.</summary>
        void DrawCrowdFlashes(float dt, float time)
        {
            var s = S;
            nextCrowdFlash -= dt;
            if (started && !s.Dead && nextCrowdFlash <= 0 && tiers.Count > 0)
            {
                nextCrowdFlash = Random.Range(0.08f, 0.3f);
                // a tier within sight ahead of the runner
                var tier = tiers[Random.Range(0, tiers.Count)];
                float tz = tier.position.z;
                if (tz > s.z + 4 && tz < s.z + 60)
                {
                    Flash best = crowdFlashes[0];
                    foreach (var f in crowdFlashes) if (f.at < best.at) best = f;
                    best.at = time;
                    best.size = Random.Range(0.5f, 0.9f);
                    // the quad's own axes: x along the stand, y up the rows; a little in front of the crowd
                    best.off = tier.TransformPoint(new Vector3(Random.Range(-0.48f, 0.48f), Random.Range(-0.4f, 0.45f), -0.03f));
                    best.t.gameObject.SetActive(true);
                }
            }
            var face = cam.transform.rotation;
            foreach (var f in crowdFlashes)
            {
                if (!f.t.gameObject.activeSelf) continue;
                float k = (time - f.at) / 0.16f;
                if (k >= 1 || k < 0)
                {
                    f.t.gameObject.SetActive(false);
                    continue;
                }
                f.t.position = f.off;
                f.t.rotation = face;
                f.t.localScale = Vector3.one * f.size * (k < 0.25f ? k / 0.25f : 1 - (k - 0.25f) / 0.75f);
            }
        }

        /// <summary>A burst of camera flashes along the stands (a finished name).</summary>
        void CrowdStorm(float time)
        {
            var s = S;
            int n = 0;
            foreach (var f in crowdFlashes)
            {
                var tier = tiers[Random.Range(0, tiers.Count)];
                if (tier.position.z < s.z - 2 || tier.position.z > s.z + 70) continue;
                f.at = time + n++ * 0.05f;
                f.size = Random.Range(0.6f, 1.1f);
                f.off = tier.TransformPoint(new Vector3(Random.Range(-0.48f, 0.48f), Random.Range(-0.4f, 0.45f), -0.03f));
                f.t.gameObject.SetActive(true);
            }
        }

        static Color PowerGlow(int pk)
        {
            switch (pk)
            {
                case 0: return new Color(1, 0.5f, 0.1f, 0.8f);
                case 1: return new Color(1, 0.25f, 0.25f, 0.8f);
                case 2: return new Color(1, 0.85f, 0.2f, 0.8f);
                case 3: return new Color(0.65f, 0.4f, 1, 0.8f);
                case 4: return new Color(1, 0.4f, 0.75f, 0.8f);
                default: return new Color(0.3f, 1, 0.4f, 0.8f);
            }
        }

        // ---------- blocks and ramps

        const int K_DUGOUT = 1000, K_MOWER = 2000, K_RAMP = 3000;
        /// <summary>dugout roofs in strong colours that stand out on the grass (never green)</summary>
        static readonly Color32[] RoofCols = { new Color32(37, 99, 235, 255), new Color32(220, 38, 38, 255), new Color32(124, 58, 237, 255), new Color32(234, 88, 12, 255), new Color32(2, 132, 199, 255) };

        /// <summary>A dugout (the bench with its clear roof) from z = 0 (its glass end, facing the runner) to z = len;
        /// the flat roof at ROOF_H is a floor to run on.</summary>
        Thing MakeDugout(int kind, int len)
        {
            var t = new Thing { kind = kind, go = new GameObject("dugout") };
            var tr = t.go.transform;
            tr.SetParent(world, false);
            const float W = 2.2f, H = RunState.ROOF_H;
            Color team = RoofCols[Random.Range(0, RoofCols.Length)];
            var teamMat = Look.Mat(team, null, 0.1f, 0.3f);
            var white = Look.Mat(new Color32(248, 250, 252, 255), null, 0.15f, 0.2f);
            var frame = Look.Mat(new Color32(30, 41, 59, 255));
            var glass = Look.Glow(new Color(0.75f, 0.9f, 1f, 0.32f));
            Look.Part("shadow", tr, Look.GridQuad(1, 8), shadowMat, new Vector3(0, 0.015f, len / 2f), new Vector3(W + 0.8f, len + 0.8f, 1), new Vector3(90, 0, 0));
            // the base and the back wall in the team colour, a white band
            Look.Part("base", tr, Look.LongCube(), teamMat, new Vector3(0, 0.3f, len / 2f), new Vector3(W, 0.6f, len));
            Look.Part("band", tr, Look.LongCube(), white, new Vector3(0, 0.62f, len / 2f), new Vector3(W + 0.02f, 0.06f, len));
            Look.Part("back", tr, Look.LongCube(), teamMat, new Vector3(0, H / 2, len / 2f), new Vector3(0.5f, H, len - 0.2f));
            // two rows of seats facing out on each side, pale against the team colour (quiet: the roof is what matters)
            var seat = Look.Mat(new Color32(226, 232, 240, 255), null, 0.15f, 0.2f);
            for (float z = 0.8f; z < len - 0.6f; z += 1.1f)
                foreach (int sd in new[] { -1, 1 })
                {
                    Look.Part("seat", tr, PrimitiveType.Cube, seat, new Vector3(sd * 0.55f, 0.82f, z), new Vector3(0.5f, 0.12f, 0.6f));
                    Look.Part("rest", tr, PrimitiveType.Cube, seat, new Vector3(sd * 0.32f, 1.15f, z), new Vector3(0.08f, 0.55f, 0.6f));
                }
            // clear side panels and the glass end; dark frame posts
            foreach (int sd in new[] { -1, 1 })
                Look.Part("glass", tr, Look.GridQuad(8, 1), glass, new Vector3(sd * (W / 2), 1.55f, len / 2f), new Vector3(len, 1.9f, 1), new Vector3(0, -90 * sd, 0));
            Look.Part("end", tr, PrimitiveType.Quad, glass, new Vector3(0, 1.55f, -0.01f), new Vector3(W, 1.9f, 1));
            for (float z = 0; z <= len + 0.01f; z += len / Mathf.Max(1, Mathf.Round(len / 6)))
                foreach (int sd in new[] { -1, 1 })
                    Look.Part("post", tr, PrimitiveType.Cube, frame, new Vector3(sd * (W / 2 - 0.04f), 1.55f, Mathf.Clamp(z, 0.05f, len - 0.05f)), new Vector3(0.1f, 1.9f, 0.1f));
            // the roof you run on: team colour with white edges and a white stripe down the middle
            Look.Part("roof", tr, Look.LongCube(), teamMat, new Vector3(0, H - 0.09f, len / 2f), new Vector3(W + 0.1f, 0.18f, len + 0.1f));
            foreach (int sd in new[] { -1, 1 }) Look.Part("edge", tr, Look.LongCube(), white, new Vector3(sd * (W / 2 + 0.02f), H - 0.06f, len / 2f), new Vector3(0.12f, 0.16f, len + 0.12f));
            Look.Part("stripe", tr, Look.LongCube(), white, new Vector3(0, H + 0.005f, len / 2f), new Vector3(0.3f, 0.02f, len - 0.4f));
            Look.Part("front", tr, PrimitiveType.Cube, white, new Vector3(0, H - 0.06f, -0.02f), new Vector3(W + 0.12f, 0.16f, 0.12f));
            return t;
        }

        /// <summary>The groundsman's ride-on mower driving at the runner: a roller in front, a canopy roof (a floor at
        /// ROOF_H), a flashing beacon and headlights so it is seen from far.</summary>
        Thing MakeMower(int kind, int len)
        {
            var t = new Thing { kind = kind, go = new GameObject("mower") };
            var tr = t.go.transform;
            tr.SetParent(world, false);
            const float W = 2.1f, H = RunState.ROOF_H;
            var body = Look.Mat(new Color32(234, 88, 12, 255), null, 0.1f, 0.35f);
            var white = Look.Mat(new Color32(248, 250, 252, 255), null, 0.15f, 0.2f);
            var dark = Look.Mat(new Color32(30, 34, 44, 255));
            Look.Part("shadow", tr, Look.GridQuad(1, 4), shadowMat, new Vector3(0, 0.015f, len / 2f), new Vector3(W + 0.8f, len + 1.4f, 1), new Vector3(90, 0, 0));
            // the cutting roller across the front (it turns), the body, the seat with the groundsman
            var roller = Look.Pivot("roller", tr, new Vector3(0, 0.38f, 0.3f));
            Look.Part("drum", roller, PrimitiveType.Cylinder, Look.Mat(new Color32(148, 163, 184, 255), Look.Candy(new Color32(100, 116, 139, 255), new Color32(203, 213, 225, 255)), 0.1f, 0.4f), Vector3.zero, new Vector3(0.7f, W / 2, 0.7f), new Vector3(0, 0, 90));
            Look.Part("hood", tr, PrimitiveType.Cube, body, new Vector3(0, 0.75f, 1.0f), new Vector3(W - 0.3f, 0.7f, 1.2f));
            Look.Part("deck", tr, PrimitiveType.Cube, body, new Vector3(0, 0.55f, len / 2f + 0.4f), new Vector3(W, 0.5f, len - 0.6f));
            Look.Part("stripe", tr, PrimitiveType.Cube, white, new Vector3(0, 0.82f, len / 2f + 0.4f), new Vector3(W + 0.02f, 0.08f, len - 0.6f));
            Look.Part("seat", tr, PrimitiveType.Cube, dark, new Vector3(0, 1.05f, len - 1.2f), new Vector3(0.7f, 0.2f, 0.6f));
            var driver = Look.Pivot("driver", tr, new Vector3(0, 0.45f, len - 1.3f));
            var dfig = new Figure(driver, new Color32(22, 163, 74, 255), new Color32(22, 163, 74, 255), new Color32(30, 41, 59, 255), new Color32(30, 41, 59, 255), Figure.Skins[2], Figure.Hairs[0]);
            dfig.Apply(Pose.Keeper, 0);
            foreach (int sd in new[] { -1, 1 })
                foreach (var wz in new[] { 1.2f, len - 0.9f })
                    Look.Part("wheel", tr, PrimitiveType.Cylinder, dark, new Vector3(sd * (W / 2 - 0.05f), 0.4f, wz), new Vector3(0.8f, 0.15f, 0.8f), new Vector3(0, 0, 90));
            // the canopy on four posts: its roof is a floor
            foreach (int sd in new[] { -1, 1 })
                foreach (var pz in new[] { 0.7f, len - 0.4f })
                    Look.Part("post", tr, PrimitiveType.Cube, dark, new Vector3(sd * (W / 2 - 0.12f), (H + 0.8f) / 2, pz), new Vector3(0.1f, H - 0.8f, 0.1f));
            Look.Part("canopy", tr, PrimitiveType.Cube, white, new Vector3(0, H - 0.08f, len / 2f + 0.1f), new Vector3(W + 0.1f, 0.16f, len + 0.2f));
            Look.Part("trim", tr, PrimitiveType.Cube, body, new Vector3(0, H - 0.2f, len / 2f + 0.1f), new Vector3(W + 0.14f, 0.08f, len + 0.24f));
            // the beacon (flashes in DrawBlocks) and the headlights
            var beacon = Look.Part("beacon", tr, PrimitiveType.Cylinder, Look.Mat(new Color32(251, 191, 36, 255), null, 1), new Vector3(0, H + 0.12f, len / 2f), new Vector3(0.3f, 0.12f, 0.3f)).transform;
            var flash = Look.Part("flash", tr, PrimitiveType.Quad, Look.Glow(new Color(1, 0.7f, 0.1f, 0.9f), blobTex, true), new Vector3(0, H + 0.2f, len / 2f - 0.3f), Vector3.one * 2.2f).transform;
            var lamp = Look.Mat(new Color32(255, 250, 225, 255), null, 1);
            foreach (int sd in new[] { -1, 1 })
            {
                Look.Part("lamp", tr, PrimitiveType.Cube, lamp, new Vector3(sd * 0.6f, 1.0f, 0.38f), new Vector3(0.32f, 0.2f, 0.05f));
                Look.Part("beam", tr, PrimitiveType.Quad, Look.Glow(new Color(1, 0.95f, 0.7f, 0.9f), blobTex, true), new Vector3(sd * 0.6f, 1.0f, 0.2f), Vector3.one * 1.4f);
            }
            Look.Part("pool", tr, Look.GridQuad(1, 4), Look.Glow(new Color(1, 0.95f, 0.75f, 0.35f), blobTex, true), new Vector3(0, 0.03f, -2.6f), new Vector3(2.6f, 5f, 1), new Vector3(90, 0, 0));
            t.parts = new[] { roller, beacon, flash };
            return t;
        }

        /// <summary>A sloped pitch-side board (the A-frame boards behind a goal) from the grass (z = 0) up to a roof
        /// (z = RAMP_LEN): big arrows on its face say "run up here".</summary>
        Thing MakeRamp()
        {
            var t = new Thing { kind = K_RAMP, go = new GameObject("ramp") };
            var tr = t.go.transform;
            tr.SetParent(world, false);
            float L = RunState.RAMP_LEN, H = RunState.ROOF_H;
            float len = Mathf.Sqrt(L * L + H * H), ang = Mathf.Atan2(H, L) * Mathf.Rad2Deg;
            var face = new Material(Look.Mat(Color.white, Look.Chevron(new Color32(241, 245, 249, 255), new Color32(30, 58, 138, 255)), 0.15f, 0.1f));
            face.mainTextureScale = new Vector2(1, 3.5f);
            var slab = Look.Pivot("slab", tr, Vector3.zero);
            slab.localRotation = Quaternion.Euler(-ang, 0, 0);
            Look.Part("face", slab, Look.LongCube(), face, new Vector3(0, -0.1f, len / 2), new Vector3(2.1f, 0.2f, len));
            var frame = Look.Mat(new Color32(248, 250, 252, 255), null, 0.15f);
            foreach (int sd in new[] { -1, 1 }) Look.Part("rail", slab, Look.LongCube(), frame, new Vector3(sd * 1.07f, 0.04f, len / 2), new Vector3(0.12f, 0.18f, len));
            // the A-frame's back legs, like the boards behind a goal
            var leg = Look.Mat(new Color32(71, 85, 105, 255));
            foreach (int sd in new[] { -1, 1 })
                foreach (var lz in new[] { L * 0.5f, L - 0.3f })
                {
                    float h = H * lz / L;
                    Look.Part("leg", tr, PrimitiveType.Cube, leg, new Vector3(sd * 0.95f, h / 2, lz), new Vector3(0.12f, h, 0.12f));
                }
            Look.Part("shadow", tr, Look.GridQuad(1, 4), shadowMat, new Vector3(0, 0.015f, L / 2), new Vector3(2.6f, L, 1), new Vector3(90, 0, 0));
            return t;
        }

        Thing GetBlock(int kind, int len)
        {
            if (pool.TryGetValue(kind, out var st) && st.Count > 0)
            {
                var t = st.Pop();
                t.go.SetActive(true);
                return t;
            }
            return kind == K_RAMP ? MakeRamp() : kind >= K_MOWER ? MakeMower(kind, len) : MakeDugout(kind, len);
        }

        void DrawBlocks(float time)
        {
            var s = S;
            foreach (var b in s.blocks)
            {
                int len = Mathf.RoundToInt(b.len);
                bool mower = b.v > 0;
                int kind = (mower ? K_MOWER : K_DUGOUT) + len;
                seen.Add(b.id);
                if (!live.TryGetValue(b.id, out var t)) live[b.id] = t = GetBlock(kind, len);
                t.go.transform.position = new Vector3(b.lane * LANE, 0, b.z);
                if (mower && t.parts != null)
                {
                    t.parts[0].localRotation = Quaternion.Euler(-time * 500, 0, 0);
                    bool on = Mathf.Repeat(time * 2.5f, 1) < 0.5f;
                    t.parts[2].gameObject.SetActive(on);
                }
                if (b.ramp)
                {
                    seen.Add(-b.id);
                    if (!live.TryGetValue(-b.id, out var r)) live[-b.id] = r = GetBlock(K_RAMP, 0);
                    r.go.transform.position = new Vector3(b.lane * LANE, 0, b.z - RunState.RAMP_LEN);
                }
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
                Look.Part("netBack", tr, Look.GridQuad(4, 1), net, new Vector3(0, H / 2, D), new Vector3(w * 2, H, 1)).GetComponent<Renderer>(),
                Look.Part("netTop", tr, Look.GridQuad(4, 2), net, new Vector3(0, H, D / 2), new Vector3(w * 2, D, 1), new Vector3(90, 0, 0)).GetComponent<Renderer>(),
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
