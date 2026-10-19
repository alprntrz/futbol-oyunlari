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
            m = new Material(Toon) { color = c };
            if (tex) m.mainTexture = tex;
            m.SetFloat("_Emission", emission);
            m.SetFloat("_Rim", rim);
            mats[key] = m;
            return m;
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
            var go = GameObject.CreatePrimitive(t);
            m = go.GetComponent<MeshFilter>().sharedMesh;
            if (Application.isPlaying) Object.Destroy(go);
            else Object.DestroyImmediate(go);
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

        /// <summary>A quad lying on the ground (facing up), 1 × 1, centred.</summary>
        public static Mesh GroundQuad()
        {
            var m = new Mesh { name = "ground" };
            m.vertices = new[] { new Vector3(-0.5f, 0, -0.5f), new Vector3(0.5f, 0, -0.5f), new Vector3(-0.5f, 0, 0.5f), new Vector3(0.5f, 0, 0.5f) };
            m.uv = new[] { new Vector2(0, 0), new Vector2(1, 0), new Vector2(0, 1), new Vector2(1, 1) };
            m.normals = new[] { Vector3.up, Vector3.up, Vector3.up, Vector3.up };
            m.triangles = new[] { 0, 2, 1, 1, 2, 3 };
            m.RecalculateBounds();
            return m;
        }

        // ---------- textures ----------

        static Texture2D NewTex(int w, int h, bool mips = true)
        {
            return new Texture2D(w, h, TextureFormat.RGBA32, mips) { wrapMode = TextureWrapMode.Repeat, filterMode = FilterMode.Trilinear, anisoLevel = 8 };
        }

        /// <summary>The pitch: mowing stripes every 3 m along z, lane dashes and touchlines across 60 m of width,
        /// one tile = 60 m × 12 m (four stripes, two dashes per lane line).</summary>
        public static Texture2D Pitch(float lane, float half)
        {
            const int W = 1024, H = 256;
            const float widthM = 60, lenM = 12;
            var tex = NewTex(W, H);
            var px = new Color32[W * H];
            var light = new Color32(96, 186, 92, 255);
            var dark = new Color32(80, 170, 80, 255);
            var outside = new Color32(74, 156, 74, 255);
            var white = new Color32(245, 250, 245, 255);
            var rnd = new System.Random(7);
            for (int y = 0; y < H; y++)
            {
                float zm = (y + 0.5f) / H * lenM;
                bool stripe = Mathf.FloorToInt(zm / 3) % 2 == 0;
                for (int x = 0; x < W; x++)
                {
                    float xm = (x + 0.5f) / W * widthM - widthM / 2;
                    float ax = Mathf.Abs(xm);
                    Color32 c = ax > half + 0.6f ? outside : stripe ? light : dark;
                    // a little grain so it doesn't look like plastic
                    int g = rnd.Next(-6, 7);
                    c = new Color32((byte)Mathf.Clamp(c.r + g, 0, 255), (byte)Mathf.Clamp(c.g + g, 0, 255), (byte)Mathf.Clamp(c.b + g, 0, 255), 255);
                    // touchlines
                    if (Mathf.Abs(ax - half) < 0.07f) c = white;
                    // lane dashes between the lanes (2 m dash, 4 m gap)
                    if (Mathf.Abs(ax - lane / 2) < 0.05f && (zm % 6) < 2) c = Color32.Lerp(c, white, 0.75f);
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
    }
}
