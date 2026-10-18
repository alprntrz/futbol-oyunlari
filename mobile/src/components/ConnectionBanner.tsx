import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useI18n } from "~/lib/i18n";
import { getSocket } from "~/lib/socket";
import { C, F, shadow } from "~/lib/theme";

import { Text } from "./Text";
import { Icon } from "./ui";

type Game = "ht" | "pp" | "dz" | "rd";

/**
 * Live online match, a pill at the bottom: says when this phone lost the server ("reconnecting…"), when it came back
 * too late (the server kept the seat for REJOIN_MS in server.js, then counted it as left), and
 * when the other player dropped out (their seat waits, with the seconds left).
 */
export function ConnectionBanner({ game }: { game: Game }) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(() => !getSocket().connected);
  const [lost, setLost] = useState(false);
  const [peerUntil, setPeerUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const socket = getSocket();
    let dropped = false;
    let lostTimer: ReturnType<typeof setTimeout> | undefined;
    const onDisconnect = () => {
      dropped = true;
      setOffline(true);
    };
    const onConnect = () => {
      setOffline(false);
      // back on a new connection: the server hands our seat over ("seat:back") unless we were too late
      if (dropped && !socket.recovered) lostTimer = setTimeout(() => setLost(true), 2500);
      dropped = false;
    };
    const onBack = () => {
      clearTimeout(lostTimer);
      setLost(false);
    };
    const onAway = (p: { game: Game; away: boolean; ms?: number }) => {
      if (p.game !== game) return;
      setPeerUntil(p.away ? Date.now() + (p.ms ?? 60_000) : 0);
    };
    socket.on("disconnect", onDisconnect);
    socket.on("connect", onConnect);
    socket.on("peer:away", onAway);
    socket.on("seat:back", onBack);
    return () => {
      clearTimeout(lostTimer);
      socket.off("seat:back", onBack);
      socket.off("disconnect", onDisconnect);
      socket.off("connect", onConnect);
      socket.off("peer:away", onAway);
    };
  }, [game]);

  useEffect(() => {
    if (!peerUntil) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [peerUntil]);

  const peerLeft = peerUntil > 0 ? Math.max(0, Math.ceil((peerUntil - now) / 1000)) : 0;
  const msg = lost
    ? { text: t("connGone"), color: C.red, soft: C.redSoft, icon: "wifi.slash" as const }
    : offline
      ? { text: t("connLost"), color: C.amber, soft: C.amberSoft, icon: "wifi.slash" as const }
      : peerLeft > 0
        ? { text: t("connPeerAway").replace("{s}", String(peerLeft)), color: C.text2, soft: C.card, icon: "hourglass" as const }
        : null;
  if (!msg) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      exiting={FadeOutDown.duration(150)}
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[styles.wrap, { bottom: insets.bottom + 16 }]}
    >
      <View style={[styles.pill, { backgroundColor: msg.soft, borderColor: msg.color }]}>
        <Icon name={msg.icon} size={16} color={msg.color} />
        <Text style={[styles.text, { color: msg.color === C.text2 ? C.text : msg.color }]}>{msg.text}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16, alignItems: "center", zIndex: 50 },
  pill: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 999, borderWidth: 1.5, ...shadow },
  text: { fontFamily: F.semi, fontSize: 15, flexShrink: 1 },
});
