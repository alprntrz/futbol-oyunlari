import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { XP } from "@/lib/levels";

import { EmoteButton, EmoteLayer, useEmotes } from "~/components/Emotes";
import { PlayerMenuButton } from "~/components/PlayerMenu";
import { SeriesEnd } from "~/components/SeriesEnd";
import { SpotBoard, SpotEnd } from "~/components/SpotBoard";
import { Page } from "~/components/ui";
import { houseRef } from "~/lib/blocks";
import { useRecordMatch } from "~/lib/history";
import { useI18n } from "~/lib/i18n";
import { useLeaveGuard } from "~/lib/leaveGuard";
import { useSpotHouse } from "~/lib/spotMatch";
import { C } from "~/lib/theme";
import { useXpAward } from "~/lib/xp";

/** The house player when nobody else was searching: plays like anyone online (rules in src/lib/spot.ts). */
export default function SpotHouse() {
  const { t } = useI18n();
  const params = useLocalSearchParams<{ nick?: string }>();
  const nick = params.nick || t("opponent");
  const [ref] = useState(() => houseRef(`${nick}-${Math.random()}`));
  const m = useSpotHouse(nick, ref);
  const emotes = useEmotes("sp", false);
  // the house player looks like an online opponent: leaving asks the same way
  useLeaveGuard(!m.over);
  useXpAward(m.over, m.key, "sp", m.won ? XP.spWin : m.draw ? XP.spDraw : XP.spLoss);
  useRecordMatch(m.over, { key: m.key, game: "sp", opponent: nick, result: m.won ? "win" : m.draw ? "draw" : "loss", score: `${m.score.me}–${m.score.them}` });

  return (
    <Page scroll={false}>
      <Stack.Screen
        options={{
          title: t("spName"),
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <PlayerMenuButton target={{ ref, nick, game: "sp" }} color={C.text} bg="#EEF2EF" />
              <EmoteButton e={emotes} color={C.text} bg="#EEF2EF" />
            </View>
          ),
        }}
      />
      <SpotBoard m={m} footer={<SpotEnd m={m} onNew={() => router.replace("/nokta/rastgele")} />} />
      <SeriesEnd over={m.over} won={m.won} title={m.draw ? t("spDraw") : undefined} mine={m.score.me} theirs={m.score.them} onRematch={m.rematch} countTrophy={false} payXp={false} />
      <EmoteLayer e={emotes} top={4} />
    </Page>
  );
}
