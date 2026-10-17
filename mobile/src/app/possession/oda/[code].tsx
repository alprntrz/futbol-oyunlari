import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";

import { XP } from "@/lib/levels";

import { PossessionBoard } from "~/components/PossessionBoard";
import { EmoteButton, EmoteLayer, useEmotes } from "~/components/Emotes";
import { ConnectionBanner } from "~/components/ConnectionBanner";
import { Text } from "~/components/Text";
import { WaitingRoom } from "~/components/WaitingRoom";
import { Button, Card, Icon, Page } from "~/components/ui";
import { haptic } from "~/lib/haptics";
import { useRecordMatch } from "~/lib/history";
import type { Mark } from "~/lib/hattrick";
import { useI18n } from "~/lib/i18n";
import { GAME_ICON, useDuelActivity, useLivePush } from "~/lib/liveActivity";
import { boardFromIds, boardToIds, claimsFor, generateBoard, type PpCell } from "~/lib/possession";
import { getNick } from "~/lib/raceSession";
import { getSocket } from "~/lib/socket";
import { C, T } from "~/lib/theme";
import { useXpAward } from "~/lib/xp";

interface PpPlayer {
  id: string;
  nick: string;
  mark: Mark;
}
interface PpRoom {
  code: string;
  board: string[];
  started: boolean;
  owners: (PpCell | null)[];
  turn: Mark;
  /** ms left per player at the time of the update */
  clocks: Record<Mark, number>;
  winner: Mark | "draw" | null;
  flash: { mark: Mark; reason: "wrong" | "timeout" | "claim"; name?: string; count?: number; stolen?: number } | null;
  used: string[];
  players: PpPlayer[];
}

