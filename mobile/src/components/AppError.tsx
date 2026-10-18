import { router, type ErrorBoundaryProps } from "expo-router";
import { useEffect } from "react";
import { Image, Linking, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { rootStrings, reportCrash } from "~/lib/appHealth";
import { BRAND } from "~/lib/brand";
import { useI18n } from "~/lib/i18n";
import { captureCrash } from "~/lib/sentry";
import { C, F } from "~/lib/theme";

import { Text } from "./Text";
import { Button } from "./ui";

/**
 * A screen threw while drawing: instead of a white screen, say so, send an anonymous report
 * (lib/appHealth.ts, and to Sentry: lib/sentry.ts) and offer to try again or go Home. Drawn outside the i18n provider, so it
 * reads the phone's language itself.
 */
export function AppErrorScreen({ error, retry }: ErrorBoundaryProps) {
  const s = rootStrings();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    let screen = "?";
    try {
      screen = router.canGoBack() ? "nested" : "root";
    } catch {}
    reportCrash(error, screen);
    captureCrash(error, screen);
  }, [error]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.middle}>
        <Image source={BRAND.illus.finish} style={styles.art} resizeMode="contain" />
        <Text style={styles.title}>{s.errTitle}</Text>
        <Text style={styles.body}>{s.errBody}</Text>
      </View>
      <View style={{ gap: 10 }}>
        <Button title={s.errRetry} icon="arrow.clockwise" onPress={retry} />
        <Button
          title={s.errHome}
          kind="secondary"
          onPress={() => {
            try {
              router.replace("/");
            } catch {}
            retry();
          }}
        />
      </View>
    </View>
  );
}

/** This version is older than the server serves (server-app.js MIN_APP_VERSION): update from the store. */
export function UpdateRequired({ store }: { store: string }) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.middle}>
        <Image source={BRAND.wordmark} style={{ width: 150, height: 40 }} resizeMode="contain" />
        <Text style={styles.title}>{t("updTitle")}</Text>
        <Text style={styles.body}>{t("updBody")}</Text>
      </View>
      {!!store && <Button title={t("updButton")} icon="arrow.down.circle.fill" onPress={() => Linking.openURL(store)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 24 },
  middle: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  art: { width: 220, height: 130 },
  title: { fontFamily: F.display, fontSize: 32, lineHeight: 34, color: C.text, textAlign: "center" },
  body: { fontSize: 17, lineHeight: 24, color: C.text2, textAlign: "center" },
});
