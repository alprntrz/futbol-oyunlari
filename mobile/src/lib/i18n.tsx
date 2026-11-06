import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Updates from "expo-updates";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { DevSettings, I18nManager } from "react-native";

import { dict, localeOfTag, type Locale, type TKey } from "@/lib/strings";

const KEY = "locale";
const RTL_TRIED = "rtl-reload";

const I18nContext = createContext<{
  locale: Locale;
  t: (k: TKey) => string;
  setLocale: (l: Locale) => void;
}>({ locale: "tr", t: (k) => k, setLocale: () => {} });

function deviceLocale(): Locale {
  try {
    return localeOfTag(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    return "tr";
  }
}

/**
 * Layout direction is fixed for a JS run, so a change means a reload. One try per direction:
 * Expo Go ignores forceRTL, and without this it would reload forever. forceRTL is saved
 * natively, so if the reload fails the direction still applies from the next launch.
 */
async function syncDirection(locale: Locale) {
  const rtl = locale === "ar";
  if (I18nManager.isRTL === rtl) return AsyncStorage.removeItem(RTL_TRIED);
  const target = rtl ? "rtl" : "ltr";
  if ((await AsyncStorage.getItem(RTL_TRIED)) === target) return;
  await AsyncStorage.setItem(RTL_TRIED, target);
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
  if (__DEV__) DevSettings.reload(); // reloadAsync does nothing in a debug build
  else await Updates.reloadAsync();
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(deviceLocale);

  const picked = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((saved) => {
      if (picked.current) return;
      const known = saved === "tr" || saved === "en" || saved === "ar";
      if (known) setLocaleState(saved);
      syncDirection(known ? saved : deviceLocale()).catch(() => {});
    });
  }, []);

  const setLocale = (l: Locale) => {
    picked.current = true;
    setLocaleState(l);
    AsyncStorage.setItem(KEY, l).then(() => syncDirection(l)).catch(() => {});
  };

  const t = (k: TKey) => dict[locale][k];

  return <I18nContext.Provider value={{ locale, t, setLocale }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
