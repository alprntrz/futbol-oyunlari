import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";

import { ChoiceSheet, GameHub, HubSetting } from "~/components/GameHub";
import { Rule } from "~/components/HowTo";
import { LevelCard, type QuizProfile } from "~/components/QuizLevel";
import { BRAND } from "~/lib/brand";
import { useI18n } from "~/lib/i18n";
import { loadPlayerId } from "~/lib/nick";
import { useQuizDifficulty } from "~/lib/quizLevel";
import { getSocket } from "~/lib/socket";

/** Football Quiz: one big Find opponent; friends below; difficulty and standings are settings rows. */
export default function QuizHome() {
  const { t } = useI18n();
  const [profile, setProfile] = useState<QuizProfile | null>(null);
  const [level, setLevel] = useQuizDifficulty();
  const [picking, setPicking] = useState(false);

  // fresh level every time the hub comes back into view (after a game)
  useFocusEffect(
    useCallback(() => {
      loadPlayerId().then((pid) =>
        getSocket()
          .timeout(5000)
          .emit("qz:profile", { pid }, (err: Error | null, res?: { ok: boolean; profile: QuizProfile }) => {
            if (!err && res?.ok) setProfile(res.profile);
          })
      );
    }, [])
  );

  const levels = [
    { value: "easy" as const, label: t("qzEasy"), hint: t("qzEasyDesc") },
    { value: "normal" as const, label: t("qzNormal"), hint: t("qzNormalDesc") },
    { value: "hard" as const, label: t("qzHard"), hint: t("qzHardDesc") },
  ];

  return (
    <GameHub
      title={t("qzName")}
      image={BRAND.icon.quiz}
      bg="#EDE9FE"
      tagline={t("qzTagline")}
      primary={{ label: t("playFind"), icon: "play.fill", fallback: "▶", onPress: () => router.push({ pathname: "/bilgi/rastgele", params: { zorluk: level } }) }}
      secondary={[{ label: t("htFriend"), icon: "person.2.fill", fallback: "👥", onPress: () => router.push({ pathname: "/bilgi/oda", params: { zorluk: level } }) }]}
      settings={
        <>
          <HubSetting label={t("qzDifficulty")} value={levels.find((l) => l.value === level)?.label ?? ""} onPress={() => setPicking(true)} />
          <HubSetting label={t("qzStandingsTitle")} value="" onPress={() => router.push("/bilgi/siralama")} />
        </>
      }
      rules={
        <View style={{ gap: 14 }}>
          <Rule image={BRAND.how.questions} desc={t("qzRule1")} />
          <Rule image={BRAND.how.speed} desc={t("qzRule2")} />
          <Rule image={BRAND.how.players} desc={t("qzRule3")} />
        </View>
      }
    >
      <View style={{ marginTop: 14 }}>
        <LevelCard profile={profile} />
      </View>
      <ChoiceSheet visible={picking} title={t("qzDifficulty")} value={level} options={levels} onPick={setLevel} onClose={() => setPicking(false)} />
    </GameHub>
  );
}
