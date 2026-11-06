"use client";

import dynamic from "next/dynamic";
import { dict } from "@/lib/strings";

/** The Arabic headline paints from the static HTML while the player data loads. */
function Loading() {
  return (
    <main className="mx-auto max-w-md px-4 py-10 text-center">
      <h1 className="text-3xl font-black leading-snug">{dict.ar.gulfTitle}</h1>
      <p className="mt-2 text-[#56645c]">{dict.ar.gulfLead}</p>
    </main>
  );
}

// client only: the grid depends on the visitor's date, so it can't be baked into the HTML
export const SaudiGridLoader = dynamic(() => import("./SaudiGridSite").then((m) => m.SaudiGridSite), { ssr: false, loading: Loading });
