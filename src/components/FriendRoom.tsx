"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { dealRoomGrid, gridFromIds, type GridIds } from "@/lib/saudiGrid";
import { dict, type TKey } from "@/lib/strings";
import { gameSocket } from "@/lib/webSocket";
import { GridMatch, type Mark, type MatchRoom } from "./GridMatch";

/** A friend room on the app's `ht:*` server events: the server owns the turn, the clock and the result. */

interface Room extends MatchRoom {
  code: string;
  grid: GridIds;
  started: boolean;
  remainingMs: number;
  turnMs?: number;
  rematch?: { from: Mark | null; declined: boolean; open: boolean };
  players: { id: string; mark: Mark }[];
}

type RoomAnswer = { ok: boolean; error?: string; room?: Room };

const ACK_MS = 8000;
const NEXT_GAME_MS = 2000;
const COPIED_MS = 1500;

export function FriendRoom({ joinCode, locale, onClose, onEvent }: {
  joinCode: string | null;
  locale: "ar" | "en";
  onClose: () => void;
  onEvent: (event: "friend_create" | "friend_join" | "friend_series_end") => void;
}) {
  const t = (k: TKey) => dict[locale][k];
  const [room, setRoom] = useState<Room | null>(null);
  const [deadline, setDeadline] = useState(0);
  const [error, setError] = useState<TKey | null>(null);
  const [peerLeft, setPeerLeft] = useState(false);
  const [myId, setMyId] = useState("");
  const [copied, setCopied] = useState(false);
  const [peerAwayUntil, setPeerAwayUntil] = useState<number | null>(null);
  const [offline, setOffline] = useState(false);
  const code = useRef<string | null>(joinCode);

  useEffect(() => {
    const socket = gameSocket();
    const apply = (r: Room) => {
      setRoom(r);
      setDeadline(Date.now() + r.remainingMs);
    };
    const onUpdate = (r: Room) => {
      if (r.code !== code.current) return;
      setPeerLeft(false);
      apply(r);
    };
    const onPeerLeft = (r: Room) => {
      if (r.code !== code.current) return;
      setPeerLeft(true);
      apply(r);
    };
    const onConnect = () => {
      setMyId(socket.id ?? "");
      setOffline(false);
    };
    const onDisconnect = () => setOffline(true);
    const onPeerAway = (e: { game: string; away: boolean; ms?: number }) => {
      if (e.game === "ht") setPeerAwayUntil(e.away ? Date.now() + (e.ms ?? 0) : null);
    };
    // a new connection took over the seat: ask for the room as it stands
    const onSeatBack = () => socket.emit("ht:join", { code: code.current }, (res: RoomAnswer) => { if (res.room) apply(res.room); });
    const answered = (event: "friend_create" | "friend_join") => (err: Error | null, res?: RoomAnswer) => {
      if (err || !res) return setError("gulfNoServer");
      if (!res.ok || !res.room) return setError(res.error === "full" ? "roomFull" : "roomNotFound");
      code.current = res.room.code;
      setMyId(socket.id ?? "");
      apply(res.room);
      onEvent(event);
    };
    socket.on("ht:update", onUpdate);
    socket.on("ht:peer-left", onPeerLeft);
    socket.on("seat:back", onSeatBack);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("peer:away", onPeerAway);
    if (joinCode) socket.timeout(ACK_MS).emit("ht:join", { code: joinCode, nick: "" }, answered("friend_join"));
    else socket.timeout(ACK_MS).emit("ht:create", { nick: "", grid: dealRoomGrid(), steals: false, league: "sa" }, answered("friend_create"));
    return () => {
      socket.off("ht:update", onUpdate);
      socket.off("ht:peer-left", onPeerLeft);
      socket.off("seat:back", onSeatBack);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("peer:away", onPeerAway);
      socket.emit("ht:leave", { code: code.current });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const me = room?.players.find((p) => p.id === myId);
  const isHost = !!room && room.players[0]?.id === myId;
  const seriesOver = !!room?.series.over;

  // no lobby step on the site: the game starts as soon as the friend is in
  useEffect(() => {
    if (room && !room.started && !room.winner && room.players.length === 2 && isHost) gameSocket().emit("ht:start");
  }, [room, isHost]);

  // between games of a series the host deals the next grid
  const hasWinner = !!room?.winner;
  useEffect(() => {
    if (!hasWinner || seriesOver || !isHost || peerLeft) return;
    const id = setTimeout(() => gameSocket().emit("ht:rematch", { grid: dealRoomGrid() }), NEXT_GAME_MS);
    return () => clearTimeout(id);
  }, [hasWinner, seriesOver, isHost, peerLeft]);

  useEffect(() => {
    if (seriesOver) onEvent("friend_series_end");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesOver]);

  const grid = useMemo(() => (room ? gridFromIds(room.grid) : null), [room?.grid]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <section className="mt-6 rounded-2xl bg-white p-6 text-center shadow-sm">
        <p className="font-bold">{t(error)}</p>
        <button type="button" onClick={onClose} className="mt-4 min-h-12 w-full rounded-2xl bg-[#15803d] font-black text-white">{t("gulfBackToGrid")}</button>
      </section>
    );
  }

  if (!room) return <p className="mt-10 text-center text-[#56645c]">{t("waiting")}</p>;

  if (!room.started || !grid) {
    const link = `${location.origin}/?room=${room.code}${locale === "en" ? "&lang=en" : ""}`;
    const send = async () => {
      try {
        if (navigator.share) await navigator.share({ text: t("gulfInvite"), url: link });
        else {
          await navigator.clipboard.writeText(link);
          setCopied(true);
          setTimeout(() => setCopied(false), COPIED_MS);
        }
      } catch (e) {
        console.warn("share closed", e); // cancelling the share sheet lands here too
      }
    };
    return (
      <section className="mt-6 rounded-2xl bg-white p-6 text-center shadow-sm">
        {peerLeft && <p className="mb-2 font-bold text-red-700">{t("htPeerLeft")}</p>}
        <p className="text-[#56645c]">{t("gulfInvite")}</p>
        <p dir="ltr" className="mt-2 break-all text-sm font-bold">{link}</p>
        <button type="button" onClick={send} className="mt-4 min-h-12 w-full rounded-2xl bg-[#15803d] font-black text-white">{copied ? t("gulfLinkCopied") : t("gulfSendLink")}</button>
        <p className="mt-3 text-sm text-[#56645c]">{t("waiting")}</p>
        <button type="button" onClick={onClose} className="mt-2 min-h-11 text-sm font-bold text-[#56645c]">{t("gulfBackToGrid")}</button>
      </section>
    );
  }

  const myMark = me?.mark ?? "X";
  const rm = room.rematch;
  const incoming = !!rm?.from && rm.from !== myMark && !peerLeft;
  const outgoing = !!rm?.from && rm.from === myMark && !peerLeft;
  const canAsk = !peerLeft && !rm?.from && !rm?.declined && (isHost || !!rm?.open);
  const ask = () => gameSocket().emit(rm ? "ht:rematch-ask" : "ht:rematch", { grid: dealRoomGrid() });
  const reply = (accept: boolean) => gameSocket().emit("ht:rematch-reply", accept ? { accept, grid: dealRoomGrid() } : { accept });

  return (
    <GridMatch
      room={room}
      grid={grid}
      myMark={myMark}
      seated={!!me}
      deadline={deadline}
      locale={locale}
      opponentName={t("opponent")}
      peerLeft={peerLeft}
      offline={offline}
      peerAwayUntil={peerAwayUntil}
      onMove={(cell, name) => gameSocket().emit("ht:move", { cell, name })}
      onSkip={() => gameSocket().emit("ht:skip")}
      onForfeit={() => gameSocket().emit("ht:forfeit")}
      onClose={onClose}
    >
      {incoming && (
        <>
          <p className="mt-2 text-sm">{t("htRematchAsked").replace("{name}", t("opponent"))}</p>
          <button type="button" onClick={() => reply(true)} className="mt-3 min-h-12 w-full rounded-2xl bg-[#15803d] font-black text-white">{t("htAccept")}</button>
          <button type="button" onClick={() => reply(false)} className="mt-2 min-h-12 w-full rounded-2xl bg-[#ddf5e4] font-black text-[#14532d]">{t("htDecline")}</button>
        </>
      )}
      {!incoming && canAsk && <button type="button" onClick={ask} className="mt-3 min-h-12 w-full rounded-2xl bg-[#15803d] font-black text-white">{t("htRematch")}</button>}
      {!incoming && !canAsk && !peerLeft && <p className="mt-2 text-sm text-[#56645c]">{t(outgoing ? "htRematchWaiting" : rm?.declined ? "htRematchDeclined" : "htWaitRematch")}</p>}
    </GridMatch>
  );
}
