// A chubby toy footballer built from primitives (no face: seen from behind or as a faceless figure), with
// procedural poses: run, jump, roll, fall, stand, tackle, wall, keeper. The kit takes any colours.
using UnityEngine;

namespace Rush
{
    public enum Pose { Idle, Run, Jump, Slide, Fall, Caught, Stand, Tackle, Wall, Ref, Keeper, Dive, Fly, Grab }

    public class Figure
    {
        public readonly Transform root;
        readonly Transform body, hipL, hipR, kneeL, kneeR, armL, armR, head;
        readonly Transform card;
        readonly Renderer[] renderers;
        public readonly TextMesh number;

        public static readonly Color[] Skins = { new Color32(236, 196, 160, 255), new Color32(198, 140, 100, 255), new Color32(140, 92, 62, 255), new Color32(246, 214, 182, 255) };
        public static readonly Color[] Hairs = { new Color32(52, 36, 28, 255), new Color32(24, 22, 22, 255), new Color32(150, 98, 52, 255), new Color32(214, 170, 90, 255) };

        public Figure(Transform parent, Color shirt, Color sleeves, Color shorts, Color socks, Color skin, Color hair, string num = null, bool gloves = false, bool refCard = false)
        {
            root = new GameObject("figure").transform;
            root.SetParent(parent, false);
            var mShirt = Look.Mat(shirt);
            var mSleeve = Look.Mat(sleeves);
            var mShorts = Look.Mat(shorts);
            var mSocks = Look.Mat(socks);
            var mSkin = Look.Mat(skin, null, 0, 0.12f);
            var mHair = Look.Mat(hair, null, 0, 0.1f);
            var mBoot = Look.Mat(new Color32(28, 30, 36, 255));
            var mGlove = Look.Mat(new Color32(255, 138, 30, 255));

            var cap = PrimitiveType.Capsule;
            var sph = PrimitiveType.Sphere;

            body = Look.Pivot("body", root, new Vector3(0, 0.86f, 0));
            // legs hang from the hips
            hipL = Look.Pivot("hipL", body, new Vector3(-0.13f, 0, 0));
            hipR = Look.Pivot("hipR", body, new Vector3(0.13f, 0, 0));
            foreach (var (hip, side) in new[] { (hipL, -1), (hipR, 1) })
            {
                Look.Part("thigh", hip, cap, mSkin, new Vector3(0, -0.2f, 0), new Vector3(0.2f, 0.22f, 0.2f));
                var knee = Look.Pivot("knee", hip, new Vector3(0, -0.4f, 0));
                Look.Part("sock", knee, cap, mSocks, new Vector3(0, -0.18f, 0), new Vector3(0.18f, 0.21f, 0.18f));
                Look.Part("boot", knee, PrimitiveType.Cube, mBoot, new Vector3(0, -0.4f, 0.05f), new Vector3(0.16f, 0.1f, 0.27f));
                if (side < 0) kneeL = knee; else kneeR = knee;
            }
            // shorts, shirt (a round torso), neck, head, hair
            Look.Part("shorts", body, PrimitiveType.Cylinder, mShorts, new Vector3(0, 0.0f, 0), new Vector3(0.5f, 0.14f, 0.34f));
            Look.Part("shirt", body, cap, mShirt, new Vector3(0, 0.32f, 0), new Vector3(0.52f, 0.34f, 0.36f));
            Look.Part("neck", body, PrimitiveType.Cylinder, mSkin, new Vector3(0, 0.68f, 0), new Vector3(0.14f, 0.06f, 0.14f));
            head = Look.Pivot("head", body, new Vector3(0, 0.88f, 0));
            Look.Part("skull", head, sph, mSkin, Vector3.zero, new Vector3(0.42f, 0.44f, 0.42f));
            Look.Part("hair", head, sph, mHair, new Vector3(0, 0.07f, -0.03f), new Vector3(0.45f, 0.36f, 0.44f));
            Look.Part("earL", head, sph, mSkin, new Vector3(-0.2f, 0, 0), new Vector3(0.07f, 0.1f, 0.06f));
            Look.Part("earR", head, sph, mSkin, new Vector3(0.2f, 0, 0), new Vector3(0.07f, 0.1f, 0.06f));
            // arms from the shoulders: sleeve, forearm, hand (or a keeper's glove)
            armL = Look.Pivot("armL", body, new Vector3(-0.3f, 0.55f, 0));
            armR = Look.Pivot("armR", body, new Vector3(0.3f, 0.55f, 0));
            foreach (var arm in new[] { armL, armR })
            {
                Look.Part("sleeve", arm, cap, mSleeve, new Vector3(0, -0.1f, 0), new Vector3(0.18f, 0.13f, 0.18f));
                Look.Part("forearm", arm, cap, mSkin, new Vector3(0, -0.3f, 0), new Vector3(0.13f, 0.16f, 0.13f));
                Look.Part("hand", arm, sph, gloves ? mGlove : mSkin, new Vector3(0, -0.47f, 0), gloves ? new Vector3(0.19f, 0.19f, 0.12f) : new Vector3(0.13f, 0.13f, 0.13f));
            }
            if (refCard)
            {
                card = Look.Part("card", armR, PrimitiveType.Cube, Look.Mat(new Color32(250, 204, 21, 255), null, 0.5f), new Vector3(0, -0.6f, 0.04f), new Vector3(0.14f, 0.2f, 0.02f)).transform;
            }
            if (!string.IsNullOrEmpty(num))
            {
                var t = new GameObject("number");
                t.transform.SetParent(body, false);
                t.transform.localPosition = new Vector3(0, 0.36f, -0.185f);
                number = t.AddComponent<TextMesh>();
                number.text = num;
                number.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
                number.fontSize = 64;
                number.characterSize = 0.022f;
                number.anchor = TextAnchor.MiddleCenter;
                number.alignment = TextAlignment.Center;
                number.fontStyle = FontStyle.Bold;
                float lum = shirt.r * 0.3f + shirt.g * 0.59f + shirt.b * 0.11f;
                number.color = lum > 0.6f ? new Color32(20, 24, 32, 255) : Color.white;
                var mr = t.GetComponent<MeshRenderer>();
                mr.sharedMaterial = Look.TextMat(number.font);
            }
            renderers = root.GetComponentsInChildren<Renderer>(true);
        }

