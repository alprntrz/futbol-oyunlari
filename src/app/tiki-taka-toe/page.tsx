"use client";

import Link from "next/link";
import { Header } from "@/components/Header";
import { TikiTakaToe } from "@/components/TikiTakaToe";
import { useI18n } from "@/lib/i18n";

export default function TikiTakaTogePage() {
  const { t } = useI18n();
  return (
    <div className="flex flex-1 flex-col items-center">
      <Header />
      <main className="flex w-full max-w-lg flex-1 flex-col items-center px-3 pb-10">
        <nav className="mb-4 flex flex-wrap items-center justify-center gap-2 text-sm">
          <Link href="/" className="rounded-full border border-zinc-600 px-3 py-1 font-bold text-zinc-300 hover:bg-zinc-800">
            ⚽ {t("appName")}
          </Link>
          <Link href="/eksik-11" className="rounded-full border border-zinc-600 px-3 py-1 font-bold text-zinc-300 hover:bg-zinc-800">
            🥅 {t("missingXI")}
          </Link>
          <span className="rounded-full bg-indigo-600 px-3 py-1 font-bold text-white">❌⭕ {t("tikiTakaName")}</span>
        </nav>

        <h1 className="mb-1 text-center text-lg font-black text-white">❌⭕ {t("tikiTakaName")}</h1>
        <p className="mb-4 text-center text-xs text-zinc-400">{t("tikiTakaTagline")}</p>

        <TikiTakaToe />
      </main>
    </div>
  );
}
