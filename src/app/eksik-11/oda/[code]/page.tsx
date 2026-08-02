"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { MissingXIGame, type GameProgress } from "@/components/MissingXIGame";
import { getMatchById } from "@/data/matches";
import { useI18n } from "@/lib/i18n";
import { getSocket } from "@/lib/socket";
import type { Difficulty } from "@/lib/types";

interface PublicPlayer {
  id: string;
  nick: string;
  solved: number;
  failed: number;
  totalGuesses: number;
  done: boolean;
  won: boolean;
  isHost: boolean;
}

interface PublicRoom {
  code: string;
  difficulty: Difficulty;
  matchId: string;
  started: boolean;
  players: PublicPlayer[];
}

export default function RoomPage() {
  const { t } = useI18n();
  const params = useParams<{ code: string }>();
  const code = (params.code || "").toUpperCase();
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [raceResult, setRaceResult] = useState<{ winnerId: string | null; room: PublicRoom } | null>(null);
  const [myId, setMyId] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const joinedRef = useRef(false);

  useEffect(() => {
    const socket = getSocket();

    const onUpdate = (r: PublicRoom) => setRoom(r);
    const onOver = (res: { winnerId: string | null; room: PublicRoom }) => {
      setRaceResult(res);
      setRoom(res.room);
    };
    const onPeerLeft = (r: PublicRoom) => {
      setRoom(r);
      if (!r.started) setError(null);
    };

    socket.on("room:update", onUpdate);
    socket.on("race:over", onOver);
    socket.on("room:peer-left", onPeerLeft);
    socket.on("connect", () => setMyId(socket.id ?? ""));
    if (socket.id) setMyId(socket.id);

    // If we landed here without already being in the room (e.g. direct link), join now
    if (!joinedRef.current) {
      joinedRef.current = true;
      const nick = sessionStorage.getItem("nick") || "";
      const already = sessionStorage.getItem("joined-" + code) === "1";
      socket.emit(
        "room:join",
        { code, nick },
        (res: { ok: boolean; error?: string; room?: PublicRoom }) => {
          if (res.ok && res.room) setRoom(res.room);
          else if (!already)
            setError(res.error === "full" ? t("roomFull") : t("roomNotFound"));
        }
      );
    }

    return () => {
      socket.off("room:update", onUpdate);
      socket.off("race:over", onOver);
      socket.off("room:peer-left", onPeerLeft);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const match = room ? getMatchById(room.matchId) : null;
  const me = room?.players.find((p) => p.id === myId);
  const opponent = room?.players.find((p) => p.id !== myId);

  const onProgress = (p: GameProgress) => {
    getSocket().emit("race:progress", p);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center">
        <Header />
        <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
          <div className="text-lg font-bold text-red-400">{error}</div>
          <Link href="/eksik-11/oda" className="rounded-xl bg-indigo-600 px-6 py-3 font-black text-white">
            ← {t("onlineRace")}
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center">
      <Header />
      <main className="flex w-full max-w-lg flex-1 flex-col items-center px-3 pb-10">
        {/* Room code + status bar */}
        <div className="mb-3 flex w-full items-center justify-between rounded-xl border border-zinc-700 bg-zinc-900/70 px-4 py-2">
          <button onClick={copyCode} className="font-mono text-xl font-black tracking-widest text-emerald-300">
            {code} {copied ? "✓" : "⧉"}
          </button>
          <div className="flex items-center gap-3 text-sm">
            {room?.players.map((p) => (
              <div key={p.id} className="flex items-center gap-1">
                <span className={`h-2 w-2 rounded-full ${p.done ? "bg-zinc-500" : "bg-emerald-400"}`} />
                <span className="font-bold text-white">
                  {p.id === myId ? t("you") : p.nick || t("opponent")}
                </span>
                <span className="font-mono text-emerald-300">{p.solved}/11</span>
              </div>
            ))}
          </div>
        </div>

        {!room?.started ? (
          <div className="flex w-full flex-col items-center gap-4 py-10">
            <div className="animate-pulse text-lg font-bold text-zinc-300">
              {room && room.players.length < 2 ? t("waiting") : null}
            </div>
            {room && room.players.length >= 2 && me?.isHost && (
              <button
                onClick={() => getSocket().emit("room:start")}
                className="rounded-xl bg-emerald-600 px-8 py-3 text-lg font-black text-white hover:bg-emerald-500"
              >
                ▶ {t("start")}
              </button>
            )}
            {room && room.players.length >= 2 && !me?.isHost && (
              <div className="text-sm text-zinc-400">…</div>
            )}
            <div className="text-sm text-zinc-500">
              {t("roomCode")}: <b className="text-white">{code}</b>
            </div>
          </div>
        ) : match ? (
          <>
            {raceResult && (
              <div
                className={`mb-3 w-full rounded-xl p-3 text-center text-lg font-black ${
                  raceResult.winnerId === null
                    ? "bg-amber-600/30 text-amber-300"
                    : raceResult.winnerId === myId
                      ? "bg-emerald-600/30 text-emerald-300"
                      : "bg-red-600/30 text-red-300"
                }`}
              >
                {raceResult.winnerId === null
                  ? t("raceTie")
                  : raceResult.winnerId === myId
                    ? t("raceWin")
                    : t("raceLose")}
              </div>
            )}
            <MissingXIGame
              match={match}
              difficulty={room.difficulty}
              onProgress={onProgress}
              headerExtra={
                opponent ? (
                  <div className="mt-1 text-xs text-zinc-400">
                    {t("opponent")}: <b className="text-white">{opponent.nick}</b>{" "}
                    <span className="font-mono text-emerald-300">{opponent.solved}/11</span>
                    {" · "}
                    {t("totalGuesses").toLowerCase()}: {opponent.totalGuesses}
                  </div>
                ) : null
              }
            />
          </>
        ) : null}
      </main>
    </div>
  );
}