        public void SetVisible(bool on)
        {
            foreach (var r in renderers) r.enabled = on;
        }

        static Quaternion X(float a) => Quaternion.Euler(-a, 0, 0);

        /// <summary>Set the pose. ph = run cycle phase (radians), k = 0..1 progress for one-off moves (fall, dive).</summary>
        public void Apply(Pose pose, float ph, float k = 0, float side = 1)
        {
            float s = Mathf.Sin(ph);
            Vector3 bodyPos = new Vector3(0, 0.86f, 0);
            Quaternion bodyRot = Quaternion.identity, rootRot = Quaternion.identity;
            Vector3 rootPos = Vector3.zero;
            float hl = 0, hr = 0, kl = 0, kr = 0;
            Quaternion al = Quaternion.Euler(0, 0, -6), ar = Quaternion.Euler(0, 0, 6);
            switch (pose)
            {
                case Pose.Idle:
                    bodyPos.y += Mathf.Sin(ph * 0.5f) * 0.01f;
                    kl = kr = 6;
                    break;
                case Pose.Run:
                    hl = s * 42; hr = -s * 42;
                    kl = 18 + 58 * Mathf.Max(0, -Mathf.Cos(ph));
                    kr = 18 + 58 * Mathf.Max(0, Mathf.Cos(ph));
                    al = X(-s * 48) * Quaternion.Euler(0, 0, -10);
                    ar = X(s * 48) * Quaternion.Euler(0, 0, 10);
                    bodyPos.y += Mathf.Abs(Mathf.Cos(ph)) * 0.07f - 0.03f;
                    bodyRot = Quaternion.Euler(10, s * 6, 0);
                    break;
                case Pose.Jump:
                    hl = 75; kl = 95; hr = 20; kr = 50;
                    al = X(150) * Quaternion.Euler(0, 0, -20);
                    ar = X(120) * Quaternion.Euler(0, 0, 25);
                    bodyRot = Quaternion.Euler(6, 0, 0);
                    break;
                case Pose.Slide:
                    // a roll under the board: lean right back, feet first along the grass
                    rootPos = new Vector3(0, -0.5f, 0);
                    bodyRot = Quaternion.Euler(-68, 0, 0);
                    hl = 72; kl = 6; hr = 60; kr = 30;
                    al = Quaternion.Euler(-20, 0, -70);
                    ar = Quaternion.Euler(-20, 0, 70);
                    break;
                case Pose.Fall:
                    rootRot = Quaternion.Euler(Mathf.Lerp(0, 82, Ease(k)), 0, 0);
                    hl = 20; hr = -10; kl = 30; kr = 10;
                    al = X(140) * Quaternion.Euler(0, 0, -30);
                    ar = X(140) * Quaternion.Euler(0, 0, 30);
                    break;
                case Pose.Caught:
                    rootRot = Quaternion.Euler(Mathf.Lerp(0, 25, Ease(k)), 0, Mathf.Lerp(0, 70 * side, Ease(k)));
                    hl = 30; kl = 40;
                    al = X(90); ar = X(60);
                    break;
                case Pose.Stand:
                    // arms out, knees soft, a little sway: "you shall not pass"
                    kl = kr = 14;
                    bodyRot = Quaternion.Euler(8, 0, Mathf.Sin(ph) * 3);
                    hl = 8; hr = 8;
                    al = Quaternion.Euler(0, 0, -62 + Mathf.Sin(ph * 2) * 6);
                    ar = Quaternion.Euler(0, 0, 62 - Mathf.Sin(ph * 2) * 6);
                    break;
                case Pose.Tackle:
                    // lying on his side across the lane, one leg stretched out at the ball
                    rootRot = Quaternion.Euler(0, 90 * side, 78 * side);
                    rootPos = new Vector3(0, 0.22f, 0);
                    hl = 85; kl = 0; hr = 30; kr = 60;
                    al = Quaternion.Euler(0, 0, -100); ar = X(30);
                    break;
                case Pose.Wall:
                    // a free-kick wall: hands together in front, hopping as you come
                    kl = kr = 10;
                    al = Quaternion.Euler(-35, 0, 28); ar = Quaternion.Euler(-35, 0, -28);
                    rootPos = new Vector3(0, Mathf.Max(0, Mathf.Sin(ph)) * 0.18f * k, 0);
                    break;
                case Pose.Ref:
                    kl = kr = 6;
                    al = Quaternion.Euler(0, 0, -8);
                    ar = X(170 + Mathf.Sin(ph * 2) * 6);
                    break;
                case Pose.Keeper:
                    kl = kr = 32; hl = hr = 22;
                    bodyRot = Quaternion.Euler(18, 0, 0);
                    bodyPos.y -= 0.12f;
                    al = Quaternion.Euler(-30, 0, -55 + Mathf.Sin(ph) * 5);
                    ar = Quaternion.Euler(-30, 0, 55 - Mathf.Sin(ph) * 5);
                    break;
                case Pose.Fly:
                    // the jet: leaning into the wind, legs trailing, arms out like wings
                    bodyRot = Quaternion.Euler(28, 0, Mathf.Sin(ph * 0.7f) * 6);
                    hl = -14 + s * 8; hr = -6 - s * 8; kl = 40; kr = 30;
                    al = Quaternion.Euler(-10, 0, -78 + Mathf.Sin(ph) * 6);
                    ar = Quaternion.Euler(-10, 0, 78 - Mathf.Sin(ph) * 6);
                    break;
                case Pose.Grab:
                    // the steward reaching for the runner's shoulders
                    bodyRot = Quaternion.Euler(22, 0, 0);
                    hl = 30; kl = 40; hr = -10; kr = 20;
                    al = X(100) * Quaternion.Euler(0, 0, 12);
                    ar = X(100) * Quaternion.Euler(0, 0, -12);
                    break;
                case Pose.Dive:
                    float e = Ease(k);
                    rootRot = Quaternion.Euler(0, 0, -78 * side * e);
                    rootPos = new Vector3(side * 0.4f * e, 0.3f * Mathf.Sin(e * Mathf.PI) + 0.2f * e, 0);
                    al = Quaternion.Euler(0, 0, side > 0 ? -170 : -40); ar = Quaternion.Euler(0, 0, side > 0 ? 40 : 170);
                    hl = 10; hr = -10;
                    break;
            }
            root.localPosition = rootPos;
            root.localRotation = rootRot;
            body.localPosition = bodyPos;
            body.localRotation = bodyRot;
            hipL.localRotation = X(hl);
            hipR.localRotation = X(hr);
            kneeL.localRotation = Quaternion.Euler(kl, 0, 0);
            kneeR.localRotation = Quaternion.Euler(kr, 0, 0);
            armL.localRotation = al;
            armR.localRotation = ar;
            head.localRotation = pose == Pose.Run ? Quaternion.Euler(-6, 0, 0) : Quaternion.identity;
            if (card) card.gameObject.SetActive(pose == Pose.Ref);
        }

        static float Ease(float k)
        {
            k = Mathf.Clamp01(k);
            return 1 - (1 - k) * (1 - k);
        }
    }
}
