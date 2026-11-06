"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import type { GridPlayer } from "@/data/players";
import { dailySeed, emptyCells, localDay, placePlayer, SA_TIME_LIMIT_MS, saudiGrid, scoreOf, squareCriteria, type Cells } from "@/lib/saudiGrid";
import { dict, type TKey } from "@/lib/strings";
import { GRID_PLAYERS, searchPlayers as searchLatin } from "@/lib/tiki";
import { track, type WebEvent, type WebEventProps } from "@/lib/webStats";
import { SaudiGridBoard } from "./SaudiGridBoard";

type SiteLocale = "ar" | "en";

interface Run {
  cells: Cells;
  deadline: number;
  finished: boolean;
  guessed: boolean;
}

/** The Arabic search and names load apart from the page (about 170 KB gzipped). */
interface ArabicNames {
  search: (query: string, limit?: number) => GridPlayer[];
  names: Record<string, string>;
}

const APP_STORE_URL = "https://apps.apple.com/app/id6821740252";
const LOCALE_KEY = "sa-locale";
const MIN_QUERY = 2;
const SEARCH_LIMIT = 6;
const SEARCH_SETTLE_MS = 1000;
const TOAST_MS = 1600;
const TICK_MS = 250;
const DAY_CHECK_MS = 60_000;
const ARABIC = /[؀-ۿ]/;

const runKey = (day: number) => `sa-grid-${day}`;
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const lastWord = (name: string) => name.trim().split(/\s+/).slice(-1)[0];

function stored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // storage blocked: play on, unsaved
  }
}

function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage blocked: play on, unsaved
  }
}

function firstLocale(): SiteLocale {
  const asked = new URLSearchParams(location.search).get("lang") ?? stored(LOCALE_KEY);
  return asked === "en" ? "en" : "ar";
}

const isRun = (r: Partial<Run> | null): r is Run =>
  !!r && Array.isArray(r.cells) && r.cells.length === 9 && r.cells.every(Array.isArray) && typeof r.deadline === "number" && typeof r.finished === "boolean";

function savedRun(day: number): Run | null {
  try {
    const run = JSON.parse(stored(runKey(day)) ?? "null") as Partial<Run> | null;
    return isRun(run) ? run : null;
  } catch {
    return null; // a broken save: start the day again
  }
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-1 text-center">
      <div dir="ltr" className="text-2xl font-black tabular-nums">{value}</div>
      <div className="text-xs text-[#56645c]">{label}</div>
    </div>
  );
}

