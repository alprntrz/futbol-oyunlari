"use client";

import { useCallback, useEffect, useState } from "react";
import type { GridPlayer } from "@/data/players";
import { searchPlayers as searchLatin } from "./tiki";

/** The Arabic search and names load apart from the page (about 170 KB gzipped). */
interface ArabicNames {
  search: (query: string, limit?: number) => GridPlayer[];
  names: Record<string, string>;
}

export function useArabicNames(locale: "ar" | "en") {
  const [arabic, setArabic] = useState<ArabicNames | null>(null);

  useEffect(() => {
    Promise.all([import("./playersAr"), import("@/data/players-ar")])
      .then(([search, data]) => setArabic({ search: search.searchPlayers, names: data.AR_PLAYERS }))
      .catch((e: unknown) => console.warn("Arabic names not loaded, Latin search only", e));
  }, []);

  const shown = useCallback(
    (name: string) => {
      if (locale !== "ar") return name;
      const all = arabic?.names[name]?.split("|");
      return all?.find((n) => n.includes(" ")) ?? all?.[0] ?? name;
    },
    [arabic, locale],
  );

  return { search: arabic?.search ?? searchLatin, shown, ready: !!arabic };
}
