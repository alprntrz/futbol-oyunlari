import * as Clipboard from "expo-clipboard";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { getMatchById } from "@/data/matches";
import type { Difficulty, Match } from "@/lib/types";

import { MissingXIBoard } from "~/components/MissingXIBoard";
import { Screen } from "~/components/Screen";
import { Button, Tap } from "~/components/ui";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { getNick } from "~/lib/raceSession";
import { getSocket } from "~/lib/socket";
import { C, F } from "~/lib/theme";
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
      <Screen>
        <Stack.Screen options={{ title: t("onlineRace") }} />
        <Text style={[styles.big, { color: "#f87171", marginTop: 40 }]}>{error}</Text>
        <Button title={`← ${t("onlineRace")}`} onPress={() => router.back()} style={{ marginTop: 20 }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: t("onlineRace") }} />
      <View style={styles.bar}>
        <Tap onPress={copy}>
          <Text style={styles.code}>
            {code} {copied ? "✓" : "⧉"}
          </Text>
        </Tap>
        <View style={{ flexDirection: "row", gap: 12 }}>
          {room?.players.map((p) => (
            <View key={p.id} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <View style={[styles.dot, { backgroundColor: p.done ? C.textMute : C.emerald }]} />
              <Text style={styles.player}>{p.id === myId ? t("you") : p.nick || t("opponent")}</Text>
              <Text style={styles.solved}>{p.solved}/11</Text>
            </View>
          ))}
        </View>
      </View>

      {!room?.started ? (
        <View style={{ alignItems: "center", gap: 16, paddingVertical: 40 }}>
          {room && room.players.length < 2 && <Text style={styles.waiting}>{t("waiting")}</Text>}
          {room && room.players.length >= 2 && me?.isHost && (
            <Button title={`▶ ${t("start")}`} color="#059669" onPress={() => getSocket().emit("room:start")} style={{ paddingHorizontal: 40 }} />
          )}
          {room && room.players.length >= 2 && !me?.isHost && <Text style={styles.waiting}>{t("waitingHost")}</Text>}
          <Text style={{ color: C.textMute, fontFamily: F.body }}>
            {t("roomCode")}: <Text style={{ color: C.text, fontFamily: F.black }}>{code}</Text>
          </Text>
        </View>
      ) : match ? (
        <>
          {result && (
            <View
              style={[
                styles.result,
                { backgroundColor: result.winnerId === null ? "rgba(217,119,6,0.3)" : result.winnerId === myId ? "rgba(5,150,105,0.3)" : "rgba(220,38,38,0.3)" },
              ]}
            >
              <Text style={styles.big}>{result.winnerId === null ? t("raceTie") : result.winnerId === myId ? t("raceWin") : t("raceLose")}</Text>
            </View>
          )}
          <RaceGame
            match={match}
            difficulty={room.difficulty}
            headerExtra={
              opponent ? (
                <Text style={styles.opponent}>
                  {t("opponent")}: <Text style={{ color: C.text, fontFamily: F.black }}>{opponent.nick}</Text>{" "}
                  <Text style={{ color: C.emeraldLight }}>{opponent.solved}/11</Text> · {t("totalGuesses").toLowerCase()}: {opponent.totalGuesses}
                </Text>
              ) : null
            }
          />
        </>
      ) : null}
    </Screen>
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
  bar: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "rgba(24,24,27,0.7)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  code: { color: C.emeraldLight, fontFamily: F.black, fontSize: 20, letterSpacing: 3 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  player: { color: C.text, fontFamily: F.bold, fontSize: 13 },
  solved: { color: C.emeraldLight, fontFamily: F.black, fontSize: 13 },
  waiting: { color: "#d4d4d8", fontFamily: F.bold, fontSize: 17, textAlign: "center" },
  result: { width: "100%", borderRadius: 12, padding: 12, marginBottom: 12 },
  big: { color: C.text, fontFamily: F.black, fontSize: 18, textAlign: "center" },
  opponent: { color: C.textDim, fontFamily: F.body, fontSize: 12, marginTop: 4 },
});
