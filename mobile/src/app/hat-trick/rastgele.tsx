import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { generateGrid } from "@/lib/tiki";

import { MatchIntro } from "~/components/MatchIntro";
import { Text } from "~/components/Text";
import { RunningPlayer } from "~/components/RunningPlayer";
import { Button, Card, Page } from "~/components/ui";
import { gridToIds, type Mark } from "~/lib/hattrick";
import { useI18n } from "~/lib/i18n";
import { loadNick, randomNick } from "~/lib/nick";
import { getSocket } from "~/lib/socket";
import { C, T } from "~/lib/theme";

/** Nobody found by then: play the house bot, which looks and plays like any other opponent. */
const BOT_AFTER_MS = 20_000;

type Matched = { kind: "room"; code: string; me: Mark; opponent: string } | { kind: "bot"; opponent: string };

/** Random opponent: wait in the server queue, show the VS intro, then jump into the game. */
export default function HatTrickRandom() {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [matched, setMatched] = useState<Matched | null>(null);

  useEffect(() => {
    if (matched) return;
    const id = setTimeout(() => {
      getSocket().emit("ht:unqueue");
      setMatched({ kind: "bot", opponent: randomNick() });
    }, BOT_AFTER_MS);
    return () => clearTimeout(id);
  }, [matched]);

  useEffect(() => {
    const socket = getSocket();
    const onMatched = (m: { code: string; players: { id: string; nick: string; mark: Mark }[] }) => {
      const me = m.players.find((p) => p.id === socket.id) ?? m.players[0];
      const them = m.players.find((p) => p !== me);
      setMatched({ kind: "room", code: m.code, me: me.mark, opponent: them?.nick || t("opponent") });
    };
    const onError = () => setError(t("serverUnreachable"));
    const enqueue = async () => {
      setError(null);
      socket.emit("ht:queue", { nick: await loadNick(), grid: gridToIds(generateGrid()) });
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
    const me: Mark = matched.kind === "room" ? matched.me : "X";
    return (
      <Page>
        <Stack.Screen options={{ title: t("htRandom") }} />
        <MatchIntro
          me={{ name: t("you"), mark: me }}
          opponent={{ name: matched.opponent, mark: me === "X" ? "O" : "X" }}
          onDone={() =>
            router.replace(
              matched.kind === "room"
                ? { pathname: "/hat-trick/oda/[code]", params: { code: matched.code, random: "1" } }
                : { pathname: "/hat-trick/bot", params: { nick: matched.opponent } }
            )
          }
        />
      </Page>
    );
  }

  return (
    <Page>
      <Stack.Screen options={{ title: t("htRandom") }} />
      <Card style={{ alignItems: "center", paddingVertical: 32, gap: 14 }}>
        <RunningPlayer />
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