/** Online Possession Play room: waiting screen, then the shared hex board driven by the server. */
export default function PossessionRoom() {
  const { t } = useI18n();
  const emotes = useEmotes("pp", true);
  const params = useLocalSearchParams<{ code: string; random?: string }>();
  const code = (params.code ?? "").toUpperCase();
  useLivePush("pp", code || null);
  const [room, setRoom] = useState<PpRoom | null>(null);
  const [receivedAt, setReceivedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [peerLeft, setPeerLeft] = useState(false);
  const [myId, setMyId] = useState(() => getSocket().id ?? "");

  // each game in the room (a rematch deals a new board) pays once
  const myMark = room?.players.find((p) => p.id === myId)?.mark;
  useXpAward(
    !!room?.winner && !!myMark,
    room ? `pp-${code}-${room.board.slice(0, 4).join(",")}` : null,
    "pp",
    room?.winner === "draw" ? XP.ppDraw : room?.winner === myMark ? XP.ppWin : XP.ppLoss
  );
  const held = (m?: string) => room?.owners.filter((o) => o?.mark === m).length ?? 0;
  useRecordMatch(!!room?.winner && !!myMark, {
    key: room ? `pp-${code}-${room.board.slice(0, 4).join(",")}` : "pp",
    game: "pp",
    opponent: room?.players.find((p) => p.id !== myId)?.nick || t("opponent"),
    result: room?.winner === "draw" ? "draw" : room?.winner === myMark ? "win" : "loss",
    score: `${held(myMark)}–${held(myMark === "X" ? "O" : "X")}`,
  });

  useEffect(() => {
    const socket = getSocket();
    const apply = (r: PpRoom) => {
      setRoom((prev) => {
        if (prev && r.owners.filter(Boolean).length !== prev.owners.filter(Boolean).length) haptic.tap();
        return r;
      });
      setReceivedAt(Date.now());
    };
    const onUpdate = (r: PpRoom) => {
      setPeerLeft(false);
      apply(r);
    };
    const onPeerLeft = (r: PpRoom) => {
      setPeerLeft(true);
      apply(r);
    };
    const onConnect = () => setMyId(socket.id ?? "");
    socket.on("pp:update", onUpdate);
    socket.on("pp:peer-left", onPeerLeft);
    socket.on("connect", onConnect);
    socket.emit("pp:join", { code, nick: getNick() }, (res: { ok: boolean; error?: string; room?: PpRoom }) => {
      if (res.ok && res.room) apply(res.room);
      else setError(res.error === "full" ? t("roomFull") : t("roomNotFound"));
    });
    return () => {
      socket.off("pp:update", onUpdate);
      socket.off("pp:peer-left", onPeerLeft);
      socket.off("connect", onConnect);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  useEffect(() => {
    if (!room?.started || room.winner) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [room?.started, room?.winner]);

  const board = useMemo(() => (room ? boardFromIds(room.board) : null), [room?.board]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lock Screen / Dynamic Island: whose move, the mover's chess clock, hexes held
  const rival = room?.players.find((p) => p.id !== myId);
  useDuelActivity(
    room?.started && myMark
      ? {
          game: t("ppName"),
          icon: GAME_ICON.pp,
          me: myMark,
          opponent: rival?.nick || t("opponent"),
          turn: room.turn,
          winner: room.winner,
          matchOver: !!room.winner || peerLeft,
          score: { X: room.owners.filter((o) => o?.mark === "X").length, O: room.owners.filter((o) => o?.mark === "O").length },
          since: receivedAt,
          deadline: receivedAt + room.clocks[room.turn],
          path: `/possession/oda/${room.code}`,
        }
      : null
  );

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

  const me = room?.players.find((p) => p.id === myId);
  const isHost = room?.players[0]?.id === myId;
  const nameOf = (p?: { id: string; nick?: string }) => (p ? (p.id === myId ? t("you") : (p as PpPlayer).nick || t("opponent")) : "…");

  if (!room || !room.started || !board) {
    return (
      <Page>
        <Stack.Screen options={{ title: t("ppName") }} />
        <WaitingRoom
          code={code}
          players={room?.players ?? []}
          nameOf={(p) => nameOf(room?.players.find((x) => x.id === p.id))}
          isHost={isHost}
          inviteText={t("ppInvite")}
          peerLeft={peerLeft}
          onStart={() => getSocket().emit("pp:start")}
        />
      </Page>
    );
  }

  const elapsed = room.winner ? 0 : now - receivedAt;
  const secs = (m: Mark) => Math.max(0, Math.ceil((room.clocks[m] - (m === room.turn ? elapsed : 0)) / 1000));
  const labels = { X: nameOf(room.players.find((p) => p.mark === "X")), O: nameOf(room.players.find((p) => p.mark === "O")) };
  const myTurn = !!me && room.turn === me.mark && !room.winner;
  const f = room.flash;
  const who = f ? nameOf(room.players.find((p) => p.mark === f.mark)) : "";
  const flash = !f
    ? null
    : f.reason === "claim"
      ? `${who}: ${f.name} +${f.count} ${t("ppClaimed")}${f.stolen ? `, ${f.stolen} ${t("ppStoleShort")}` : ""}`
      : `${who}: ${t(f.reason === "wrong" ? "ttWrong" : "ppTimeout")}`;

  return (
    <>
      <Page>
        {/* a friend room shows its code (to share); a random match the game's name */}
        <Stack.Screen options={{ title: params.random ? t("ppName") : code, headerRight: () => <EmoteButton e={emotes} color={C.text} bg="#EEF2EF" /> }} />
        {peerLeft && <Text style={[T.body, { color: C.red, textAlign: "center", marginBottom: 10 }]}>{t("htPeerLeft")}</Text>}
        <PossessionBoard
          board={board}
          owners={room.owners}
          usedNames={room.used}
          turn={room.turn}
          clocks={{ X: secs("X"), O: secs("O") }}
          labels={labels}
          canMove={myTurn && !peerLeft}
          winner={room.winner}
          winnerText={room.winner === "draw" ? t("ttDraw") : room.winner === me?.mark ? t("htYouWin") : t("htYouLose")}
          status={myTurn ? t("ppYourTurn") : t("htTheirTurn")}
          flash={flash}
          celebrate={room.winner === me?.mark}
          onMove={(hex, player) => {
            if (!me) return;
            getSocket().emit(
              "pp:move",
              player ? { name: player.name, claims: claimsFor(hex, (c) => c.test(player), board, room.owners, me.mark) } : { name: null }
            );
          }}
          footer={
            room.winner ? (
              isHost ? (
                <Button
                  title={t("htRematch")}
                  icon="arrow.clockwise"
                  onPress={() => getSocket().emit("pp:rematch", { board: boardToIds(generateBoard()) })}
                  style={{ marginTop: 16 }}
                />
              ) : (
                <Text style={[T.body, { textAlign: "center", marginTop: 16 }]}>{t("htWaitRematch")}</Text>
              )
            ) : null
          }
        />
        <EmoteLayer e={emotes} top={4} />
      </Page>
      <ConnectionBanner game="pp" />
    </>
  );
}
