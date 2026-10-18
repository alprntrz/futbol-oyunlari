import { router, Stack, useLocalSearchParams } from "expo-router";
import { View } from "react-native";

import { XP } from "@/lib/levels";

import { ConnectionBanner } from "~/components/ConnectionBanner";
import { EmoteButton, EmoteLayer, useEmotes } from "~/components/Emotes";
import { PlayerMenuButton } from "~/components/PlayerMenu";
import { RondoBoard, RondoEnd } from "~/components/RondoBoard";
import { SeriesEnd } from "~/components/SeriesEnd";
import { Text } from "~/components/Text";
import { Button, Card, Icon, Page } from "~/components/ui";
import { WaitingRoom } from "~/components/WaitingRoom";
import { useRecordMatch } from "~/lib/history";
import { useI18n } from "~/lib/i18n";
import { useRondoOnline } from "~/lib/rondoMatch";
import { getSocket } from "~/lib/socket";
import { C, T } from "~/lib/theme";
import { useXpAward } from "~/lib/xp";

/** An online Rondo room: waiting room with the code until both are in, then the match (server-run, `rd:*`). */
export default function RondoRoom() {
  const { t } = useI18n();
  const params = useLocalSearchParams<{ code: string; random?: string }>();
  const code = (params.code ?? "").toUpperCase();
  const m = useRondoOnline(code);
  const emotes = useEmotes("rd", true);
  const room = m.room;

  useXpAward(m.over && !m.peerLeft, m.key, "rd", m.won ? XP.rdWin : XP.rdLoss);
  useRecordMatch(m.over, { key: m.key, game: "rd", opponent: m.opponent?.nick || t("opponent"), result: m.won ? "win" : "loss", score: `${m.score.me}–${m.score.them}` });

  if (m.error) {
    return (
      <Page>
        <Stack.Screen options={{ title: "Rondo" }} />
        <Card style={{ alignItems: "center", gap: 12, paddingVertical: 28 }}>
          <Icon name="exclamationmark.triangle.fill" size={30} color={C.amber} fallback="⚠️" />
          <Text style={T.headline}>{m.error === "full" ? t("roomFull") : t("roomNotFound")}</Text>
          <Button title="Rondo" kind="secondary" icon="chevron.left" onPress={() => router.back()} />
        </Card>
      </Page>
    );
  }

  if (!room || !room.started) {
    const isHost = room?.players[0]?.id === m.myId;
    return (
      <Page>
        <Stack.Screen options={{ title: "Rondo" }} />
        <WaitingRoom
          code={code}
          players={room?.players ?? []}
          nameOf={(p) => (p.id === m.myId ? t("you") : room?.players.find((x) => x.id === p.id)?.nick || t("opponent"))}
          isHost={isHost}
          inviteText={t("rdInvite")}
          peerLeft={m.peerLeft}
          onStart={() => getSocket().emit("rd:start")}
        />
      </Page>
    );
  }

  return (
    <>
      <Page scroll={false}>
        <Stack.Screen
          options={{
            title: params.random ? "Rondo" : code,
            headerRight: () => (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <PlayerMenuButton target={m.opponent?.ref ? { ref: m.opponent.ref, nick: m.opponent.nick, game: "rd" } : null} color={C.text} bg="#EEF2EF" />
                <EmoteButton e={emotes} color={C.text} bg="#EEF2EF" />
              </View>
            ),
          }}
        />
        {m.peerLeft && <Text style={[T.body, { color: C.red, textAlign: "center", marginBottom: 10 }]}>{t("htPeerLeft")}</Text>}
        <RondoBoard m={m} footer={<RondoEnd m={m} onNew={params.random ? () => router.replace("/rondo/rastgele") : undefined} />} />
        <SeriesEnd over={m.over} won={m.won} mine={m.score.me} theirs={m.score.them} onRematch={m.rematch} countTrophy={false} />
        <EmoteLayer e={emotes} top={4} />
      </Page>
      <ConnectionBanner game="rd" />
    </>
  );
}
