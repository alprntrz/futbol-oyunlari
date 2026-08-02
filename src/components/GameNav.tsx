"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { dayNumber } from "@/lib/daily";

export type GameNavKey = "daily" | "practice" | "turkiye" | "race";

const ITEMS: { key: GameNavKey; href: string }[] = [
  { key: "daily", href: "/eksik-11" },
  { key: "practice", href: "/eksik-11/pratik" },
  { key: "turkiye", href: "/eksik-11/turkiye" },
  { key: "race", href: "/eksik-11/oda" },
];

export function GameNav({ active }: { active: GameNavKey }) {
  const { t } = useI18n();

  const label = (key: GameNavKey) => {
    switch (key) {
      case "daily":
        return `${t("daily")}${active === "daily" ? ` #${dayNumber() % 1000}` : ""}`;
      case "practice":
        return t("practice");
      case "turkiye":
        return `🇹🇷 ${t("turkishTeams")}`;
      case "race":
        return t("onlineRace");
    }
  };

  return (
    <nav className="mb-4 flex flex-wrap items-center justify-center gap-2 text-sm">
      {ITEMS.map(({ key, href }) =>
        key === active ? (
          <span key={key} className="rounded-full bg-indigo-600 px-3 py-1 font-bold text-white">
            {label(key)}
          </span>
        ) : (
          <Link
            key={key}
            href={href}
            className="rounded-full border border-zinc-600 px-3 py-1 font-bold text-zinc-300 hover:bg-zinc-800"
          >
            {label(key)}
          </Link>
        )
      )}
    </nav>
  );
}
