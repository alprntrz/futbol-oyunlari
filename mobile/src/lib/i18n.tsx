import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState } from "react";

import { dict, type Locale, type TKey } from "@/lib/strings";

const KEY = "locale";

const I18nContext = createContext<{
  locale: Locale;
  t: (k: TKey) => string;
  setLocale: (l: Locale) => void;
}>({ locale: "tr", t: (k) => k, setLocale: () => {} });

function deviceLocale(): Locale {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale.startsWith("tr") ? "tr" : "en";
  } catch {
    return "tr";
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(deviceLocale);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((saved) => {
      if (saved === "tr" || saved === "en") setLocaleState(saved);
    });
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    AsyncStorage.setItem(KEY, l);
  };

  const t = (k: TKey) => dict[locale][k];

  return <I18nContext.Provider value={{ locale, t, setLocale }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
