// Toy look for Dribbling Rush: soft wrapped diffuse, a cool sky fill from above, a thin rim light and fog, and the
// world curving away (RushCurve.cginc). Built-in render pipeline, forward base only (one directional light), no
// real-time shadows (blob shadows instead). GPU instancing: the many parts of the figures share meshes and materials.
Shader "Rush/Toon"
{
    Properties
    {
        _Color ("Color", Color) = (1,1,1,1)
        _MainTex ("Texture", 2D) = "white" {}
        _Emission ("Emission", Range(0,1)) = 0
        _Rim ("Rim", Range(0,1)) = 0.25
        _Curve ("Curve", Range(0,1)) = 1
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" "Queue"="Geometry" }
        Pass
        {
            Tags { "LightMode"="ForwardBase" }
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_fog
            #pragma multi_compile_instancing
            #include "UnityCG.cginc"
            #include "Lighting.cginc"
            #include "RushCurve.cginc"

            sampler2D _MainTex;
            float4 _MainTex_ST;
            fixed4 _Color;
            half _Emission;
            half _Rim;
            half _Curve;

            struct v2f
            {
                float4 pos : SV_POSITION;
                float2 uv : TEXCOORD0;
                half3 normal : TEXCOORD1;
                half3 view : TEXCOORD2;
                UNITY_FOG_COORDS(3)
            };

            v2f vert (appdata_base v)
            {
                v2f o;
                UNITY_SETUP_INSTANCE_ID(v);
                float4 wp = RushBend(mul(unity_ObjectToWorld, v.vertex), _Curve);
                o.pos = mul(UNITY_MATRIX_VP, wp);
                o.uv = TRANSFORM_TEX(v.texcoord, _MainTex);
                o.normal = UnityObjectToWorldNormal(v.normal);
                o.view = normalize(_WorldSpaceCameraPos - wp.xyz);
                UNITY_TRANSFER_FOG(o, o.pos);
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                fixed4 base = tex2D(_MainTex, i.uv) * _Color;
                half3 n = normalize(i.normal);
                // a little more shade than before, so shapes read as solid against the grass
                half wrap = saturate(dot(n, _WorldSpaceLightPos0.xyz) * 0.7 + 0.3);
                half sky = saturate(n.y * 0.5 + 0.5);
                half3 ambient = lerp(half3(0.36, 0.34, 0.33), half3(0.60, 0.68, 0.78), sky);
                half3 light = ambient + _LightColor0.rgb * wrap * 0.8;
                half rim = pow(1 - saturate(dot(n, normalize(i.view))), 3) * _Rim;
                half3 col = base.rgb * lerp(light, 1, _Emission) + rim;
                fixed4 c = fixed4(col, 1);
                UNITY_APPLY_FOG(i.fogCoord, c);
                return c;
            }
            ENDCG
        }
    }
}
