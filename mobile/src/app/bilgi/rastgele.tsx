import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { quizQuestions } from "@/lib/quiz";

import { RunningPlayer } from "~/components/RunningPlayer";
import { goBack, NIGHT, StadiumHeader, NightStatusBar } from "~/components/StadiumHeader";
import { Text } from "~/components/Text";
import { Icon } from "~/components/ui";
import { useI18n } from "~/lib/i18n";
import { loadNick, loadPlayerId } from "~/lib/nick";
import { getSocket } from "~/lib/socket";
import { F } from "~/lib/theme";

const HEADER = 150;

/**
 * Random quiz: get a seat in the open room, then hand over to the room screen.
 * Drawn exactly like the room's waiting state so the hand-over doesn't show.
 */
export default function QuizRandom() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const socket = getSocket();
    const enqueue = async () => {
      setError(null);
      socket.timeout(6000).emit("qz:queue", { nick: await loadNick(), pid: await loadPlayerId(), questions: quizQuestions(10, "mixed") }, (err: Error | null, res?: { ok: boolean; code?: string }) => {
        if (err || !res?.ok || !res.code) return setError(t("serverUnreachable"));
        router.replace({ pathname: "/bilgi/oda/[code]", params: { code: res.code, random: "1" } });
      });
    };
    const onError = () => setError(t("serverUnreachable"));
    socket.on("connect_error", onError);
    if (socket.connected) enqueue();
    else socket.once("connect", enqueue);
    return () => {
      socket.off("connect_error", onError);
      socket.off("connect", enqueue);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false, animation: "fade", contentStyle: { backgroundColor: NIGHT.body } }} />
      <NightStatusBar />
      <StadiumHeader height={HEADER} runners={[]} />
      <Pressable onPress={() => goBack()} style={[styles.back, { top: insets.top + 6 }]} accessibilityRole="button" accessibilityLabel={t("cancel")} hitSlop={8}>
        <Icon name="chevron.left" size={18} color={NIGHT.ink} fallback="‹" />
      </Pressable>
      <View style={{ paddingTop: insets.top + HEADER + 14, alignItems: "center", gap: 6, paddingHorizontal: 16 }}>
        <RunningPlayer shirt={NIGHT.kit.shirt} shorts={NIGHT.kit.shorts} />
        <Text style={styles.big}>{t("qzSearching")}</Text>
        <Text style={styles.sub}>{error ?? t("qzSearchingDesc")}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: NIGHT.body },
  back: { position: "absolute", left: 12, zIndex: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: NIGHT.raised, alignItems: "center", justifyContent: "center" },
  big: { fontFamily: F.black, fontSize: 30, lineHeight: 34, color: NIGHT.ink, textAlign: "center" },
  sub: { fontSize: 15, color: NIGHT.ink2, fontWeight: "500", textAlign: "center" },
});
