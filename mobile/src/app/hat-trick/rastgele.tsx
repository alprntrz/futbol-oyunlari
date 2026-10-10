import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { generateGrid } from "@/lib/tiki";

import { MatchIntro } from "~/components/MatchIntro";
import { Text } from "~/components/Text";
import { WaitingAnimation } from "~/components/WaitingAnimation";
import { Button, Card, Page } from "~/components/ui";
import { gridToIds, type Mark } from "~/lib/hattrick";
import { useI18n } from "~/lib/i18n";
import { getSocket } from "~/lib/socket";
import { C, T } from "~/lib/theme";

/** After this long with nobody found, offer a bot; a bit later, start one. */
const OFFER_BOT_MS = 10_000;
const AUTO_BOT_MS = 25_000;

interface Matched {
  code: string;
  players: { id: string; nick: string; mark: Mark }[];
}

/** Random opponent: wait in the server queue, show the VS intro, then jump into the matched room. */
export default function HatTrickRandom() {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [matched, setMatched] = useState<Matched | null>(null);
  const [waited, setWaited] = useState(0);

  // Nobody around: offer a bot, then switch to one
  useEffect(() => {
    if (matched) return;
    const started = Date.now();
    const id = setInterval(() => {
      const ms = Date.now() - started;
      setWaited(ms);
      if (ms >= AUTO_BOT_MS) router.replace("/hat-trick/bot");
    }, 500);
    return () => clearInterval(id);
  }, [matched]);

  useEffect(() => {
    const socket = getSocket();
    const onMatched = (m: Matched) => setMatched(m);
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

  if (matched) {
    const myId = getSocket().id;
    const me = matched.players.find((p) => p.id === myId) ?? matched.players[0];
    const them = matched.players.find((p) => p !== me);
    return (
      <Page>
        <Stack.Screen options={{ title: t("htRandom") }} />
        <MatchIntro
          me={{ name: t("you"), mark: me.mark }}
          opponent={{ name: them?.nick || t("opponent"), mark: them?.mark ?? (me.mark === "X" ? "O" : "X") }}
          onDone={() => router.replace({ pathname: "/hat-trick/oda/[code]", params: { code: matched.code } })}
        />
      </Page>
    );
  }

  return (
    <Page>
      <Stack.Screen options={{ title: t("htRandom") }} />
      <Card style={{ alignItems: "center", paddingVertical: 32, gap: 14 }}>
        <WaitingAnimation width={260} />
        <Text style={T.title}>{t("htSearching")}</Text>
        <Text style={[T.body, { textAlign: "center" }]}>{t("htSearchingDesc")}</Text>
        {error && <Text style={[T.body, { color: C.red, fontWeight: "600" }]}>{error}</Text>}
      </Card>
      {waited >= OFFER_BOT_MS && (
        <Card style={{ marginTop: 16, gap: 10 }}>
          <Text style={T.headline}>{t("htNoOne")}</Text>
          <Text style={T.body}>{t("htBotOffer")}</Text>
          <Button title={t("htPlayBot")} icon="cpu" onPress={() => router.replace("/hat-trick/bot")} />
        </Card>
      )}
      <View style={{ marginTop: 16 }}>
        <Button title={t("cancel")} kind="secondary" onPress={() => router.back()} />
      </View>
    </Page>
  );
}
