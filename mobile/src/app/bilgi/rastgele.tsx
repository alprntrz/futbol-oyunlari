import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { quizQuestions } from "@/lib/quiz";

import { Text } from "~/components/Text";
import { RunningPlayer } from "~/components/RunningPlayer";
import { Button, Card, Page } from "~/components/ui";
import { useI18n } from "~/lib/i18n";
import { loadNick } from "~/lib/nick";
import { getSocket } from "~/lib/socket";
import { C, T } from "~/lib/theme";

/** Random quiz: get a seat in the open room, then wait for it there. */
export default function QuizRandom() {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const socket = getSocket();
    const enqueue = async () => {
      setError(null);
      socket.timeout(6000).emit("qz:queue", { nick: await loadNick(), questions: quizQuestions(10, "mixed") }, (err: Error | null, res?: { ok: boolean; code?: string }) => {
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
    <Page>
      <Stack.Screen options={{ title: t("qzName") }} />
      <Card style={{ alignItems: "center", paddingVertical: 32, gap: 14 }}>
        <RunningPlayer ground="rgba(21,128,61,0.35)" />
        <Text style={T.title}>{t("qzSearching")}</Text>
        {error && <Text style={[T.body, { color: C.red, fontWeight: "600" }]}>{error}</Text>}
      </Card>
      <View style={{ marginTop: 16 }}>
        <Button title={t("cancel")} kind="secondary" onPress={() => router.back()} />
      </View>
    </Page>
  );
}
