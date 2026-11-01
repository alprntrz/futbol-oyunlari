// Materials, procedural textures and meshes for Dribbling Rush. Everything is built in code: no imported
// models or textures, so the whole look lives in these few files (and nothing has a face, crest or logo).
using System.Collections.Generic;
using UnityEngine;

namespace Rush
{
    public static class Look
    {
        static Shader toon, glow;
        static readonly Dictionary<string, Material> mats = new Dictionary<string, Material>();
        static readonly Dictionary<PrimitiveType, Mesh> prims = new Dictionary<PrimitiveType, Mesh>();
        static Mesh cone, torus, disc;

        public static Shader Toon => toon ? toon : (toon = Resources.Load<Shader>("RushToon"));
        public static Shader GlowShader => glow ? glow : (glow = Resources.Load<Shader>("RushGlow"));

        public static Color Hex(string hex, Color fallback)
        {
            return ColorUtility.TryParseHtmlString(hex, out var c) ? c : fallback;
        }

        /// <summary>A shared lit material in this colour (cached by colour, texture and emission).</summary>
        public static Material Mat(Color c, Texture tex = null, float emission = 0, float rim = 0.25f)
        {
            string key = ColorUtility.ToHtmlStringRGBA(c) + (tex ? tex.GetHashCode().ToString() : "") + emission + "/" + rim;
            if (mats.TryGetValue(key, out var m) && m) return m;
            m = new Material(Toon) { color = c, enableInstancing = true };
            if (tex) m.mainTexture = tex;
            m.SetFloat("_Emission", emission);
            m.SetFloat("_Rim", rim);
            mats[key] = m;
            return m;
        }

        static Material textMat;
        static Font textFont;

        /// <summary>The material for TextMesh text: the font's atlas through the curved text shader (one for all; the
        /// atlas is taken again whenever the font rebuilds it).</summary>
        public static Material TextMat(Font font)
        {
            if (textMat && textFont == font) return textMat;
            textFont = font;
            textMat = new Material(Resources.Load<Shader>("RushText")) { mainTexture = font.material.mainTexture };
            Font.textureRebuilt += f =>
            {
                if (f == textFont && textMat) textMat.mainTexture = f.material.mainTexture;
            };
            return textMat;
        }

        /// <summary>An unlit transparent material: alpha blend, or additive for glows.</summary>
        public static Material Glow(Color c, Texture tex = null, bool additive = false, bool zwrite = false)
        {
            var m = new Material(GlowShader) { color = c };
            if (tex) m.mainTexture = tex;
            m.SetFloat("_Src", (float)UnityEngine.Rendering.BlendMode.SrcAlpha);
            m.SetFloat("_Dst", (float)(additive ? UnityEngine.Rendering.BlendMode.One : UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha));
            m.SetFloat("_ZWrite", zwrite ? 1 : 0);
            return m;
        }

        public static Mesh Prim(PrimitiveType t)
        {
            if (prims.TryGetValue(t, out var m) && m) return m;
            // Unity's own mesh, straight from its built-in resources: CreatePrimitive would also add a collider, and the
            // builds strip physics out, so each one logged "Can't add component … Collider doesn't exist"
            m = Resources.GetBuiltinResource<Mesh>(t + ".fbx");
            if (!m)
            {
                var go = GameObject.CreatePrimitive(t);
                m = go.GetComponent<MeshFilter>().sharedMesh;
                if (Application.isPlaying) Object.Destroy(go);
                else Object.DestroyImmediate(go);
            }
            prims[t] = m;
            return m;
        }

        /// <summary>A child object with a mesh and material (no collider: the rules do the collisions).</summary>
        public static GameObject Part(string name, Transform parent, Mesh mesh, Material mat, Vector3 pos, Vector3 scale, Vector3 euler = default)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localScale = scale;
            go.transform.localRotation = Quaternion.Euler(euler);
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            var r = go.AddComponent<MeshRenderer>();
            r.sharedMaterial = mat;
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            r.receiveShadows = false;
            r.lightProbeUsage = UnityEngine.Rendering.LightProbeUsage.Off;
            r.reflectionProbeUsage = UnityEngine.Rendering.ReflectionProbeUsage.Off;
            return go;
        }

        public static GameObject Part(string name, Transform parent, PrimitiveType t, Material mat, Vector3 pos, Vector3 scale, Vector3 euler = default) =>
            Part(name, parent, Prim(t), mat, pos, scale, euler);

