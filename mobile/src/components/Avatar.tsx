import { Image, StyleSheet, View } from "react-native";

import { avatarById } from "~/lib/avatar";
import { useMyFrame, type FrameId } from "~/lib/cosmetics";
import { useMyPhoto } from "~/lib/photo";

import { FrameRing } from "./FrameRing";

/**
 * Round avatar: the preset character on its tinted circle. `me`: this phone's
 * own avatar, shown as the profile photo when the player picked one
 * (`photo`: a draft photo to preview instead) inside the frame its rank opened
 * (`frame` draws a given one instead, e.g. in the picker).
 */
export function Avatar({ me, photo, frame, ...props }: AvatarProps & { me?: boolean; photo?: string | null; frame?: FrameId | string | null }) {
  const inner = photo ? <PhotoAvatar uri={photo} size={props.size} ring={props.ring} /> : me ? <MyAvatar {...props} /> : <PresetAvatar {...props} />;
  if (me && !frame) return <MyFramed size={props.size ?? 56}>{inner}</MyFramed>;
  if (!frame) return inner;
  return (
    <View>
      {inner}
      <FrameRing id={frame as FrameId} size={props.size ?? 56} />
    </View>
  );
}

function MyFramed({ size, children }: { size: number; children: React.ReactNode }) {
  const frame = useMyFrame();
  return (
    <View>
      {children}
      <FrameRing id={frame} size={size} />
    </View>
  );
}

interface AvatarProps {
  id: string | null | undefined;
  nick?: string;
  size?: number;
  ring?: string;
}

function MyAvatar(props: AvatarProps) {
  const photo = useMyPhoto();
  return photo ? <PhotoAvatar uri={photo} size={props.size} ring={props.ring} /> : <PresetAvatar {...props} />;
}

function PhotoAvatar({ uri, size = 56, ring }: { uri: string; size?: number; ring?: string }) {
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: "#E3E8E4" }, ring ? { borderWidth: Math.max(2, size / 18), borderColor: ring } : null]}>
      <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
    </View>
  );
}

function PresetAvatar({ id, size = 56, ring }: AvatarProps) {
  const a = avatarById(id);
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: a.bg },
        ring ? { borderWidth: Math.max(2, size / 18), borderColor: ring } : null,
      ]}
    >
      {/* the bust sits on the bottom edge of the circle */}
      <Image source={a.image} style={{ width: size * 0.92, height: size * 0.92, marginTop: size * 0.08 }} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: "center", justifyContent: "flex-end", overflow: "hidden" },
});
