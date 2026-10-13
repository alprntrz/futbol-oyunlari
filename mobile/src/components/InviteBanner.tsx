import { router, usePathname } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { SlideInUp, SlideOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAccount } from "~/lib/account";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { play } from "~/lib/sound";
import { getSocket } from "~/lib/socket";
import { C, F, shadow, T } from "~/lib/theme";

import { Avatar } from "./Avatar";
import { Text } from "./Text";
import { Tap } from "./ui";

interface Invite {
  from: { nick: string; avatar: string; code: string } | null;
  game: "ht";
  room: string;
}

/** Banners hide on their own after this. */
const SHOW_MS = 20_000;

/**
 * A friend's invite (server.js `fr:invite`) drops in from the top while the app
 * is open: Join opens their room. Signed-in players keep a socket open so friends
 * see them online and can reach them. Mounted once in the root layout.
 */
export function InviteBanner() {
  const { t } = useI18n();
  const account = useAccount();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const [invite, setInvite] = useState<Invite | null>(null);

  useEffect(() => {
    if (!account) return;
    const socket = getSocket(); // connecting is what makes us "online" for friends
    const onInvite = (i: Invite) => {
      haptic.success();
      play("pop");
      setInvite(i);
    };
    socket.on("fr:invited", onInvite);
    return () => {
      socket.off("fr:invited", onInvite);
    };
  }, [account]);

  useEffect(() => {
    if (!invite) return;
    const id = setTimeout(() => setInvite(null), SHOW_MS);
    return () => clearTimeout(id);
  }, [invite]);

  // already in that room (or the invite is for a signed-out phone): nothing to show
  if (!invite || !account || pathname.includes(invite.room)) return null;

  const join = () => {
    haptic.tap();
    setInvite(null);
    router.push({ pathname: "/hat-trick/oda/[code]", params: { code: invite.room } });
  };

  return (
    <Animated.View entering={SlideInUp.springify().damping(16)} exiting={SlideOutUp.duration(200)} style={[styles.wrap, { top: insets.top + 6 }]} pointerEvents="box-none">
      <View style={styles.card} accessibilityLiveRegion="polite">
        <Avatar id={invite.from?.avatar ?? null} size={42} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {t("inviteTitle").replace("{nick}", invite.from?.nick || t("opponent"))}
          </Text>
          <Text style={T.caption} numberOfLines={1}>
            {t("inviteBody").replace("{code}", invite.room)}
          </Text>
        </View>
        <Tap onPress={() => setInvite(null)} style={styles.later} accessibilityLabel={t("inviteLater")}>
          <Text style={styles.laterText}>{t("inviteLater")}</Text>
        </Tap>
        <Tap onPress={join} style={styles.join} accessibilityLabel={t("inviteJoin")}>
          <Text style={styles.joinText}>{t("inviteJoin")}</Text>
        </Tap>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 12, right: 12, zIndex: 1000 },
  card: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.card, borderRadius: 20, padding: 10, ...shadow, shadowOpacity: 0.18, shadowRadius: 16, elevation: 8 },
  title: { fontFamily: F.display, fontSize: 17, color: C.text },
  later: { paddingHorizontal: 8, paddingVertical: 8 },
  laterText: { fontWeight: "700", color: C.text3, fontSize: 14 },
  join: { backgroundColor: C.greenMid, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  joinText: { fontFamily: F.display, fontSize: 16, color: "white" },
});
