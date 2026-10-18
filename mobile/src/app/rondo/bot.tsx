import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { XP } from "@/lib/levels";

import { EmoteButton, EmoteLayer, useEmotes } from "~/components/Emotes";
import { PlayerMenuButton } from "~/components/PlayerMenu";
import { RondoBoard, RondoEnd } from "~/components/RondoBoard";
import { SeriesEnd } from "~/components/SeriesEnd";
import { Page } from "~/components/ui";
import { houseRef } from "~/lib/blocks";
import { useRecordMatch } from "~/lib/history";
import { useI18n } from "~/lib/i18n";
import { useRondoHouse } from "~/lib/rondoMatch";
import { C } from "~/lib/theme";
import { useXpAward } from "~/lib/xp";

/** The house player when nobody else was searching: plays like anyone online (rules in src/lib/rondo.ts). */
export default function RondoHouse() {
  const { t } = useI18n();
  const params = useLocalSearchParams<{ nick?: string }>();
  const nick = params.nick || t("opponent");
  const [ref] = useState(() => houseRef(`${nick}-${Math.random()}`));
  const m = useRondoHouse(nick, ref);
  const emotes = useEmotes("rd", false);

  useXpAward(m.over, m.key, "rd", m.won ? XP.rdWin : XP.rdLoss);
  useRecordMatch(m.over, { key: m.key, game: "rd", opponent: nick, result: m.won ? "win" : "loss", score: `${m.score.me}–${m.score.them}` });

  return (
    <Page scroll={false}>
      <Stack.Screen
        options={{
          title: "Rondo",
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <PlayerMenuButton target={{ ref, nick, game: "rd" }} color={C.text} bg="#EEF2EF" />
              <EmoteButton e={emotes} color={C.text} bg="#EEF2EF" />
            </View>
          ),
        }}
      />
      <RondoBoard m={m} footer={<RondoEnd m={m} onNew={() => router.replace("/rondo/rastgele")} />} />
      <SeriesEnd over={m.over} won={m.won} mine={m.score.me} theirs={m.score.them} onRematch={m.rematch} countTrophy={false} />
      <EmoteLayer e={emotes} top={4} />
    </Page>
  );
}
