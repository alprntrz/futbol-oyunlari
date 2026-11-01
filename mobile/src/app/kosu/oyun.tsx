import Rush2D from "~/components/kosu/Rush2D";
import Rush3D from "~/components/kosu/Rush3D";
import { hasUnity } from "~/lib/unity";

/**
 * Dribbling Rush: the 3D game (Unity, unity/DribblingRush) when this build carries the Unity player,
 * otherwise the 2.5D one (Expo Go, store builds made before the 3D version, an OTA update reaching them).
 */
export default function RushScreen() {
  return hasUnity() ? <Rush3D /> : <Rush2D />;
}
