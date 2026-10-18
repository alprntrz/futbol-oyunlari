import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { MatchIntro } from "~/components/MatchIntro";
import { MatchSearch } from "~/components/MatchSearch";
import { Text } from "~/components/Text";
import { Page } from "~/components/ui";
import { houseLook, loadMyLook } from "~/lib/cosmetics";
import { haptic } from "~/lib/haptics";
import type { Mark } from "~/lib/hattrick";
import { useI18n } from "~/lib/i18n";
import { GAME_ICON, useSearchActivity } from "~/lib/liveActivity";
import { houseAfterMs } from "~/lib/matchmaking";
import { loadNick, randomNick } from "~/lib/nick";
import { boardToIds, generateBoard } from "~/lib/possession";
import { getSocket } from "~/lib/socket";
import { F } from "~/lib/theme";
import { loadTier } from "~/lib/xp";

type Look = { avatar: string | null; frame: string | null };
type Matched = ({ kind: "room"; code: string; me: Mark; opponent: string; tier: number | null } | { kind: "bot"; opponent: string; tier: number | null }) & Look;

/** Random opponent: wait in the server queue (or meet the house player), show the VS intro, then the game. */
export default function PossessionRandom() {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [matched, setMatched] = useState<Matched | null>(null);
  useSearchActivity(t("ppName"), GAME_ICON.pp, !matched);

  // nobody else searching: the house player, who looks and plays like anyone online
  useEffect(() => {
    if (matched) return;
    const id = setTimeout(() => {
      getSocket().emit("pp:unqueue");
      loadTier().then((tier) => setMatched({ kind: "bot", opponent: randomNick(), tier, ...houseLook(tier) }));
    }, houseAfterMs());
    return () => clearTimeout(id);
  }, [matched]);

  useEffect(() => {
    const socket = getSocket();
    const onMatched = (m: { code: string; players: ({ id: string; nick: string; mark?: Mark; tier?: number | null } & Partial<Look>)[] }) => {
      const me = m.players.find((p) => p.id === socket.id) ?? m.players[0];
      const them = m.players.find((p) => p !== me);
      setMatched({ kind: "room", code: m.code, me: me.mark ?? (me === m.players[0] ? "X" : "O"), opponent: them?.nick || t("opponent"), tier: them?.tier ?? null, avatar: them?.avatar ?? null, frame: them?.frame ?? null });
    };
    const onError = () => setError(t("serverUnreachable"));
    const enqueue = async () => {
      setError(null);
      socket.emit("pp:queue", { nick: await loadNick(), board: boardToIds(generateBoard()), tier: await loadTier(), ...(await loadMyLook()) });
    };
    socket.on("pp:matched", onMatched);
    socket.on("connect_error", onError);
    socket.on("connect", enqueue);
    if (socket.connected) enqueue();
    return () => {
      socket.emit("pp:unqueue");
      socket.off("pp:matched", onMatched);
      socket.off("connect_error", onError);
      socket.off("connect", enqueue);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the slot locks on the opponent for a beat, then the VS countdown
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    if (!matched) return;
    haptic.success();
    const id = setTimeout(() => setLocked(true), 600);
    return () => clearTimeout(id);
  }, [matched]);

  if (matched && locked) {
    const me: Mark = matched.kind === "room" ? matched.me : "X";
    return (
      <Page>
        <Stack.Screen options={{ title: t("ppName") }} />
        <MatchIntro
          me={{ name: t("you"), mark: me }}
          opponent={{ name: matched.opponent, mark: me === "X" ? "O" : "X", tier: matched.tier }}
          onDone={() =>
            router.replace(
              matched.kind === "room"
                ? { pathname: "/possession/oda/[code]", params: { code: matched.code, random: "1" } }
                : { pathname: "/possession/bot", params: { nick: matched.opponent } }
            )
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
