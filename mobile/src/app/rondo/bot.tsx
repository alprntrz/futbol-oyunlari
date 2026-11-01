import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { XP } from "@/lib/levels";
import { cleanRondoMode } from "@/lib/rondo";

import { EmoteButton, EmoteLayer, useEmotes } from "~/components/Emotes";
import { PlayerMenuButton } from "~/components/PlayerMenu";
import { RondoBoard, RondoEnd } from "~/components/RondoBoard";
import { SeriesEnd } from "~/components/SeriesEnd";
import { Page } from "~/components/ui";
import { houseRef } from "~/lib/blocks";
import { useRecordMatch } from "~/lib/history";
import { useI18n } from "~/lib/i18n";
import { useLeaveGuard } from "~/lib/leaveGuard";
import { useRondoHouse, type RondoMatch } from "~/lib/rondoMatch";
import { useRondoPairHouse } from "~/lib/rondoPairHouse";
import { C } from "~/lib/theme";
import { useXpAward } from "~/lib/xp";

/** The house player when nobody else was searching: plays like anyone online (rules in src/lib/rondo.ts). */
export default function RondoHouse() {
  const { t } = useI18n();
  const params = useLocalSearchParams<{ nick?: string; mode?: string }>();
  const nick = params.nick || t("opponent");
  const [ref] = useState(() => houseRef(`${nick}-${Math.random()}`));
  const [mode] = useState(() => cleanRondoMode(params.mode));
  // two components, so each mode's hook runs unconditionally
  return mode === "pair" ? <PairHouse nick={nick} refId={ref} /> : <ClubHouse nick={nick} refId={ref} />;
}

function ClubHouse({ nick, refId }: { nick: string; refId: string }) {
  const m = useRondoHouse(nick, refId);
  return <HouseMatch m={m} nick={nick} refId={refId} title="Rondo" />;
}

function PairHouse({ nick, refId }: { nick: string; refId: string }) {
  const { t } = useI18n();
  const m = useRondoPairHouse(nick, refId);
  return <HouseMatch m={m} nick={nick} refId={refId} title={t("rdModePair")} />;
}

function HouseMatch({ m, nick, refId, title }: { m: RondoMatch; nick: string; refId: string; title: string }) {
  const emotes = useEmotes("rd", false);
  // the house player looks like an online opponent: leaving asks the same way
  useLeaveGuard(!m.over);
  useXpAward(m.over, m.key, "rd", m.won ? XP.rdWin : XP.rdLoss);
  useRecordMatch(m.over, { key: m.key, game: "rd", opponent: nick, result: m.won ? "win" : "loss", score: `${m.score.me}–${m.score.them}` });

  return (
    <Page scroll={false}>
      <Stack.Screen
        options={{
          title,
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <PlayerMenuButton target={{ ref: refId, nick, game: "rd" }} color={C.text} bg="#EEF2EF" />
              <EmoteButton e={emotes} color={C.text} bg="#EEF2EF" />
            </View>
          ),
        }}
      />
      <RondoBoard m={m} footer={<RondoEnd m={m} onNew={() => router.replace({ pathname: "/rondo/rastgele", params: { mode: m.mode } })} />} />
      <SeriesEnd over={m.over} won={m.won} mine={m.score.me} theirs={m.score.them} onRematch={m.rematch} countTrophy={false} payXp={false} />
      <EmoteLayer e={emotes} top={4} />
    </Page>
  );
}
