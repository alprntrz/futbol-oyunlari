import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Text } from "~/components/Text";
import { MatchSearch } from "~/components/MatchSearch";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { GAME_ICON, useSearchActivity } from "~/lib/liveActivity";
import { boardToIds, generateBoard } from "~/lib/possession";
import { getSocket } from "~/lib/socket";
import { F } from "~/lib/theme";
import { loadTier } from "~/lib/xp";

/** Random opponent: wait in the server queue, then jump into the matched room. */
export default function PossessionRandom() {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  useSearchActivity(t("ppName"), GAME_ICON.pp, true);

  useEffect(() => {
    const socket = getSocket();
    const onMatched = ({ code }: { code: string }) => {
      haptic.success();
      router.replace({ pathname: "/possession/oda/[code]", params: { code } });
    };
    const onError = () => setError(t("serverUnreachable"));
    const enqueue = () => {
      setError(null);
      loadTier().then((tier) => socket.emit("pp:queue", { nick: "", board: boardToIds(generateBoard()), tier }));
    };
    socket.on("pp:matched", onMatched);
    socket.on("connect_error", onError);
    socket.on("connect", enqueue);
    if (socket.connected) enqueue();
    return () => {
      socket.emit("pp:unqueue");
      socket.off("pp:matched", onMatched);
      socket.off("connect_error", onError);
      socket.off("connect", enqueue);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <MatchSearch found={null} onCancel={() => router.back()} />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  error: { position: "absolute", top: 70, left: 24, right: 24, textAlign: "center", fontFamily: F.display, fontSize: 17, color: "white", backgroundColor: "rgba(0,0,0,0.35)", borderRadius: 12, padding: 10, overflow: "hidden" },
});