        public static Transform Pivot(string name, Transform parent, Vector3 pos)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            return go.transform;
        }

        /// <summary>A picture from Assets/Resources/Art (made from the ChatGPT brief, docs/design/kosu-3d-brief.md),
        /// or null when it isn't there yet and the code-drawn one is used.</summary>
        public static Texture2D Art(string name)
        {
            var t = Resources.Load<Texture2D>("Art/" + name);
            return t != null ? t : null;
        }

        // ---------- meshes ----------

        /// <summary>A cone, 1 high, base radius 0.5 at y = 0.</summary>
        public static Mesh Cone()
        {
            if (cone) return cone;
            const int n = 20;
            var v = new List<Vector3>();
            var nr = new List<Vector3>();
            var tri = new List<int>();
            for (int i = 0; i < n; i++)
            {
                float a0 = i * Mathf.PI * 2 / n, a1 = (i + 1) * Mathf.PI * 2 / n;
                var p0 = new Vector3(Mathf.Cos(a0) * 0.5f, 0, Mathf.Sin(a0) * 0.5f);
                var p1 = new Vector3(Mathf.Cos(a1) * 0.5f, 0, Mathf.Sin(a1) * 0.5f);
                var top = new Vector3(0, 1, 0);
                int b = v.Count;
                v.Add(p0); v.Add(top); v.Add(p1);
                var nn = Vector3.Cross(top - p0, p1 - p0).normalized;
                if (nn.y < 0) nn = -nn;
                var n0 = new Vector3(p0.x, 0.5f, p0.z).normalized;
                var n1 = new Vector3(p1.x, 0.5f, p1.z).normalized;
                nr.Add(n0); nr.Add((n0 + n1).normalized); nr.Add(n1);
                tri.Add(b); tri.Add(b + 1); tri.Add(b + 2);
            }
            cone = new Mesh { name = "cone" };
            cone.SetVertices(v);
            cone.SetNormals(nr);
            cone.SetTriangles(tri, 0);
            cone.RecalculateBounds();
            return cone;
        }

        /// <summary>A torus in the XY plane, radius 0.5, tube 0.12.</summary>
        public static Mesh Torus()
        {
            if (torus) return torus;
            const int seg = 28, side = 10;
            const float R = 0.5f, r = 0.12f;
            var v = new List<Vector3>();
            var nr = new List<Vector3>();
            var tri = new List<int>();
            for (int i = 0; i <= seg; i++)
            {
                float a = i * Mathf.PI * 2 / seg;
                var c = new Vector3(Mathf.Cos(a), Mathf.Sin(a), 0);
                for (int j = 0; j <= side; j++)
                {
                    float b = j * Mathf.PI * 2 / side;
                    var n = c * Mathf.Cos(b) + Vector3.forward * Mathf.Sin(b);
                    v.Add(c * R + n * r);
                    nr.Add(n);
                }
            }
            for (int i = 0; i < seg; i++)
                for (int j = 0; j < side; j++)
                {
                    int a = i * (side + 1) + j, b = a + side + 1;
                    tri.Add(a); tri.Add(b); tri.Add(a + 1);
                    tri.Add(a + 1); tri.Add(b); tri.Add(b + 1);
                }
            torus = new Mesh { name = "torus" };
            torus.SetVertices(v);
            torus.SetNormals(nr);
            torus.SetTriangles(tri, 0);
            torus.RecalculateBounds();
            return torus;
        }

        /// <summary>A flat disc facing +Y, radius 0.5, UVs across it.</summary>
        public static Mesh Disc()
        {
            if (disc) return disc;
            const int n = 24;
            var v = new List<Vector3> { Vector3.zero };
            var uv = new List<Vector2> { new Vector2(0.5f, 0.5f) };
            var tri = new List<int>();
            for (int i = 0; i <= n; i++)
            {
                float a = i * Mathf.PI * 2 / n;
                v.Add(new Vector3(Mathf.Cos(a) * 0.5f, 0, Mathf.Sin(a) * 0.5f));
                uv.Add(new Vector2(Mathf.Cos(a) * 0.5f + 0.5f, Mathf.Sin(a) * 0.5f + 0.5f));
                if (i > 0) { tri.Add(0); tri.Add(i + 1); tri.Add(i); }
            }
            disc = new Mesh { name = "disc" };
            disc.SetVertices(v);
            disc.SetUVs(0, uv);
            var nr = new List<Vector3>();
            foreach (var _ in v) nr.Add(Vector3.up);
            disc.SetNormals(nr);
            disc.SetTriangles(tri, 0);
            disc.RecalculateBounds();
            return disc;
        }

        /// <summary>A quad lying on the ground (facing up), 1 × 1, centred, cut into strips along z so it bends with
        /// the world (the curve is per vertex).</summary>
        public static Mesh GroundQuad(int segs = 96)
        {
            var m = new Mesh { name = "ground" };
            var v = new Vector3[(segs + 1) * 2];
            var uv = new Vector2[v.Length];
            var nr = new Vector3[v.Length];
            var tri = new int[segs * 6];
            for (int i = 0; i <= segs; i++)
            {
                float t = (float)i / segs;
                v[i * 2] = new Vector3(-0.5f, 0, t - 0.5f);
                v[i * 2 + 1] = new Vector3(0.5f, 0, t - 0.5f);
                uv[i * 2] = new Vector2(0, t);
                uv[i * 2 + 1] = new Vector2(1, t);
                nr[i * 2] = nr[i * 2 + 1] = Vector3.up;
                if (i == segs) continue;
                int b = i * 2, o = i * 6;
                tri[o] = b; tri[o + 1] = b + 2; tri[o + 2] = b + 1;
                tri[o + 3] = b + 1; tri[o + 4] = b + 2; tri[o + 5] = b + 3;
            }
            m.vertices = v;
            m.uv = uv;
            m.normals = nr;
            m.triangles = tri;
            m.RecalculateBounds();
            return m;
        }

        static Mesh longCube;
        static readonly Dictionary<int, Mesh> gridQuads = new Dictionary<int, Mesh>();

        /// <summary>Unity's cube (1 × 1 × 1, centred) with its long sides cut into segments along z: for anything long
        /// (stands, dugouts, boards), so it bends with the world instead of bridging the curve.</summary>
        public static Mesh LongCube()
        {
            if (longCube) return longCube;
            const int segs = 8;
            var v = new List<Vector3>();
            var nr = new List<Vector3>();
            var uv = new List<Vector2>();
            var tri = new List<int>();
            // the four long faces: a strip each
            foreach (var (n, right) in new[] { (Vector3.up, Vector3.right), (Vector3.down, Vector3.left), (Vector3.right, Vector3.down), (Vector3.left, Vector3.up) })
            {
                int b = v.Count;
                for (int i = 0; i <= segs; i++)
                {
                    float t = (float)i / segs - 0.5f;
                    v.Add(n * 0.5f - right * 0.5f + Vector3.forward * t);
                    v.Add(n * 0.5f + right * 0.5f + Vector3.forward * t);
                    nr.Add(n); nr.Add(n);
                    uv.Add(new Vector2(0, t + 0.5f)); uv.Add(new Vector2(1, t + 0.5f));
                    if (i == segs) continue;
                    int a = b + i * 2;
                    tri.Add(a); tri.Add(a + 1); tri.Add(a + 2);
                    tri.Add(a + 1); tri.Add(a + 3); tri.Add(a + 2);
                }
            }
            // the two ends
            foreach (var (n, right, up) in new[] { (Vector3.forward, Vector3.left, Vector3.up), (Vector3.back, Vector3.right, Vector3.up) })
            {
                int b = v.Count;
                v.Add(n * 0.5f - right * 0.5f - up * 0.5f); v.Add(n * 0.5f + right * 0.5f - up * 0.5f);
                v.Add(n * 0.5f - right * 0.5f + up * 0.5f); v.Add(n * 0.5f + right * 0.5f + up * 0.5f);
                for (int i = 0; i < 4; i++) nr.Add(n);
                uv.Add(new Vector2(0, 0)); uv.Add(new Vector2(1, 0)); uv.Add(new Vector2(0, 1)); uv.Add(new Vector2(1, 1));
                tri.Add(b); tri.Add(b + 2); tri.Add(b + 1);
                tri.Add(b + 1); tri.Add(b + 2); tri.Add(b + 3);
            }
            longCube = new Mesh { name = "longCube" };
            longCube.SetVertices(v);
            longCube.SetNormals(nr);
            longCube.SetUVs(0, uv);
            longCube.SetTriangles(tri, 0);
            longCube.RecalculateBounds();
            FixWinding(longCube);
            return longCube;
        }

        /// <summary>Triangles wound so each face shows from the side its normal points to.</summary>
        static void FixWinding(Mesh m)
        {
            var v = m.vertices;
            var n = m.normals;
            var t = m.triangles;
            for (int i = 0; i < t.Length; i += 3)
            {
                var face = Vector3.Cross(v[t[i + 1]] - v[t[i]], v[t[i + 2]] - v[t[i]]);
                if (Vector3.Dot(face, n[t[i]]) < 0) (t[i + 1], t[i + 2]) = (t[i + 2], t[i + 1]);
            }
            m.triangles = t;
        }

        /// <summary>Unity's quad (1 × 1 in XY, centred, seen from -z) cut into nx × ny cells, for long panels that bend.</summary>
        public static Mesh GridQuad(int nx, int ny)
        {
            int key = nx * 100 + ny;
            if (gridQuads.TryGetValue(key, out var g) && g) return g;
            var v = new List<Vector3>();
            var nr = new List<Vector3>();
            var uv = new List<Vector2>();
            var tri = new List<int>();
            for (int j = 0; j <= ny; j++)
                for (int i = 0; i <= nx; i++)
                {
                    float u = (float)i / nx, w = (float)j / ny;
                    v.Add(new Vector3(u - 0.5f, w - 0.5f, 0));
                    nr.Add(Vector3.back);
                    uv.Add(new Vector2(u, w));
                    if (i == nx || j == ny) continue;
                    int a = j * (nx + 1) + i, b = a + nx + 1;
                    tri.Add(a); tri.Add(b); tri.Add(a + 1);
                    tri.Add(a + 1); tri.Add(b); tri.Add(b + 1);
                }
            g = new Mesh { name = "grid" + key };
            g.SetVertices(v);
            g.SetNormals(nr);
            g.SetUVs(0, uv);
            g.SetTriangles(tri, 0);
            g.RecalculateBounds();
            gridQuads[key] = g;
            return g;
        }

        // a 5 × 7 block font, A–Z: seven rows of five, top row first, "|" between the rows
        static readonly string[] Glyphs =
        {
            " ### |#   #|#   #|#####|#   #|#   #|#   #", // A
            "#### |#   #|#   #|#### |#   #|#   #|#### ", // B
            " ####|#    |#    |#    |#    |#    | ####", // C
            "#### |#   #|#   #|#   #|#   #|#   #|#### ", // D
            "#####|#    |#    |#### |#    |#    |#####", // E
            "#####|#    |#    |#### |#    |#    |#    ", // F
            " ####|#    |#    |#  ##|#   #|#   #| ####", // G
            "#   #|#   #|#   #|#####|#   #|#   #|#   #", // H
            "#####|  #  |  #  |  #  |  #  |  #  |#####", // I
            "    #|    #|    #|    #|#   #|#   #| ### ", // J
            "#   #|#  # |# #  |##   |# #  |#  # |#   #", // K
            "#    |#    |#    |#    |#    |#    |#####", // L
            "#   #|## ##|# # #|# # #|#   #|#   #|#   #", // M
            "#   #|##  #|# # #|#  ##|#   #|#   #|#   #", // N
            " ### |#   #|#   #|#   #|#   #|#   #| ### ", // O
            "#### |#   #|#   #|#### |#    |#    |#    ", // P
            " ### |#   #|#   #|#   #|# # #|#  # | ## #", // Q
            "#### |#   #|#   #|#### |# #  |#  # |#   #", // R
            " ####|#    |#    | ### |    #|    #|#### ", // S
            "#####|  #  |  #  |  #  |  #  |  #  |  #  ", // T
            "#   #|#   #|#   #|#   #|#   #|#   #| ### ", // U
            "#   #|#   #|#   #|#   #|#   #| # # |  #  ", // V
            "#   #|#   #|#   #|# # #|# # #|## ##|#   #", // W
            "#   #|#   #| # # |  #  | # # |#   #|#   #", // X
            "#   #|#   #| # # |  #  |  #  |  #  |  #  ", // Y
            "#####|    #|   # |  #  | #   |#    |#####", // Z
        };

        static readonly Dictionary<char, Mesh> letters = new Dictionary<char, Mesh>();

        /// <summary>A chunky 3D block letter (A–Z), 1 high, 5/7 wide, 1 deep (scale to taste), centred; '?' for others.</summary>
        public static Mesh BlockLetter(char ch)
        {
            if (letters.TryGetValue(ch, out var m) && m) return m;
            int gi = ch >= 'A' && ch <= 'Z' ? ch - 'A' : -1;
            string[] g = (gi >= 0 ? Glyphs[gi] : " ### |#   #|    #|   # |  #  |     |  #  ").Split('|');
            var v = new List<Vector3>();
            var nr = new List<Vector3>();
            var tri = new List<int>();
            const float cell = 1f / 7, grow = 1.42f;
            for (int row = 0; row < 7; row++)
                for (int col = 0; col < 5; col++)
                {
                    if (g[row][col] != '#') continue;
                    var c = new Vector3((col - 2) * cell, (3 - row) * cell, 0);
                    AddBox(v, nr, tri, c, new Vector3(cell * grow, cell * grow, 1));
                }
            m = new Mesh { name = "letter" + ch };
            m.SetVertices(v);
            m.SetNormals(nr);
            m.SetTriangles(tri, 0);
            m.RecalculateBounds();
            FixWinding(m);
            letters[ch] = m;
            return m;
        }

        static void AddBox(List<Vector3> v, List<Vector3> nr, List<int> tri, Vector3 c, Vector3 size)
        {
            var h = size * 0.5f;
            foreach (var (n, right, up) in new[]
            {
                (Vector3.up, Vector3.right, Vector3.forward), (Vector3.down, Vector3.right, Vector3.back),
                (Vector3.right, Vector3.back, Vector3.up), (Vector3.left, Vector3.forward, Vector3.up),
                (Vector3.forward, Vector3.left, Vector3.up), (Vector3.back, Vector3.right, Vector3.up),
            })
            {
                int b = v.Count;
                var o = c + Vector3.Scale(n, h);
                var r = Vector3.Scale(right, h);
                var u = Vector3.Scale(up, h);
                v.Add(o - r - u); v.Add(o + r - u); v.Add(o - r + u); v.Add(o + r + u);
                for (int i = 0; i < 4; i++) nr.Add(n);
                tri.Add(b); tri.Add(b + 2); tri.Add(b + 1);
                tri.Add(b + 1); tri.Add(b + 2); tri.Add(b + 3);
            }
        }

        // ---------- textures ----------

        static Texture2D NewTex(int w, int h, bool mips = true)
        {
            return new Texture2D(w, h, TextureFormat.RGBA32, mips) { wrapMode = TextureWrapMode.Repeat, filterMode = FilterMode.Trilinear, anisoLevel = 8 };
        }

        /// <summary>the pitch tile's length in metres (one goal line to the next: boxes at both ends, the halfway
        /// line and centre circle in the middle)</summary>
        public const float PITCH_TILE = 64f;

        /// <summary>The pitch: a quieter, deeper green than before so what stands on it reads at a glance; soft mowing
        /// stripes across, faint lane marks, and real markings scaled to the corridor (touchlines at ±half, the
        /// boxes, spots and arcs at both ends, halfway line and centre circle). One tile = 60 m × PITCH_TILE m.</summary>
        public static Texture2D Pitch(float lane, float half)
        {
            const int W = 1024, H = 1024;
            const float widthM = 60, lenM = PITCH_TILE;
            var tex = NewTex(W, H);
            var px = new Color32[W * H];
            var light = new Color32(62, 138, 64, 255);
            var dark = new Color32(54, 122, 56, 255);
            var outside = new Color32(44, 98, 50, 255);
            var white = new Color32(248, 250, 246, 255);
            var rnd = new System.Random(7);
            // the markings' half width and a soft edge, in metres
            const float w = 0.08f, soft = 0.06f;
            float Line(float d) => Mathf.Clamp01((w + soft - d) / soft);
            float Ring(float dx, float dz, float r) => Line(Mathf.Abs(Mathf.Sqrt(dx * dx + dz * dz) - r));
            float Spot(float dx, float dz, float r) => Mathf.Clamp01((r - Mathf.Sqrt(dx * dx + dz * dz)) / soft + 1);
            const float BOX_X = 3.4f, BOX_Z = 6.5f, GOAL_X = 1.8f, GOAL_Z = 2.2f, SPOT_Z = 4.4f, ARC_R = 3.2f, CIRCLE_R = 3.2f;
            for (int y = 0; y < H; y++)
            {
                float zm = (y + 0.5f) / H * lenM;
                bool stripe = Mathf.FloorToInt(zm / 4) % 2 == 0;
                // the near end's markings are mirrored at the far end
                float ze = zm < lenM / 2 ? zm : lenM - zm;
                for (int x = 0; x < W; x++)
                {
                    float xm = (x + 0.5f) / W * widthM - widthM / 2;
                    float ax = Mathf.Abs(xm);
                    Color32 c = ax > half + 0.25f ? outside : stripe ? light : dark;
                    int g = rnd.Next(-5, 6);
                    c = new Color32((byte)Mathf.Clamp(c.r + g, 0, 255), (byte)Mathf.Clamp(c.g + g, 0, 255), (byte)Mathf.Clamp(c.b + g, 0, 255), 255);
                    float m = 0;
                    if (ax < half + 0.5f)
                    {
                        m = Line(Mathf.Abs(ax - half));
                        // goal line, halfway line
                        m = Mathf.Max(m, Line(ze), Line(Mathf.Abs(zm - lenM / 2)));
                        // the penalty area and goal area
                        if (ze < BOX_Z + w) m = Mathf.Max(m, Line(Mathf.Abs(ax - BOX_X)));
                        if (ax < BOX_X + w) m = Mathf.Max(m, Line(Mathf.Abs(ze - BOX_Z)));
                        if (ze < GOAL_Z + w) m = Mathf.Max(m, Line(Mathf.Abs(ax - GOAL_X)));
                        if (ax < GOAL_X + w) m = Mathf.Max(m, Line(Mathf.Abs(ze - GOAL_Z)));
                        // the spot and the arc outside the box
                        m = Mathf.Max(m, Spot(xm, ze - SPOT_Z, 0.1f));
                        if (ze > BOX_Z) m = Mathf.Max(m, Ring(xm, ze - SPOT_Z, ARC_R));
                        // the centre circle and spot
                        m = Mathf.Max(m, Ring(xm, zm - lenM / 2, CIRCLE_R), Spot(xm, zm - lenM / 2, 0.1f));
                        // faint lane marks between the lanes (2 m dash, 4 m gap)
                        if (Mathf.Abs(ax - lane / 2) < 0.045f && (zm % 6) < 2) m = Mathf.Max(m, 0.22f);
                    }
                    if (m > 0) c = Color32.Lerp(c, white, m);
                    px[y * W + x] = c;
                }
            }
            tex.SetPixels32(px);
            tex.Apply(true);
            return tex;
        }

        /// <summary>A crowd: rows of little coloured heads and shirts on dark seats.</summary>
        public static Texture2D Crowd()
        {
            const int W = 512, H = 128;
            var tex = NewTex(W, H);
            var px = new Color32[W * H];
            var rnd = new System.Random(11);
            var seat = new Color32(52, 64, 88, 255);
            Color32[] shirts =
            {
                new Color32(229, 57, 53, 255), new Color32(255, 255, 255, 255), new Color32(255, 202, 40, 255),
                new Color32(30, 136, 229, 255), new Color32(67, 160, 71, 255), new Color32(255, 112, 67, 255),
                new Color32(142, 36, 170, 255), new Color32(236, 239, 241, 255),
            };
            for (int i = 0; i < px.Length; i++) px[i] = seat;
            for (int row = 0; row < 8; row++)
                for (int col = 0; col < 64; col++)
                {
                    if (rnd.NextDouble() < 0.12) continue;
                    var sh = shirts[rnd.Next(shirts.Length)];
                    var skin = rnd.NextDouble() < 0.5 ? new Color32(234, 192, 160, 255) : new Color32(160, 110, 80, 255);
                    int cx = col * 8 + 4 + rnd.Next(-1, 2), cy = row * 16 + 2;
                    for (int y = 0; y < 14; y++)
                        for (int x = -3; x <= 3; x++)
                        {
                            int X = cx + x, Y = cy + y;
                            if (X < 0 || X >= W || Y >= H) continue;
                            bool head = y >= 9 && x * x + (y - 11) * (y - 11) <= 5;
                            bool body = y < 9 && Mathf.Abs(x) <= 3 - (y < 2 ? 0 : 0);
                            if (head) px[Y * W + X] = skin;
                            else if (body) px[Y * W + X] = sh;
                        }
                }
            tex.SetPixels32(px);
            tex.Apply(true);
            return tex;
        }

        /// <summary>A soft round blob (white, alpha falls off to the edge): shadows and glows.</summary>
        public static Texture2D Blob()
        {
            const int S = 64;
            var tex = NewTex(S, S);
            tex.wrapMode = TextureWrapMode.Clamp;
            var px = new Color32[S * S];
            for (int y = 0; y < S; y++)
                for (int x = 0; x < S; x++)
                {
                    float dx = (x + 0.5f) / S * 2 - 1, dy = (y + 0.5f) / S * 2 - 1;
                    float a = Mathf.Clamp01(1 - Mathf.Sqrt(dx * dx + dy * dy));
                    a = a * a * (3 - 2 * a);
                    px[y * S + x] = new Color32(255, 255, 255, (byte)(a * 255));
                }
            tex.SetPixels32(px);
            tex.Apply(true);
            return tex;
        }

        /// <summary>A net: white mesh lines on transparent.</summary>
        public static Texture2D Net()
        {
            const int S = 64;
            var tex = NewTex(S, S);
            var px = new Color32[S * S];
            for (int y = 0; y < S; y++)
                for (int x = 0; x < S; x++)
                {
                    bool line = (x + y) % 16 < 2 || (x - y + 64) % 16 < 2;
                    px[y * S + x] = line ? new Color32(255, 255, 255, 230) : new Color32(255, 255, 255, 0);
                }
            tex.SetPixels32(px);
            tex.Apply(true);
            return tex;
        }

        /// <summary>A football: white with dark patches (UV-mapped onto Unity's sphere).</summary>
        public static Texture2D Ball()
        {
            const int W = 128, H = 64;
            var tex = NewTex(W, H);
            var px = new Color32[W * H];
            var spots = new List<Vector3>();
            // the 12 pentagon centres of an icosahedron
            float p = (1 + Mathf.Sqrt(5)) / 2;
            float[,] ico = { { 0, 1, p }, { 0, -1, p }, { 0, 1, -p }, { 0, -1, -p }, { 1, p, 0 }, { -1, p, 0 }, { 1, -p, 0 }, { -1, -p, 0 }, { p, 0, 1 }, { -p, 0, 1 }, { p, 0, -1 }, { -p, 0, -1 } };
            for (int i = 0; i < 12; i++) spots.Add(new Vector3(ico[i, 0], ico[i, 1], ico[i, 2]).normalized);
            for (int y = 0; y < H; y++)
                for (int x = 0; x < W; x++)
                {
                    float lon = (x + 0.5f) / W * Mathf.PI * 2, lat = ((y + 0.5f) / H - 0.5f) * Mathf.PI;
                    var d = new Vector3(Mathf.Cos(lat) * Mathf.Cos(lon), Mathf.Sin(lat), Mathf.Cos(lat) * Mathf.Sin(lon));
                    float best = 0;
                    foreach (var s in spots) best = Mathf.Max(best, Vector3.Dot(d, s));
                    px[y * W + x] = best > 0.93f ? new Color32(30, 34, 44, 255) : new Color32(250, 250, 250, 255);
                }
            tex.SetPixels32(px);
            tex.Apply(true);
            return tex;
        }

        /// <summary>An advertising board face: a colour with a lighter band (no brands, only our name now and then).</summary>
        public static Texture2D Stripe(Color a, Color b)
        {
            const int W = 64, H = 16;
            var tex = NewTex(W, H);
            var px = new Color32[W * H];
            for (int y = 0; y < H; y++)
                for (int x = 0; x < W; x++)
                    px[y * W + x] = (y > 5 && y < 10) ? b : a;
            tex.SetPixels32(px);
            tex.Apply(true);
            return tex;
        }

        /// <summary>A ramp's face: arrows pointing up the slope (two colours, repeats along it).</summary>
        public static Texture2D Chevron(Color a, Color b)
        {
            const int S = 64;
            var tex = NewTex(S, S);
            var px = new Color32[S * S];
            for (int y = 0; y < S; y++)
                for (int x = 0; x < S; x++)
                {
                    float u = Mathf.Abs((x + 0.5f) / S - 0.5f), v = (y + 0.5f) / S;
                    px[y * S + x] = Mathf.Repeat(v - u * 0.9f, 0.5f) < 0.25f ? a : b;
                }
            tex.SetPixels32(px);
            tex.Apply(true);
            return tex;
        }

        /// <summary>A bus's side windows: dark glass with a light sheen, pillars between (one window per tile).</summary>
        public static Texture2D Windows()
        {
            const int W = 64, H = 32;
            var tex = NewTex(W, H);
            var px = new Color32[W * H];
            var glass = new Color32(34, 48, 72, 255);
            var sheen = new Color32(120, 160, 200, 255);
            var pillar = new Color32(24, 28, 36, 255);
            for (int y = 0; y < H; y++)
                for (int x = 0; x < W; x++)
                {
                    Color32 c = x < 5 || y < 2 || y > H - 3 ? pillar : glass;
                    // a diagonal reflection across each pane
                    if (c.Equals(glass) && Mathf.Abs((x - 5) - (H - y) * 1.2f - 14) < 5) c = Color32.Lerp(glass, sheen, 0.55f);
                    px[y * W + x] = c;
                }
            tex.SetPixels32(px);
            tex.Apply(true);
            return tex;
        }

        /// <summary>A four-pointed sparkle (white, additive): the flash of a picked coin.</summary>
        public static Texture2D Star()
        {
            const int S = 64;
            var tex = NewTex(S, S);
            tex.wrapMode = TextureWrapMode.Clamp;
            var px = new Color32[S * S];
            for (int y = 0; y < S; y++)
                for (int x = 0; x < S; x++)
                {
                    float dx = Mathf.Abs((x + 0.5f) / S * 2 - 1), dy = Mathf.Abs((y + 0.5f) / S * 2 - 1);
                    float r = Mathf.Sqrt(dx * dx + dy * dy);
                    // thin spikes along the axes and a soft core
                    float spikes = Mathf.Max(Mathf.Clamp01(1 - dx * 9) * Mathf.Clamp01(1 - dy), Mathf.Clamp01(1 - dy * 9) * Mathf.Clamp01(1 - dx));
                    float a = Mathf.Clamp01(Mathf.Max(spikes, Mathf.Clamp01(1 - r * 2.6f)));
                    px[y * S + x] = new Color32(255, 255, 255, (byte)(a * a * 255));
                }
            tex.SetPixels32(px);
            tex.Apply(true);
            return tex;
        }

        /// <summary>Light rays out of a centre (white, additive): the burst of a power-up.</summary>
        public static Texture2D Rays()
        {
            const int S = 128;
            var tex = NewTex(S, S);
            tex.wrapMode = TextureWrapMode.Clamp;
            var px = new Color32[S * S];
            for (int y = 0; y < S; y++)
                for (int x = 0; x < S; x++)
                {
                    float dx = (x + 0.5f) / S * 2 - 1, dy = (y + 0.5f) / S * 2 - 1;
                    float r = Mathf.Sqrt(dx * dx + dy * dy);
                    float ang = Mathf.Atan2(dy, dx);
                    float ray = Mathf.Pow(Mathf.Abs(Mathf.Cos(ang * 6)), 8);
                    float a = Mathf.Clamp01(1 - r) * (ray * 0.85f + Mathf.Clamp01(1 - r * 3) * 0.9f);
                    px[y * S + x] = new Color32(255, 255, 255, (byte)(Mathf.Clamp01(a) * 255));
                }
            tex.SetPixels32(px);
            tex.Apply(true);
            return tex;
        }

        /// <summary>Diagonal two-colour stripes (a barber-pole bar, a roller): repeats along u.</summary>
        public static Texture2D Candy(Color a, Color b)
        {
            const int S = 32;
            var tex = NewTex(S, S);
            var px = new Color32[S * S];
            for (int y = 0; y < S; y++)
                for (int x = 0; x < S; x++)
                    px[y * S + x] = ((x + y) / 16) % 2 == 0 ? a : b;
            tex.SetPixels32(px);
            tex.Apply(true);
            return tex;
        }

        /// <summary>A soft vertical beam (white, brightest at the bottom and down the middle): a pillar of light over a letter.</summary>
        public static Texture2D Beam()
        {
            const int W = 32, H = 64;
            var tex = NewTex(W, H);
            tex.wrapMode = TextureWrapMode.Clamp;
            var px = new Color32[W * H];
            for (int y = 0; y < H; y++)
                for (int x = 0; x < W; x++)
                {
                    float u = Mathf.Abs((x + 0.5f) / W * 2 - 1), v = (y + 0.5f) / H;
                    float a = Mathf.Clamp01(1 - u * u) * Mathf.Clamp01(1 - v) * Mathf.Clamp01(1 - u);
                    px[y * W + x] = new Color32(255, 255, 255, (byte)(a * 255));
                }
            tex.SetPixels32(px);
            tex.Apply(true);
            return tex;
        }
    }
}
