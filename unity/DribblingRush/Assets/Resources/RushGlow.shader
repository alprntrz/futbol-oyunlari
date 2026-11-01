// Unlit, alpha-blended and unlit-textured bits for Dribbling Rush: blob shadows, glows, particles, the far backdrop.
// Bends with the world (RushCurve.cginc) unless _Curve is 0.
Shader "Rush/Glow"
{
    Properties
    {
        _Color ("Color", Color) = (1,1,1,1)
        _MainTex ("Texture", 2D) = "white" {}
        [Enum(UnityEngine.Rendering.BlendMode)] _Src ("Src", Float) = 5
        [Enum(UnityEngine.Rendering.BlendMode)] _Dst ("Dst", Float) = 10
        [Enum(Off,0,On,1)] _ZWrite ("ZWrite", Float) = 0
        [Enum(UnityEngine.Rendering.CullMode)] _Cull ("Cull", Float) = 0
        _Fog ("Fog", Range(0,1)) = 1
        _Curve ("Curve", Range(0,1)) = 1
    }
    SubShader
    {
        Tags { "RenderType"="Transparent" "Queue"="Transparent" "IgnoreProjector"="True" }
        Pass
        {
            Blend [_Src] [_Dst]
            ZWrite [_ZWrite]
            Cull [_Cull]
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_fog
            #include "UnityCG.cginc"
            #include "RushCurve.cginc"

            sampler2D _MainTex;
            float4 _MainTex_ST;
            fixed4 _Color;
            half _Fog;
            half _Curve;

            struct v2f
            {
                float4 pos : SV_POSITION;
                float2 uv : TEXCOORD0;
                fixed4 color : COLOR;
                UNITY_FOG_COORDS(1)
            };

            v2f vert (appdata_full v)
            {
                v2f o;
                float4 wp = RushBend(mul(unity_ObjectToWorld, v.vertex), _Curve);
                o.pos = mul(UNITY_MATRIX_VP, wp);
                o.uv = TRANSFORM_TEX(v.texcoord, _MainTex);
                o.color = v.color * _Color;
                UNITY_TRANSFER_FOG(o, o.pos);
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                fixed4 c = tex2D(_MainTex, i.uv) * i.color;
                // how much of the fog to take (the far backdrop takes only a haze)
                fixed4 f = c;
                UNITY_APPLY_FOG(i.fogCoord, f);
                c.rgb = lerp(c.rgb, f.rgb, _Fog);
                return c;
            }
            ENDCG
        }
    }
}
