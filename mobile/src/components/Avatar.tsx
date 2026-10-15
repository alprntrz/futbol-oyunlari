import { Image, StyleSheet, View } from "react-native";

import { avatarById } from "~/lib/avatar";
import { useMyPhoto } from "~/lib/photo";

/**
 * Round avatar: the preset character on its tinted circle. `me`: this phone's
 * own avatar, shown as the profile photo when the player picked one
 * (`photo`: a draft photo to preview instead).
 */
export function Avatar({ me, photo, ...props }: AvatarProps & { me?: boolean; photo?: string | null }) {
  if (photo) return <PhotoAvatar uri={photo} size={props.size} ring={props.ring} />;
  return me ? <MyAvatar {...props} /> : <PresetAvatar {...props} />;
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
