import * as Clipboard from "expo-clipboard";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Share, StyleSheet, View } from "react-native";


import { GameActions } from "~/components/GameActions";
import { EmoteButton, EmoteLayer, useEmotes } from "~/components/Emotes";
import { SeriesEnd } from "~/components/SeriesEnd";
import { HatTrickBoard, MARK } from "~/components/HatTrickBoard";
import { Text } from "~/components/Text";
import { WaitingAnimation } from "~/components/WaitingAnimation";
import { Button, Card, Icon, Page, Tap } from "~/components/ui";
import { haptic } from "~/lib/haptics";
import { useRecordMatch } from "~/lib/history";
import { gridFromIds, gridToIds, NEXT_GAME_MS, TURN_SECONDS, type HtCell, type Mark, type Winner } from "~/lib/hattrick";
import { useI18n } from "~/lib/i18n";
import { dealGrid } from "~/lib/league";
import { GAME_ICON, useDuelActivity, useLivePush } from "~/lib/liveActivity";
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
  flash: { mark: Mark; reason: "wrong" | "timeout" | "declined" | "skip" } | null;
  remainingMs: number;
  steals: Record<Mark, number> | null;
  used: string[];
  /** mark of the player with a pending draw offer */
  drawOffer: Mark | null;
  /** how a finished game ended, when it wasn't on the board */
  endReason: "forfeit" | "agreed" | null;
  /** game wins per mark this series; `over` once someone reaches `target` */
  series: { X: number; O: number; target: number; over: boolean };
  league: string;
  /** this turn's full length; mark with the comeback bonus this game */
  turnMs?: number;
  comeback?: Mark | null;
  /** every phone here knows "played with" criteria (server.js htAllKnowMates) */
  mates?: boolean;
  players: HtPlayer[];
}

