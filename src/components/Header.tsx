"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

export function Header({ right }: { right?: React.ReactNode }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <header className="flex w-full items-center justify-between px-4 py-3">
      <Link
        href="/"
        className="text-lg font-black uppercase tracking-widest text-white"
        style={{ fontFamily: "var(--font-pixel), monospace" }}
      >
        ⚽ {t("appName")}
      </Link>
      <div className="flex items-center gap-2">
        {right}
        <button
          onClick={() => setLocale(locale === "tr" ? "en" : "tr")}
          className="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs font-bold text-zinc-300 hover:bg-zinc-800"
        >
          {locale === "tr" ? "EN" : "TR"}
        </button>
      </div>
    </header>
  );
}
