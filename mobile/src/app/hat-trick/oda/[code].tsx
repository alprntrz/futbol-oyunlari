import * as Clipboard from "expo-clipboard";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Share, StyleSheet, View } from "react-native";

import { generateGrid } from "@/lib/tiki";

import { HatTrickBoard, MARK } from "~/components/HatTrickBoard";
import { Text } from "~/components/Text";
import { WaitingAnimation } from "~/components/WaitingAnimation";
import { Button, Card, Icon, Page, Tap } from "~/components/ui";
import { haptic } from "~/lib/haptics";
import { gridFromIds, gridToIds, TURN_SECONDS, type HtCell, type Mark, type Winner } from "~/lib/hattrick";
import { useI18n } from "~/lib/i18n";
import { getNick } from "~/lib/raceSession";
import { getSocket } from "~/lib/socket";
import { C, F, T } from "~/lib/theme";

interface HtPlayer {
  id: string;
  nick: string;
  mark: Mark;
}
interface HtRoom {
  code: string;
  grid: { rows: string[]; cols: string[] };
  started: boolean;
  board: (HtCell | null)[];
  turn: Mark;
  winner: Winner;
  flash: { mark: Mark; reason: "wrong" | "timeout" } | null;
  remainingMs: number;
  steals: Record<Mark, number> | null;
  used: string[];
  players: HtPlayer[];
}

