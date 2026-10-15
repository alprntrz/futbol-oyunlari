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

type From = { nick: string; avatar: string; code: string } | null;
/** a room invite, or "X added you as a friend" (`fr:added`) */
type Invite = { kind: "invite"; from: From; game: "ht"; room: string } | { kind: "added"; from: From };

/** Banners hide on their own after this. */
const SHOW_MS = 20_000;

/**
 * A friend's invite (server.js `fr:invite`) drops in from the top while the app
 * is open: Join opens their room. Being added as a friend (`fr:added`) shows
 * the same way. Signed-in players keep a socket open so friends see them
 * online and can reach them. Mounted once in the root layout.
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
    const show = (i: Invite) => {
      haptic.success();
      play("pop");
      setInvite(i);
    };
    const onInvite = (i: { from: From; game: "ht"; room: string }) => show({ kind: "invite", ...i });
    const onAdded = ({ from }: { from: From }) => show({ kind: "added", from });
    socket.on("fr:invited", onInvite);
    socket.on("fr:added", onAdded);
    return () => {
      socket.off("fr:invited", onInvite);
      socket.off("fr:added", onAdded);
    };
  }, [account]);

  useEffect(() => {
    if (!invite) return;
    const id = setTimeout(() => setInvite(null), invite.kind === "added" ? 6000 : SHOW_MS);
    return () => clearTimeout(id);
  }, [invite]);

  // already in that room (or the invite is for a signed-out phone): nothing to show
  if (!invite || !account) return null;
  if (invite.kind === "invite" && pathname.includes(invite.room)) return null;
  const nick = invite.from?.nick || t("opponent");

  const join = () => {
    haptic.tap();
    setInvite(null);
    if (invite.kind === "invite") router.push({ pathname: "/hat-trick/oda/[code]", params: { code: invite.room } });
    else router.push("/arkadaslar");
  };

  return (
    <Animated.View entering={SlideInUp.springify().damping(16)} exiting={SlideOutUp.duration(200)} style={[styles.wrap, { top: insets.top + 6 }]} pointerEvents="box-none">
      <View style={styles.card} accessibilityLiveRegion="polite">
        <Avatar id={invite.from?.avatar ?? null} size={42} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {t(invite.kind === "invite" ? "inviteTitle" : "friendAddedTitle").replace("{nick}", nick)}
          </Text>
          <Text style={T.caption} numberOfLines={1}>
            {invite.kind === "invite" ? t("inviteBody").replace("{code}", invite.room) : t("friendAddedBody")}
          </Text>
        </View>
        <Tap onPress={() => setInvite(null)} style={styles.later} accessibilityLabel={t("inviteLater")}>
          <Text style={styles.laterText}>{t("inviteLater")}</Text>
        </Tap>
        <Tap onPress={join} style={styles.join} accessibilityLabel={t(invite.kind === "invite" ? "inviteJoin" : "friendAddedSee")}>
          <Text style={styles.joinText}>{t(invite.kind === "invite" ? "inviteJoin" : "friendAddedSee")}</Text>
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