export function SaudiGridSite() {
  const [locale, setLocale] = useState<SiteLocale>(firstLocale);
  const t = (k: TKey) => dict[locale][k];
  const [day] = useState(() => localDay());
  // null = today's shared grid (saved); a number = an extra random grid (not saved)
  const [seed, setSeed] = useState<number | null>(null);
  const grid = useMemo(() => saudiGrid(seed ?? dailySeed(day)), [seed, day]);
  const [run, setRun] = useState<Run | null>(() => savedRun(day));
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [arabic, setArabic] = useState<ArabicNames | null>(null);
  // set at once: the clock or a tap can land before the finished run is rendered
  const ended = useRef(false);
  const send = (event: WebEvent, props: WebEventProps = {}) => track(event, props, locale, day);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    store(LOCALE_KEY, locale);
  }, [locale]);

  useEffect(() => {
    track("landing_view", {}, firstLocale(), day);
    Promise.all([import("@/lib/playersAr"), import("@/data/players-ar")])
      .then(([search, data]) => setArabic({ search: search.searchPlayers, names: data.AR_PLAYERS }))
      .catch((e: unknown) => console.warn("Arabic names not loaded, Latin search only", e));
  }, [day]);

  useEffect(() => {
    if (run && seed === null) store(runKey(day), JSON.stringify(run));
  }, [run, seed, day]);

  const end = (how: "time" | "manual") => {
    if (!run || run.finished || ended.current) return;
    ended.current = true;
    setRun({ ...run, finished: true });
    send("game_finish", { ...scoreOf(run.cells), ended: Date.now() >= run.deadline ? "time" : how, practice: seed !== null });
  };

  // a tab left open past midnight moves to the new day, never in the middle of a game
  useEffect(() => {
    const id = setInterval(() => {
      if (localDay() !== day && (!run || run.finished)) location.reload();
    }, DAY_CHECK_MS);
    return () => clearInterval(id);
  }, [day, run]);

  useEffect(() => {
    if (!run || run.finished) return;
    const id = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= run.deadline) end("time");
    }, TICK_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(id);
  }, [toast]);

  const suggestions = useMemo(() => (arabic?.search ?? searchLatin)(query, SEARCH_LIMIT), [arabic, query]);

  // once the typing stops: was the name there? (never what was typed)
  useEffect(() => {
    if (query.trim().length < MIN_QUERY) return;
    if (ARABIC.test(query) && !arabic) return; // Arabic names still loading: "not found" would be false
    const id = setTimeout(() => track("search", { found: suggestions.length > 0, arabic: ARABIC.test(query) }, locale, day), SEARCH_SETTLE_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, suggestions, arabic, day]);

  const totalAnswers = useMemo(
    () => Array.from({ length: 9 }, (_, i) => squareCriteria(grid, i)).reduce((n, [r, c]) => n + GRID_PLAYERS.filter((p) => r.test(p) && c.test(p)).length, 0),
    [grid],
  );

  const shown = (name: string) => {
    if (locale !== "ar") return name;
    const all = arabic?.names[name]?.split("|");
    return all?.find((n) => n.includes(" ")) ?? all?.[0] ?? name;
  };
  const surname = (name: string) => lastWord(shown(name));

  const begin = (nextSeed: number | null) => {
    ended.current = false;
    setQuery("");
    setSeed(nextSeed);
    setNow(Date.now());
    setRun({ cells: emptyCells(), deadline: Date.now() + SA_TIME_LIMIT_MS, finished: false, guessed: false });
    send("game_start", { practice: nextSeed !== null });
  };

  const choose = (p: GridPlayer) => {
    if (!run || ended.current) return;
    setQuery("");
    if (!run.guessed) send("first_guess", { practice: seed !== null });
    const placed = placePlayer(run.cells, grid, p);
    setRun((r) => r && { ...r, guessed: true, cells: placePlayer(r.cells, grid, p).cells });
    if (placed.fits === 0) return setToast({ text: `${shown(p.name)}: ${t("bbWrong")}`, ok: false });
    if (placed.added === 0) return setToast({ text: `${shown(p.name)}: ${t("bbAlready")}`, ok: false });
    setToast({ text: `${shown(p.name)} +${placed.added}`, ok: true });
  };

  const { boxes, players } = scoreOf(run?.cells ?? emptyCells());
  const percent = totalAnswers ? Math.max(players ? 1 : 0, Math.round((players / totalAnswers) * 100)) : 0;
  const left = run ? Math.max(0, Math.ceil((run.deadline - now) / 1000)) : 0;

  const share = async () => {
    if (!run) return;
    send("share_tap");
    const squares = run.cells.map((c) => (c.length ? "🟩" : "⬜"));
    const rows = [0, 1, 2].map((r) => squares.slice(r * 3, r * 3 + 3).join("")).join("\n");
    const text = `${t("bbShareText")} #${day % 1000}\n${rows}\n${boxes}/9\n${location.origin}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else await navigator.clipboard.writeText(text);
    } catch (e) {
      console.warn("share closed", e); // cancelling the share sheet lands here too
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 pb-6 pt-3">
      <header className="flex items-center justify-between">
        <span dir="ltr" className="text-lg font-black text-[#15803d]">Tiktako</span>
        <button type="button" onClick={() => setLocale(locale === "ar" ? "en" : "ar")} className="min-h-11 rounded-full px-4 text-sm font-bold text-[#56645c]">
          {locale === "ar" ? "English" : "العربية"}
        </button>
      </header>

      <main className="flex-1">
        {!run && (
          <section className="py-4 text-center">
            <h1 className="text-3xl font-black leading-snug">{t("gulfTitle")}</h1>
            <p className="mt-2 text-[#56645c]">{t("gulfLead")}</p>
            <button type="button" onClick={() => begin(null)} className="mt-4 min-h-13 w-full rounded-2xl bg-[#15803d] text-lg font-black text-white">{t("bbKickOff")}</button>
            <p className="mt-3 text-start text-sm text-[#56645c]">{t("bbIntro")}</p>
          </section>
        )}

        {run && (
          <div className="mt-2 flex rounded-2xl bg-white p-3 shadow-sm">
            <Stat value={fmt(left)} label={run.finished && left === 0 ? t("bbTimeUp") : t("bbTime")} />
            <Stat value={`${boxes}/9`} label={t("bbBoxes")} />
            <Stat value={String(players)} label={t("bbPlayers")} />
            <Stat value={`${percent}%`} label={t("bbOfAll")} />
          </div>
        )}

        {run && !run.finished && (
          <div className="relative z-10 mt-3">
            <div className="flex gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && suggestions[0]) choose(suggestions[0]); }}
                placeholder={t("bbSearch")}
                aria-label={t("bbSearch")}
                autoComplete="off"
                autoCorrect="off"
                className="min-h-12 min-w-0 flex-1 rounded-2xl border border-[#e2e7e3] bg-white px-3 text-base outline-none focus:border-[#15803d]"
              />
              <button type="button" onClick={() => { if (window.confirm(t("bbFinishConfirm"))) end("manual"); }} className="min-h-12 rounded-2xl bg-white px-4 font-bold text-[#14532d] shadow-sm">{t("bbFinish")}</button>
            </div>
            {query.trim().length >= MIN_QUERY && (
              <ul className="absolute inset-x-0 top-14 max-h-64 overflow-auto rounded-2xl border border-[#e2e7e3] bg-white shadow-lg">
                {suggestions.length === 0 && <li className="p-3 text-center text-[#56645c]">{t("ttNoResult")}</li>}
                {suggestions.map((p) => (
                  <li key={p.name}>
                    <button type="button" onClick={() => choose(p)} className="min-h-11 w-full border-b border-[#f1f4f1] px-3 py-2 text-start font-bold">{shown(p.name)}</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div aria-live="polite" className="flex min-h-10 items-center justify-center">
          {toast && <span className={`rounded-xl px-3 py-1 text-sm font-bold ${toast.ok ? "bg-[#ddf5e4] text-[#14532d]" : "bg-red-100 text-red-700"}`}>{toast.text}</span>}
        </div>

        <SaudiGridBoard grid={grid} cells={run?.cells ?? emptyCells()} locale={locale} shown={surname} />

        {run?.finished && (
          <section className="mt-4 rounded-2xl bg-white p-5 text-center shadow-sm">
            <div className="text-5xl font-black">{players}</div>
            <div className="text-sm text-[#56645c]">{t("bbPlayersFound")}</div>
            <button type="button" onClick={() => begin(Math.floor(Math.random() * 1e9))} className="mt-4 min-h-12 w-full rounded-2xl bg-[#15803d] font-black text-white">{t("ttNewGrid")}</button>
            {seed === null && <button type="button" onClick={share} className="mt-2 min-h-12 w-full rounded-2xl bg-[#ddf5e4] font-black text-[#14532d]">{t("share")}</button>}
            {seed === null && <p className="mt-2 text-xs text-[#56645c]">{t("htSoloExtraLine")}</p>}
            {!/Android/.test(navigator.userAgent) && (
              <a href={APP_STORE_URL} onClick={() => send("store_click")} className="mt-3 block py-2 text-sm font-bold text-[#15803d] underline">{t("gulfStoreCta")}</a>
            )}
          </section>
        )}
      </main>

      <footer className="mt-6 text-center text-xs text-[#56645c]">
        <p>{t("gulfStatsNote")} <Link href="/privacy/" className="underline">{t("privacyPolicy")}</Link></p>
        <p className="mt-1">{t("gulfDisclaimer")}</p>
      </footer>
    </div>
  );
}
