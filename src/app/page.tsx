"use client";

import Link from "next/link";
import { Header } from "@/components/Header";
import { useI18n } from "@/lib/i18n";

export default function Home() {
  const { t } = useI18n();

  return (
    <div className="flex flex-1 flex-col items-center">
      <Header />
      <main className="flex w-full max-w-2xl flex-1 flex-col items-center gap-6 px-4 py-8">
        <h1
          className="text-center text-lg font-black uppercase text-white sm:text-xl"
          style={{ fontFamily: "var(--font-pixel), monospace" }}
        >
          ⚽ {t("appName")}
        </h1>

        <div className="grid w-full gap-4 sm:grid-cols-2">
          <Link
            href="/eksik-11"
            className="group rounded-2xl border-2 border-emerald-700 bg-emerald-900/40 p-6 transition hover:border-emerald-400"
          >
            <div className="text-4xl">🥅</div>
            <div className="mt-2 text-xl font-black text-white">{t("missingXI")}</div>
            <p className="mt-1 text-sm text-zinc-300">{t("missingXITagline")}</p>
            <div className="mt-3 flex gap-2">
              <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-bold text-white">
                {t("daily")}
              </span>
              <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-bold text-white">
                {t("onlineRace")}
              </span>
            </div>
          </Link>

          <Link
            href="/tiki-taka-toe"
            className="group rounded-2xl border-2 border-rose-800 bg-rose-950/30 p-6 transition hover:border-rose-400"
          >
            <div className="text-4xl">❌⭕</div>
            <div className="mt-2 text-xl font-black text-white">{t("tikiTakaName")}</div>
            <p className="mt-1 text-sm text-zinc-300">{t("tikiTakaTagline")}</p>
            <div className="mt-3">
              <span className="rounded-full bg-rose-600 px-2.5 py-0.5 text-xs font-bold text-white">
                {t("twoPlayers")}
              </span>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
