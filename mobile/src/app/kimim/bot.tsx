import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { XP } from "@/lib/levels";

import { EmoteButton, EmoteLayer, useEmotes } from "~/components/Emotes";
import { PlayerMenuButton } from "~/components/PlayerMenu";
import { WhoAmIBoard, WhoAmIEnd } from "~/components/WhoAmIBoard";
import { Page } from "~/components/ui";
import { houseRef } from "~/lib/blocks";
import { useRecordMatch } from "~/lib/history";
import { useI18n } from "~/lib/i18n";
import { useWmHouse } from "~/lib/whoamiMatch";
import { C } from "~/lib/theme";
import { useXpAward } from "~/lib/xp";

/** The house player when nobody else was searching: plays like anyone online (rules in src/lib/whoami.ts). */
export default function WhoAmIHouse() {
  const { t } = useI18n();
  const params = useLocalSearchParams<{ nick?: string }>();
  const nick = params.nick || t("opponent");
  const [ref] = useState(() => houseRef(`${nick}-${Math.random()}`));
  const m = useWmHouse(nick, ref);
  const emotes = useEmotes("wm", false);

  useXpAward(m.over, m.key, "wm", m.won ? XP.wmWin : m.draw ? XP.wmDraw : XP.wmLoss);
  useRecordMatch(m.over, { key: m.key, game: "wm", opponent: nick, result: m.won ? "win" : m.draw ? "draw" : "loss", score: `${m.hearts.me}–${m.hearts.them}` });

  return (
    <Page scroll={false}>
      <Stack.Screen
        options={{
          title: t("wmName"),
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <PlayerMenuButton target={{ ref, nick, game: "wm" }} color={C.text} bg="#EEF2EF" />
              <EmoteButton e={emotes} color={C.text} bg="#EEF2EF" />
            </View>
          ),
        }}
      />
      <WhoAmIBoard m={m} footer={<WhoAmIEnd m={m} onNew={() => router.replace("/kimim/rastgele")} />} />
      <EmoteLayer e={emotes} top={4} />
    </Page>
  );
}
