import { UIManager } from "react-native";

/**
 * Whether this build has the Unity player (@azesmway/react-native-unity's RNUnityView). Expo Go and
 * builds made before Dribbling Rush went 3D don't; an OTA update can still reach those, so screens
 * that use Unity check this and fall back.
 */
export function hasUnity(): boolean {
  try {
    return !!UIManager.hasViewManagerConfig?.("RNUnityView");
  } catch {
    return false;
  }
}
