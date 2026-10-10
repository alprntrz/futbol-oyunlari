import * as Clipboard from "expo-clipboard";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Image, Share, StyleSheet, Text, View } from "react-native";

import { getMatchById } from "@/data/matches";
import type { Difficulty, Match } from "@/lib/types";

import { MissingXIBoard } from "~/components/MissingXIBoard";
import { Button, Card, Icon, Page, Tap } from "~/components/ui";
import { BRAND } from "~/lib/brand";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { getNick } from "~/lib/raceSession";
import { getSocket } from "~/lib/socket";
import { C, T } from "~/lib/theme";
import { useMissingXI, type GameProgress } from "~/lib/useMissingXI";

interface PublicPlayer {
  id: string;
  nick: string;
  solved: number;
  totalGuesses: number;
  done: boolean;
  isHost: boolean;
}
interface PublicRoom {
  code: string;
  difficulty: Difficulty;
  matchId: string;
  started: boolean;
  players: PublicPlayer[];
}

export default function RoomScreen() {
  const { t } = useI18n();
  const params = useLocalSearchParams<{ code: string }>();
  const code = (params.code ?? "").toUpperCase();
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ winnerId: string | null } | null>(null);
  const [myId, setMyId] = useState(() => getSocket().id ?? "");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    const onUpdate = (r: PublicRoom) => setRoom(r);
    const onOver = (res: { winnerId: string | null; room: PublicRoom }) => {
      setResult(res);
      setRoom(res.room);
      if (res.winnerId === socket.id) haptic.success();
      else haptic.error();
    };
    const onConnect = () => setMyId(socket.id ?? "");
    socket.on("room:update", onUpdate);
    socket.on("room:peer-left", onUpdate);
    socket.on("race:over", onOver);
    socket.on("connect", onConnect);

    // The lobby already joined us; joining again with the same socket is a no-op
    socket.emit("room:join", { code, nick: getNick() }, (res: { ok: boolean; error?: string; room?: PublicRoom }) => {
      if (res.ok && res.room) setRoom(res.room);
      else setError(res.error === "full" ? t("roomFull") : t("roomNotFound"));
    });

    return () => {
      socket.off("room:update", onUpdate);
      socket.off("room:peer-left", onUpdate);
      socket.off("race:over", onOver);
      socket.off("connect", onConnect);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const match = useMemo(() => (room ? getMatchById(room.matchId) : undefined), [room?.matchId]); // eslint-disable-line react-hooks/exhaustive-deps
  const me = room?.players.find((p) => p.id === myId);
  const opponent = room?.players.find((p) => p.id !== myId);

  const copy = async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (error) {
    return (
      <Page>
        <Stack.Screen options={{ title: t("onlineRace") }} />
        <Card style={{ alignItems: "center", gap: 12, paddingVertical: 28 }}>
          <Icon name="exclamationmark.triangle.fill" size={30} color={C.amber} fallback="⚠️" />
          <Text style={T.headline}>{error}</Text>
          <Button title={t("onlineRace")} kind="secondary" icon="chevron.left" onPress={() => router.back()} />
        </Card>
      </Page>
    );
  }

  return (
    <Page>
      <Stack.Screen options={{ title: t("onlineRace") }} />

      {!room?.started ? (
        <>
          <Card style={styles.codeCard}>
            <Text style={T.label}>{t("roomCode")}</Text>
            <Tap onPress={copy} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text style={styles.code}>{code}</Text>
              <Icon name={copied ? "checkmark.circle.fill" : "doc.on.doc"} size={20} color={copied ? C.green : C.text3} fallback="⧉" />
            </Tap>
            <Button
              title={t("shareCode")}
              kind="secondary"
              icon="square.and.arrow.up"
              onPress={() => Share.share({ message: `${t("inviteText")} ${code}` })}
              style={{ alignSelf: "stretch" }}
            />
          </Card>

          <Card style={{ marginTop: 16, padding: 0, overflow: "hidden" }}>
            {room?.players.map((p, i) => (
              <View key={p.id} style={[styles.player, i > 0 && styles.playerDivider]}>
                <View style={[styles.avatar, { backgroundColor: p.id === myId ? C.greenSoft : C.violetSoft }]}>
                  <Icon name="person.fill" size={16} color={p.id === myId ? C.green : C.violet} fallback="👤" />
                </View>
                <Text style={[T.headline, { flex: 1 }]}>{p.id === myId ? t("you") : p.nick || t("opponent")}</Text>
                {p.isHost && <Icon name="crown.fill" size={14} color={C.amber} fallback="👑" />}
              </View>
            ))}
          </Card>

          <View style={{ alignItems: "center", marginTop: 24, gap: 12 }}>
            {room && room.players.length < 2 && (
              <>
                <Image source={BRAND.illus.waitingRoom} style={{ width: 240, height: 120 }} resizeMode="contain" />
                <Text style={T.body}>{t("waiting")}</Text>
              </>
            )}
            {room && room.players.length >= 2 && me?.isHost && (
              <Button title={t("start")} icon="play.fill" onPress={() => getSocket().emit("room:start")} style={{ alignSelf: "stretch" }} />
            )}
            {room && room.players.length >= 2 && !me?.isHost && <Text style={T.body}>{t("waitingHost")}</Text>}
          </View>
        </>
      ) : match ? (
        <>
          {result && (
            <Card
              style={[
                styles.result,
                { backgroundColor: result.winnerId === null ? C.amberSoft : result.winnerId === myId ? C.greenSoft : C.redSoft },
              ]}
            >
              <Text style={[T.headline, { textAlign: "center" }]}>
                {result.winnerId === null ? t("raceTie") : result.winnerId === myId ? t("raceWin") : t("raceLose")}
              </Text>
            </Card>
          )}
          <RaceGame
            match={match}
            difficulty={room.difficulty}
            headerExtra={
              opponent ? (
                <View style={styles.versus}>
                  <Icon name="person.fill" size={13} color={C.violet} fallback="👤" />
                  <Text style={[T.caption, { color: C.text2 }]}>
                    {opponent.nick || t("opponent")}: <Text style={{ fontWeight: "800", color: C.violet }}>{opponent.solved}/11</Text> · {opponent.totalGuesses}{" "}
                    {t("guessesWord")}
                  </Text>
                </View>
              ) : null
            }
          />
        </>
      ) : null}
    </Page>
  );
}

function RaceGame({ match, difficulty, headerExtra }: { match: Match; difficulty: Difficulty; headerExtra: React.ReactNode }) {
  const { slots, progress, guess, giveUp } = useMissingXI(match, difficulty);
  const { solved, failed, totalGuesses, done, won } = progress;

  useEffect(() => {
    const p: GameProgress = { solved, failed, totalGuesses, done, won };
    getSocket().emit("race:progress", p);
  }, [solved, failed, totalGuesses, done, won]);

  return (
    <MissingXIBoard
      match={match}
      difficulty={difficulty}
      slots={slots}
      done={done}
      totalGuesses={totalGuesses}
      onGuess={guess}
      onGiveUp={giveUp}
      headerExtra={headerExtra}
    />
  );
}

const styles = StyleSheet.create({
  codeCard: { alignItems: "center", gap: 14, padding: 24 },
  code: { fontSize: 40, fontWeight: "800", letterSpacing: 8, color: C.text },
  player: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  playerDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  result: { marginBottom: 12 },
  versus: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10 },
});