/** Online Hat-trick room: waiting screen, then the shared board driven by the server. */
export default function HatTrickRoom() {
  const { t } = useI18n();
  const emotes = useEmotes("ht", true);
  // `random` is set when the room came from the random queue: offer a new match after the game
  const params = useLocalSearchParams<{ code: string; random?: string }>();
  const code = (params.code ?? "").toUpperCase();
  useLivePush("ht", code || null);
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

  // Between games of a series the host's phone deals the next grid after a short pause
  const seriesOver = room?.series?.over ?? false;
  const hostHere = room?.players[0]?.id === myId;
  const roomLeague = room?.league;
  // an older app in the room can't draw "played with" criteria
  const roomMates = room?.mates !== false;
  useEffect(() => {
    if (!room?.winner || seriesOver || !hostHere || peerLeft) return;
    const id = setTimeout(() => getSocket().emit("ht:rematch", { grid: gridToIds(dealGrid(roomLeague, roomMates)) }), NEXT_GAME_MS);
    return () => clearTimeout(id);
  }, [room?.winner, seriesOver, hostHere, peerLeft, roomLeague, roomMates]);

  const grid = useMemo(() => (room ? gridFromIds(room.grid) : null), [room?.grid]); // eslint-disable-line react-hooks/exhaustive-deps
  const me = room?.players.find((p) => p.id === myId);
  const isHost = room?.players[0]?.id === myId;
  const turnMs = room?.turnMs ?? TURN_SECONDS * 1000;
  const timeLeft = Math.min(turnMs / 1000, Math.max(0, Math.ceil((deadline - now) / 1000)));
  const opponent = room?.players.find((p) => p.id !== myId);
  // the series for Profile's recent matches
  const mineWon = me && room?.series ? room.series[me.mark] : 0;
  const theirsWon = me && room?.series ? room.series[me.mark === "X" ? "O" : "X"] : 0;
  useRecordMatch(seriesOver && !!me, {
    key: `ht-${code}-${[...(room?.grid?.rows ?? []), ...(room?.grid?.cols ?? [])].join(",")}`,
    game: "ht",
    opponent: opponent?.nick || t("opponent"),
    result: mineWon > theirsWon ? "win" : mineWon < theirsWon ? "loss" : "draw",
    score: `${mineWon}–${theirsWon}`,
  });

  // Lock Screen / Dynamic Island: whose turn, the clock, the series score
  useDuelActivity(
    room?.started && me
      ? {
          game: t("tikiTakaName"),
          icon: GAME_ICON.ht,
          me: me.mark,
          opponent: opponent?.nick || t("opponent"),
          turn: room.turn,
          winner: room.winner,
          matchOver: !!room.series?.over || peerLeft,
          score: { X: room.series?.X ?? 0, O: room.series?.O ?? 0 },
          since: deadline - turnMs,
          deadline,
          path: `/hat-trick/oda/${code}`,
        }
      : null
  );

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
  const f = room.flash;
  const flash = !f
    ? null
    : f.reason === "declined"
      ? f.mark === me?.mark
        ? t("htDrawDeclined")
        : null
      : `${nameOf(room.players.find((p) => p.mark === f.mark))}: ${t(f.reason === "wrong" ? "ttWrong" : f.reason === "skip" ? "htSkipped" : "ttTimeout")}`;
  const iWon = room.winner === me?.mark;
  const series = room.series;
  const score = me ? `${series[me.mark]} – ${series[me.mark === "X" ? "O" : "X"]}` : "";
  const winnerName = room.winner === "X" || room.winner === "O" ? nameOf(room.players.find((p) => p.mark === room.winner)) : "";
  const winnerText =
    room.endReason === "forfeit"
      ? t(iWon ? "htTheyForfeited" : "htYouForfeited")
      : series.over
        ? t(iWon ? "htSeriesWon" : "htSeriesLost")
        : room.winner === "draw"
          ? t(room.endReason === "agreed" ? "htDrawAgreed" : "htGameDraw")
          : `${winnerName} ${t("htTookGame")}`;
  const winnerSub = series.over ? score : `${score}, ${t("htNextGame")}`;
  const draw = !room.drawOffer || !me ? null : room.drawOffer === me.mark ? "sent" : "received";

  return (
    <Page>
      {/* a friend room shows its code (to share); a random match the game's name */}
      <Stack.Screen options={{ title: params.random ? t("tikiTakaName") : code, headerRight: () => <EmoteButton e={emotes} color={C.text} bg="#EEF2EF" /> }} />
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
        celebrate={iWon && series.over}
        winnerText={winnerText}
        winnerSub={winnerSub}
        series={series}
        turnSeconds={(room.turnMs ?? TURN_SECONDS * 1000) / 1000}
        comeback={room.comeback ?? null}
        onMove={(cell, name) => getSocket().emit("ht:move", { cell, name })}
        footer={
          room.winner && !series.over ? null : room.winner ? (
            <View style={{ marginTop: 18, gap: 10 }}>
              {isHost ? (
                <Button title={t("htRematch")} icon="arrow.clockwise" onPress={() => getSocket().emit("ht:rematch", { grid: gridToIds(dealGrid(room.league, room.mates !== false)) })} />
              ) : (
                <Text style={[T.body, { textAlign: "center" }]}>{t("htWaitRematch")}</Text>
              )}
              {params.random && <Button title={t("htNewGame")} kind="secondary" icon="play.fill" onPress={() => router.replace("/hat-trick/rastgele")} />}
            </View>
          ) : (
            <GameActions
              draw={draw}
              disabled={peerLeft}
              onOfferDraw={() => getSocket().emit("ht:draw-offer")}
              onReplyDraw={(accept) => getSocket().emit("ht:draw-reply", { accept })}
              onForfeit={() => getSocket().emit("ht:forfeit")}
              onSkip={() => getSocket().emit("ht:skip")}
              canSkip={myTurn}
            />
          )
        }
      />
      <SeriesEnd
        over={series.over}
        won={iWon}
        mine={me ? series[me.mark] : 0}
        theirs={me ? series[me.mark === "X" ? "O" : "X"] : 0}
        onRematch={isHost ? () => getSocket().emit("ht:rematch", { grid: gridToIds(dealGrid(room.league, room.mates !== false)) }) : null}
      />
      <EmoteLayer e={emotes} top={4} />
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
