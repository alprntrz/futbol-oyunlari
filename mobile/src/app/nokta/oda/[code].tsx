import { router, Stack, useLocalSearchParams } from "expo-router";
import { View } from "react-native";

import { XP } from "@/lib/levels";

import { ConnectionBanner } from "~/components/ConnectionBanner";
import { EmoteButton, EmoteLayer, useEmotes } from "~/components/Emotes";
import { PlayerMenuButton } from "~/components/PlayerMenu";
import { SeriesEnd } from "~/components/SeriesEnd";
import { SpotBoard, SpotEnd } from "~/components/SpotBoard";
import { Text } from "~/components/Text";
import { Button, Card, Icon, Page } from "~/components/ui";
import { WaitingRoom } from "~/components/WaitingRoom";
import { useRecordMatch } from "~/lib/history";
import { useI18n } from "~/lib/i18n";
import { useLeaveGuard } from "~/lib/leaveGuard";
import { getSocket } from "~/lib/socket";
import { useSpotOnline } from "~/lib/spotMatch";
import { C, T } from "~/lib/theme";
import { useXpAward } from "~/lib/xp";

/** An online The Spot room: waiting room with the code until both are in, then the shootout (server-run, `sp:*`). */
export default function SpotRoom() {
  const { t } = useI18n();
  const params = useLocalSearchParams<{ code: string; random?: string }>();
  const code = (params.code ?? "").toUpperCase();
  const m = useSpotOnline(code);
  const emotes = useEmotes("sp", true);
  const room = m.room;
  useLeaveGuard(!!room?.started && !m.over && !m.peerLeft);

  useXpAward(m.over, m.key, "sp", m.won ? XP.spWin : m.draw ? XP.spDraw : XP.spLoss);
  useRecordMatch(m.over, { key: m.key, game: "sp", opponent: m.opponent?.nick || t("opponent"), result: m.won ? "win" : m.draw ? "draw" : "loss", score: `${m.score.me}–${m.score.them}` });

  if (m.error) {
    return (
      <Page>
        <Stack.Screen options={{ title: t("spName") }} />
        <Card style={{ alignItems: "center", gap: 12, paddingVertical: 28 }}>
          <Icon name="exclamationmark.triangle.fill" size={30} color={C.amber} fallback="⚠️" />
          <Text style={T.headline}>{m.error === "full" ? t("roomFull") : t("roomNotFound")}</Text>
          <Button title={t("spName")} kind="secondary" icon="chevron.left" onPress={() => router.back()} />
        </Card>
      </Page>
    );
  }

  if (!room || !room.started) {
    return (
      <Page>
        <Stack.Screen options={{ title: t("spName") }} />
        <WaitingRoom
          code={code}
          players={room?.players ?? []}
          nameOf={(p) => (p.id === m.myId ? t("you") : room?.players.find((x) => x.id === p.id)?.nick || t("opponent"))}
          isHost={room?.players[0]?.id === m.myId}
          inviteText={t("spInvite")}
          peerLeft={m.peerLeft}
          onStart={() => getSocket().emit("sp:start")}
        />
      </Page>
    );
  }

  return (
    <>
      <Page scroll={false}>
        <Stack.Screen
          options={{
            title: params.random ? t("spName") : code,
            headerRight: () => (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <PlayerMenuButton target={m.opponent?.ref ? { ref: m.opponent.ref, nick: m.opponent.nick, game: "sp" } : null} color={C.text} bg="#EEF2EF" />
                <EmoteButton e={emotes} color={C.text} bg="#EEF2EF" />
              </View>
            ),
          }}
        />
        {m.peerLeft && <Text style={[T.body, { color: C.red, textAlign: "center", marginBottom: 10 }]}>{t("htPeerLeft")}</Text>}
        <SpotBoard m={m} footer={<SpotEnd m={m} onNew={params.random ? () => router.replace("/nokta/rastgele") : undefined} />} />
        <SeriesEnd
          over={m.over}
          won={m.won}
          title={m.draw ? t("spDraw") : undefined}
          mine={m.score.me}
          theirs={m.score.them}
          onRematch={m.rematch}
          rematchTitle={m.rivalWantsAgain ? t("htAccept") : undefined}
          note={m.rivalWantsAgain ? t("htRematchAsked").replace("{name}", m.opponent?.nick || t("opponent")) : undefined}
          countTrophy={false}
          payXp={false}
        />
        <EmoteLayer e={emotes} top={4} />
      </Page>
      <ConnectionBanner game="sp" />
    </>
  );
}
