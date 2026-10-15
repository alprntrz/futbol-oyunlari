import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";

import { Page } from "~/components/ui";
import { WaitingRoom } from "~/components/WaitingRoom";
import { useI18n } from "~/lib/i18n";
import { getSocket } from "~/lib/socket";

interface DzRoom {
  started: boolean;
  players: { id: string; nick: string; side: 0 | 1 }[];
}

/** Card Duel friend room: share the code, the host starts once both are in, then the match screen takes over. */
export default function DuelRoom() {
  const { t } = useI18n();
  const code = (useLocalSearchParams<{ code: string }>().code ?? "").toUpperCase();
  const [room, setRoom] = useState<DzRoom | null>(null);
  const [peerLeft, setPeerLeft] = useState(false);
  const going = useRef(false);
  const myId = getSocket().id ?? "";

  useEffect(() => {
    const socket = getSocket();
    const onUpdate = (r: DzRoom) => {
      setRoom(r);
      setPeerLeft(false);
      if (r.started && !going.current) {
        // the match screen keeps the room (it syncs on mount); don't leave it here
        going.current = true;
        router.replace({ pathname: "/duello/mac", params: { mode: "room", code } });
      }
    };
    const onLeft = (r: DzRoom) => {
      setRoom(r);
      setPeerLeft(true);
    };
    socket.on("dz:update", onUpdate);
    socket.on("dz:peer-left", onLeft);
    socket.emit("dz:sync");
    return () => {
      socket.off("dz:update", onUpdate);
      socket.off("dz:peer-left", onLeft);
      if (!going.current) socket.emit("dz:leave");
    };
  }, [code]);

  const isHost = room?.players[0]?.id === myId;
  return (
    <Page>
      <Stack.Screen options={{ title: t("dzName") }} />
      <WaitingRoom
        code={code}
        players={(room?.players ?? []).map((p) => ({ id: p.id, mark: p.side === 0 ? "X" : "O" }))}
        nameOf={(p) => (p.id === myId ? t("you") : room?.players.find((x) => x.id === p.id)?.nick || t("opponent"))}
        isHost={isHost}
        inviteText={t("dzInvite")}
        peerLeft={peerLeft}
        onStart={() => getSocket().emit("dz:start")}
      />
    </Page>
  );
}
