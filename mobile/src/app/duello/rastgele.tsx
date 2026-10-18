import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { MatchIntro } from "~/components/MatchIntro";
import { MatchSearch } from "~/components/MatchSearch";
import { Text } from "~/components/Text";
import { Page } from "~/components/ui";
import { useDuel } from "~/lib/duel";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { houseAfterMs } from "~/lib/matchmaking";
import { houseLook, loadMyLook } from "~/lib/cosmetics";
import { loadNick, randomNick } from "~/lib/nick";
import { getSocket } from "~/lib/socket";
import { F } from "~/lib/theme";
import { loadTier } from "~/lib/xp";


type Look = { avatar: string | null; frame: string | null };
type Matched = ({ kind: "room"; code: string; opponent: string; tier: number | null } | { kind: "bot"; opponent: string; tier: number | null }) & Look;

/** Random Card Duel opponent: wait in the server queue (by rank), VS intro, then the match. */
export default function DuelRandom() {
  const { t } = useI18n();
  const { hand } = useDuel();
  const [error, setError] = useState<string | null>(null);
  const [matched, setMatched] = useState<Matched | null>(null);

  useEffect(() => {
    if (matched) return;
    const id = setTimeout(() => {
      getSocket().emit("dz:unqueue");
      loadTier().then((tier) => setMatched({ kind: "bot", opponent: randomNick(), tier, ...houseLook(tier) }));
    }, houseAfterMs());
    return () => clearTimeout(id);
  }, [matched]);

  useEffect(() => {
    if (hand.length === 0) return;
    const socket = getSocket();
    const onMatched = (m: { code: string; players: ({ id: string; nick: string; tier: number | null } & Partial<Look>)[] }) => {
      const them = m.players.find((p) => p.id !== socket.id);
      setMatched({ kind: "room", code: m.code, opponent: them?.nick || t("opponent"), tier: them?.tier ?? null, avatar: them?.avatar ?? null, frame: them?.frame ?? null });
    };
    const onError = () => setError(t("serverUnreachable"));
    const enqueue = async () => {
      setError(null);
      socket.emit("dz:queue", { nick: await loadNick(), hand, tier: await loadTier(), ...(await loadMyLook()) });
    };
    socket.on("dz:matched", onMatched);
    socket.on("connect_error", onError);
    socket.on("connect", enqueue);
    if (socket.connected) enqueue();
    return () => {
      socket.emit("dz:unqueue");
      socket.off("dz:matched", onMatched);
      socket.off("connect_error", onError);
      socket.off("connect", enqueue);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hand.length]);

  const [locked, setLocked] = useState(false);
  useEffect(() => {
    if (!matched) return;
    haptic.success();
    const id = setTimeout(() => setLocked(true), 600);
    return () => clearTimeout(id);
  }, [matched]);

  if (matched && locked) {
    return (
      <Page>
        <Stack.Screen options={{ title: t("dzName") }} />
        <MatchIntro
          me={{ name: t("you"), mark: "X" }}
          opponent={{ name: matched.opponent, mark: "O", tier: matched.tier }}
          onDone={() =>
            router.replace({
              pathname: "/duello/mac",
              params: matched.kind === "room" ? { mode: "room", code: matched.code } : { mode: "bot", nick: matched.opponent },
            })
          }
        />
      </Page>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <MatchSearch found={matched ? { nick: matched.opponent, tier: matched.tier, avatar: matched.avatar, frame: matched.frame } : null} onCancel={() => router.back()} />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  error: { position: "absolute", top: 70, left: 24, right: 24, textAlign: "center", fontFamily: F.display, fontSize: 17, color: "white", backgroundColor: "rgba(0,0,0,0.35)", borderRadius: 12, padding: 10, overflow: "hidden" },
});
