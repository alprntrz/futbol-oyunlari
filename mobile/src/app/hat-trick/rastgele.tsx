import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { generateGrid } from "@/lib/tiki";

import { Text } from "~/components/Text";
import { WaitingAnimation } from "~/components/WaitingAnimation";
import { Button, Card, Page } from "~/components/ui";
import { haptic } from "~/lib/haptics";
import { gridToIds } from "~/lib/hattrick";
import { useI18n } from "~/lib/i18n";
import { getSocket } from "~/lib/socket";
import { C, T } from "~/lib/theme";

/** Random opponent: wait in the server queue, then jump into the matched room. */
export default function HatTrickRandom() {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const socket = getSocket();
    const onMatched = ({ code }: { code: string }) => {
      haptic.success();
      router.replace({ pathname: "/hat-trick/oda/[code]", params: { code } });
    };
    const onError = () => setError(t("serverUnreachable"));
    const enqueue = () => {
      setError(null);
      socket.emit("ht:queue", { nick: "", grid: gridToIds(generateGrid()) });
    };
    socket.on("ht:matched", onMatched);
    socket.on("connect_error", onError);
    socket.on("connect", enqueue);
    if (socket.connected) enqueue();
    return () => {
      socket.emit("ht:unqueue");
      socket.off("ht:matched", onMatched);
      socket.off("connect_error", onError);
      socket.off("connect", enqueue);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Page>
      <Stack.Screen options={{ title: t("htRandom") }} />
      <Card style={{ alignItems: "center", paddingVertical: 32, gap: 14 }}>
        <WaitingAnimation width={260} />
        <Text style={T.title}>{t("htSearching")}</Text>
        <Text style={[T.body, { textAlign: "center" }]}>{t("htSearchingDesc")}</Text>
        {error && <Text style={[T.body, { color: C.red, fontWeight: "600" }]}>{error}</Text>}
      </Card>
      <View style={{ marginTop: 16 }}>
        <Button title={t("cancel")} kind="secondary" onPress={() => router.back()} />
      </View>
    </Page>
  );
}