/** Online Hat-trick room: waiting screen, then the shared board driven by the server. */
export default function HatTrickRoom() {
  const { t } = useI18n();
  const params = useLocalSearchParams<{ code: string }>();
  const code = (params.code ?? "").toUpperCase();
  const [room, setRoom] = useState<HtRoom | null>(null);
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [peerLeft, setPeerLeft] = useState(false);
  const [myId, setMyId] = useState(() => getSocket().id ?? "");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    const apply = (r: HtRoom) => {
      setRoom((prev) => {
        // a move by the other phone: light tick
        if (prev && r.board.filter(Boolean).length > prev.board.filter(Boolean).length) haptic.tap();
        return r;
      });
      setDeadline(Date.now() + r.remainingMs);
    };
    const onUpdate = (r: HtRoom) => {
      setPeerLeft(false);
      apply(r);
    };
    const onPeerLeft = (r: HtRoom) => {
      setPeerLeft(true);
      apply(r);
    };
    const onConnect = () => setMyId(socket.id ?? "");
    socket.on("ht:update", onUpdate);
    socket.on("ht:peer-left", onPeerLeft);
    socket.on("connect", onConnect);

    // The lobby already joined us; joining again with the same socket is a no-op
    socket.emit("ht:join", { code, nick: getNick() }, (res: { ok: boolean; error?: string; room?: HtRoom }) => {
      if (res.ok && res.room) apply(res.room);
      else setError(res.error === "full" ? t("roomFull") : t("roomNotFound"));
    });

    return () => {
      socket.off("ht:update", onUpdate);
      socket.off("ht:peer-left", onPeerLeft);
      socket.off("connect", onConnect);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Clock display from the server deadline
  useEffect(() => {
    if (!room?.started || room.winner) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [room?.started, room?.winner]);

  const grid = useMemo(() => (room ? gridFromIds(room.grid) : null), [room?.grid]); // eslint-disable-line react-hooks/exhaustive-deps
  const me = room?.players.find((p) => p.id === myId);
  const isHost = room?.players[0]?.id === myId;
  const timeLeft = Math.min(TURN_SECONDS, Math.max(0, Math.ceil((deadline - now) / 1000)));

  const copy = async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (error) {
    return (
      <Page>
        <Stack.Screen options={{ title: t("htOnline") }} />
        <Card style={{ alignItems: "center", gap: 12, paddingVertical: 28 }}>
          <Icon name="exclamationmark.triangle.fill" size={30} color={C.amber} fallback="⚠️" />
          <Text style={T.headline}>{error}</Text>
          <Button title={t("htOnline")} kind="secondary" icon="chevron.left" onPress={() => router.back()} />
        </Card>
      </Page>
    );
  }

  const nameOf = (p?: HtPlayer) => (p ? (p.id === myId ? t("you") : p.nick || t("opponent")) : "…");
  const labels = { X: nameOf(room?.players.find((p) => p.mark === "X")), O: nameOf(room?.players.find((p) => p.mark === "O")) };

  // Waiting room: share the code until the second player is in and the host starts
  if (!room || !room.started || !grid) {
    return (
      <Page>
        <Stack.Screen options={{ title: t("htOnline") }} />
        <Card style={styles.codeCard}>
          <Text style={T.caption}>{t("roomCode")}</Text>
          <Tap onPress={copy} style={{ flexDirection: "row", alignItems: "center", gap: 10 }} accessibilityLabel={`${t("roomCode")} ${code.split("").join(" ")}`}>
            <Text style={styles.code}>{code}</Text>
            <Icon name={copied ? "checkmark.circle.fill" : "doc.on.doc"} size={20} color={copied ? C.green : C.text3} fallback="⧉" />
          </Tap>
          <Button
            title={t("shareCode")}
            kind="secondary"
            icon="square.and.arrow.up"
            onPress={() => Share.share({ message: `${t("htInvite")} ${code}` })}
            style={{ alignSelf: "stretch" }}
          />
        </Card>

        <Card style={{ marginTop: 16, padding: 0, overflow: "hidden" }}>
          {room?.players.map((p, i) => (
            <View key={p.id} style={[styles.player, i > 0 && styles.playerDivider]}>
              <View style={[styles.avatar, { backgroundColor: MARK[p.mark].soft }]}>
                <Text style={[styles.avatarMark, { color: MARK[p.mark].color }]}>{p.mark}</Text>
              </View>
              <Text style={[T.headline, { flex: 1 }]}>{nameOf(p)}</Text>
              {i === 0 && <Icon name="crown.fill" size={14} color={C.amber} fallback="👑" />}
            </View>
          ))}
        </Card>

        <View style={{ alignItems: "center", marginTop: 24, gap: 12 }}>
          {peerLeft && <Text style={[T.body, { color: C.red }]}>{t("htPeerLeft")}</Text>}
          {room && room.players.length < 2 && (
            <>
              <WaitingAnimation width={260} />
              <Text style={T.body}>{t("waiting")}</Text>
            </>
          )}
          {room && room.players.length >= 2 && isHost && (
            <Button title={t("start")} icon="play.fill" onPress={() => getSocket().emit("ht:start")} style={{ alignSelf: "stretch" }} />
          )}
          {room && room.players.length >= 2 && !isHost && <Text style={T.body}>{t("waitingHost")}</Text>}
        </View>
      </Page>
    );
  }

  const myTurn = !!me && room.turn === me.mark && !room.winner;
  const flash = room.flash ? `${nameOf(room.players.find((p) => p.mark === room.flash!.mark))}: ${t(room.flash.reason === "wrong" ? "ttWrong" : "ttTimeout")}` : null;
  const winnerText =
    room.winner === "draw" ? t("ttDraw") : room.winner === me?.mark ? t("htYouWin") : t("htYouLose");

  return (
    <Page>
      <Stack.Screen options={{ title: code }} />
      {peerLeft && <Text style={[T.body, { color: C.red, textAlign: "center", marginBottom: 10 }]}>{t("htPeerLeft")}</Text>}
      <HatTrickBoard
        steals={room.steals}
        usedNames={room.used}
        grid={grid}
        board={room.board}
        turn={room.turn}
        winner={room.winner}
        timeLeft={timeLeft}
        labels={labels}
        canMove={myTurn && !peerLeft}
        status={myTurn ? t("htYourTurn") : t("htTheirTurn")}
        flash={flash}
        celebrate={room.winner === me?.mark}
        winnerText={winnerText}
        onMove={(cell, name) => getSocket().emit("ht:move", { cell, name })}
        footer={
          room.winner ? (
            isHost ? (
              <Button
                title={t("htRematch")}
                icon="arrow.clockwise"
                onPress={() => getSocket().emit("ht:rematch", { grid: gridToIds(generateGrid()) })}
                style={{ marginTop: 18 }}
              />
            ) : (
              <Text style={[T.body, { textAlign: "center", marginTop: 18 }]}>{t("htWaitRematch")}</Text>
            )
          ) : null
        }
      />
    </Page>
  );
}

const styles = StyleSheet.create({
  codeCard: { alignItems: "center", gap: 14, padding: 24 },
  code: { fontFamily: F.black, fontSize: 56, letterSpacing: 6, color: C.text },
  player: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  playerDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  avatarMark: { fontFamily: F.black, fontSize: 20 },
});
