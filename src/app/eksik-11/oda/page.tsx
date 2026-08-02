"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GameNav } from "@/components/GameNav";
import { Header } from "@/components/Header";
import { useI18n } from "@/lib/i18n";
import { randomMatch } from "@/lib/daily";
import { getSocket } from "@/lib/socket";
import type { Difficulty } from "@/lib/types";

export default function RoomLobby() {
  const { t } = useI18n();
  const router = useRouter();
  const [nick, setNick] = useState("");
  const [code, setCode] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = () => {
    setBusy(true);
    const socket = getSocket();
    socket.emit(
      "room:create",
      { nick, difficulty, matchId: randomMatch().id },
      (res: { ok: boolean; room?: { code: string } }) => {
        setBusy(false);
        if (res.ok && res.room) {
          sessionStorage.setItem("nick", nick);
          router.push(`/eksik-11/oda/${res.room.code}`);
        }
      }
    );
  };

  const join = () => {
    if (!code.trim()) return;
    setBusy(true);
    const socket = getSocket();
    socket.emit(
      "room:join",
      { code: code.trim().toUpperCase(), nick },
      (res: { ok: boolean; error?: string; room?: { code: string } }) => {
        setBusy(false);
        if (res.ok && res.room) {
          sessionStorage.setItem("nick", nick);
          sessionStorage.setItem("joined-" + res.room.code, "1");
          router.push(`/eksik-11/oda/${res.room.code}`);
        } else {
          setError(res.error === "full" ? t("roomFull") : t("roomNotFound"));
        }
      }
    );
  };

  return (
    <div className="flex flex-1 flex-col items-center">
      <Header />
      <main className="flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6">
        <GameNav active="race" />
        <h1 className="text-center text-xl font-black text-white">
          🏁 {t("onlineRace")}
        </h1>
        <p className="text-center text-sm text-zinc-400">{t("raceDesc")}</p>

        <input
          value={nick}
          onChange={(e) => setNick(e.target.value)}
          placeholder={t("yourName")}
          maxLength={20}
          className="rounded-xl border border-zinc-600 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-500 focus:border-indigo-400 focus:outline-none"
        />

        <div className="rounded-2xl border border-zinc-700 bg-zinc-900/60 p-4">
          <div className="mb-2 text-sm font-bold text-zinc-300">{t("createRoom")}</div>
          <div className="mb-3 flex gap-2">
            {(["normal", "hard"] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold ${
                  difficulty === d
                    ? d === "normal"
                      ? "bg-indigo-600 text-white"
                      : "bg-rose-600 text-white"
                    : "bg-zinc-800 text-zinc-400"
                }`}
              >
                {t(d)}
              </button>
            ))}
          </div>
          <button
            onClick={create}
            disabled={busy}
            className="w-full rounded-xl bg-emerald-600 py-3 font-black text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {t("createRoom")}
          </button>
        </div>

        <div className="rounded-2xl border border-zinc-700 bg-zinc-900/60 p-4">
          <div className="mb-2 text-sm font-bold text-zinc-300">{t("joinRoom")}</div>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError(null);
              }}
              placeholder={t("roomCode")}
              maxLength={5}
              className="min-w-0 flex-1 rounded-xl border border-zinc-600 bg-zinc-950 px-4 py-3 font-mono text-lg tracking-widest text-white placeholder-zinc-600 focus:border-indigo-400 focus:outline-none"
            />
            <button
              onClick={join}
              disabled={busy}
              className="rounded-xl bg-indigo-600 px-6 font-black text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {t("joinRoom")}
            </button>
          </div>
          {error && <div className="mt-2 text-sm font-bold text-red-400">{error}</div>}
        </div>
      </main>
    </div>
  );
}
