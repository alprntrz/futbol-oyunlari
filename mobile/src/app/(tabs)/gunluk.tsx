import Animated, { FadeIn } from "react-native-reanimated";

import { DailyRewardCard, QuestsCard } from "~/components/DailyCards";
import { Text } from "~/components/Text";
import { TodayPuzzles } from "~/components/TodayPuzzles";
import { Page } from "~/components/ui";
import { useI18n } from "~/lib/i18n";
import { GameBg, outline } from "~/components/game";

const enter = (i: number) => FadeIn.duration(180).delay(i * 40);

/** Daily tab: the reward calendar, today's three puzzles and today's quests. */
export default function Daily() {
  const { t } = useI18n();
  return (
    <Page topInset background={<GameBg />}>
      <Text style={[outline(40), { marginBottom: 6 }]}>{t("tabDaily")}</Text>
      <Animated.View entering={enter(0)}>
        <DailyRewardCard />
      </Animated.View>
      <Animated.View entering={enter(1)}>
        <TodayPuzzles />
      </Animated.View>
      <Animated.View entering={enter(2)}>
        <QuestsCard />
      </Animated.View>
    </Page>
  );
}
