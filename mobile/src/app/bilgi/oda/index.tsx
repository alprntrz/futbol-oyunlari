import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { quizQuestions, type QuizCategory, type QuizDifficulty } from "@/lib/quiz";

import { OnlineLobby } from "~/components/OnlineLobby";
import { Text } from "~/components/Text";
import { Segmented } from "~/components/ui";
import { useI18n } from "~/lib/i18n";
import { T } from "~/lib/theme";

/** Quiz room with friends: the creator picks the settings and deals the questions. */
export default function QuizLobby() {
  const { t } = useI18n();
  const [maxPlayers, setMaxPlayers] = useState("5");
  const [count, setCount] = useState("10");
  const [seconds, setSeconds] = useState("15");
  const [category, setCategory] = useState<QuizCategory>("mixed");
  const { zorluk } = useLocalSearchParams<{ zorluk?: string }>();
  const [difficulty, setDifficulty] = useState<QuizDifficulty>(zorluk === "easy" || zorluk === "hard" ? zorluk : "normal");

  const row = (label: string, node: React.ReactNode) => (
    <View style={{ gap: 6 }}>
      <Text style={T.caption}>{label}</Text>
      {node}
    </View>
  );

  return (
    <OnlineLobby
      game="qz"
      title={t("qzName")}
      createPayload={() => ({
        settings: { maxPlayers: Number(maxPlayers), seconds: Number(seconds), category, difficulty },
        questions: quizQuestions(Number(count), category, difficulty),
      })}
      roomHref={(code) => ({ pathname: "/bilgi/oda/[code]", params: { code } })}
      createOptions={
        <View style={{ gap: 12 }}>
          {row(
            t("qzPlayers"),
            <Segmented value={maxPlayers} onChange={setMaxPlayers} options={["2", "3", "4", "5"].map((v) => ({ value: v, label: v }))} />
          )}
          {row(t("qzQuestions"), <Segmented value={count} onChange={setCount} options={["5", "10", "15"].map((v) => ({ value: v, label: v }))} />)}
          {row(
            t("qzSeconds"),
            <Segmented value={seconds} onChange={setSeconds} options={["10", "15", "20"].map((v) => ({ value: v, label: `${v} ${t("qzSecShort")}` }))} />
          )}
          {row(
            t("qzDifficulty"),
            <Segmented
              value={difficulty}
              onChange={setDifficulty}
              options={[
                { value: "easy", label: t("qzEasy") },
                { value: "normal", label: t("qzNormal") },
                { value: "hard", label: t("qzHard") },
              ]}
            />
          )}
          {row(
            t("qzCategory"),
            <Segmented
              value={category}
              onChange={setCategory}
              options={[
                { value: "mixed", label: t("qzMixed") },
                { value: "players", label: t("qzCatPlayers") },
                { value: "matches", label: t("qzCatMatches") },
              ]}
            />
          )}
        </View>
      }
    />
  );
}
