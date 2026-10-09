"use client";

import { createContext, useContext, useEffect, useState } from "react";

import { dict, type Locale, type TKey } from "./strings";

export type { Locale, TKey };

const I18nContext = createContext<{
  locale: Locale;
  t: (k: TKey) => string;
  setLocale: (l: Locale) => void;
}>({ locale: "tr", t: (k) => k, setLocale: () => {} });

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("tr");

  useEffect(() => {
    const saved = localStorage.getItem("locale") as Locale | null;
    if (saved === "tr" || saved === "en") setLocaleState(saved);
    else if (!navigator.language.startsWith("tr")) setLocaleState("en");
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("locale", l);
  };

  const t = (k: TKey) => dict[locale][k];

  return (
    <I18nContext.Provider value={{ locale, t, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
