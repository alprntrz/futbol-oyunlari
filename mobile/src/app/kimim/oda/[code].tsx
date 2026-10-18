import { router, Stack, useLocalSearchParams } from "expo-router";
import { View } from "react-native";

import { XP } from "@/lib/levels";

import { ConnectionBanner } from "~/components/ConnectionBanner";
import { EmoteButton, EmoteLayer, useEmotes } from "~/components/Emotes";
import { PlayerMenuButton } from "~/components/PlayerMenu";
import { WhoAmIBoard, WhoAmIEnd } from "~/components/WhoAmIBoard";
import { Text } from "~/components/Text";
import { Button, Card, Icon, Page } from "~/components/ui";
import { WaitingRoom } from "~/components/WaitingRoom";
import { useRecordMatch } from "~/lib/history";
import { useI18n } from "~/lib/i18n";
import { useWmOnline } from "~/lib/whoamiMatch";
import { getSocket } from "~/lib/socket";
import { C, T } from "~/lib/theme";
import { useXpAward } from "~/lib/xp";

/** An online Who Am I? room: waiting room with the code until both are in, then the match (server-run, `wm:*`). */
export default function WhoAmIRoom() {
  const { t } = useI18n();
  const params = useLocalSearchParams<{ code: string; random?: string }>();
  const code = (params.code ?? "").toUpperCase();
  const m = useWmOnline(code);
  const emotes = useEmotes("wm", true);
  const room = m.room;

  useXpAward(m.over && !m.peerLeft, m.key, "wm", m.won ? XP.wmWin : m.draw ? XP.wmDraw : XP.wmLoss);
  useRecordMatch(m.over, { key: m.key, game: "wm", opponent: m.opponent?.nick || t("opponent"), result: m.won ? "win" : m.draw ? "draw" : "loss", score: `${m.hearts.me}–${m.hearts.them}` });

  if (m.error) {
    return (
      <Page>
        <Stack.Screen options={{ title: t("wmName") }} />
        <Card style={{ alignItems: "center", gap: 12, paddingVertical: 28 }}>
          <Icon name="exclamationmark.triangle.fill" size={30} color={C.amber} fallback="⚠️" />
          <Text style={T.headline}>{m.error === "full" ? t("roomFull") : t("roomNotFound")}</Text>
          <Button title={t("wmName")} kind="secondary" icon="chevron.left" onPress={() => router.back()} />
        </Card>
      </Page>
    );
  }

  if (!room || !room.started) {
    const isHost = room?.players[0]?.id === m.myId;
    return (
      <Page>
        <Stack.Screen options={{ title: t("wmName") }} />
        <WaitingRoom
          code={code}
          players={room?.players ?? []}
          nameOf={(p) => (p.id === m.myId ? t("you") : room?.players.find((x) => x.id === p.id)?.nick || t("opponent"))}
          isHost={isHost}
          inviteText={t("wmInvite")}
          peerLeft={m.peerLeft}
          onStart={() => getSocket().emit("wm:start")}
        />
      </Page>
    );
  }

  return (
    <>
      <Page scroll={false}>
        <Stack.Screen
          options={{
            title: params.random ? t("wmName") : code,
            headerRight: () => (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <PlayerMenuButton target={m.opponent?.ref ? { ref: m.opponent.ref, nick: m.opponent.nick, game: "wm" } : null} color={C.text} bg="#EEF2EF" />
                <EmoteButton e={emotes} color={C.text} bg="#EEF2EF" />
              </View>
            ),
          }}
        />
        {m.peerLeft && <Text style={[T.body, { color: C.red, textAlign: "center", marginBottom: 10 }]}>{t("htPeerLeft")}</Text>}
        <WhoAmIBoard m={m} footer={<WhoAmIEnd m={m} onNew={params.random ? () => router.replace("/kimim/rastgele") : undefined} />} />
        <EmoteLayer e={emotes} top={4} />
      </Page>
      <ConnectionBanner game="wm" />
    </>
  );
}
