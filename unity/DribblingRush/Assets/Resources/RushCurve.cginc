// The world bends away under the horizon (Subway Surfers style): every vertex drops by the square of how far
// ahead of the camera it is. RushGame sets the globals each frame; a material can opt out with _Curve = 0 (the
// far backdrop). All three Rush shaders include this, so meshes, particles and text bend the same way.
#ifndef RUSH_CURVE
#define RUSH_CURVE
float _RushCamZ;
float _RushCurve;

float4 RushBend(float4 worldPos, float k)
{
    float d = max(0, worldPos.z - _RushCamZ);
    worldPos.y -= _RushCurve * d * d * k;
    return worldPos;
}
#endif
