import { useState } from "react";
import { View } from "react-native";

import type { Difficulty } from "@/lib/types";

import { useI18n } from "~/lib/i18n";
import { C, T } from "~/lib/theme";

import { MissingXISteps } from "./HowTo";
import { Text } from "./Text";
import { Button, Card, SectionLabel, Segmented } from "./ui";

/** Pre-game screen: what this mode is, how to play, difficulty, Start (the title is in the header). */
export function GameIntro({ subtitle, onStart }: { subtitle: string; onStart: (d: Difficulty) => void }) {
  const { t } = useI18n();
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");

  return (
    <View style={{ width: "100%" }}>
      {/* the screen's header already carries the title */}
      <Text style={T.body}>{subtitle}</Text>

      <SectionLabel>{t("howToPlay")}</SectionLabel>
      <Card style={{ padding: 20 }}>
        <MissingXISteps />
      </Card>

      <SectionLabel>{t("difficulty")}</SectionLabel>
      <Segmented
        value={difficulty}
        onChange={setDifficulty}
        options={[
          { value: "normal", label: t("normal") },
          { value: "hard", label: t("hard") },
        ]}
      />
      <Text style={[T.caption, { marginTop: 8, marginLeft: 4, color: C.text2 }]}>
        {difficulty === "normal" ? t("normalDesc") : t("hardDesc")}
      </Text>

      <Button title={t("startGame")} icon="play.fill" onPress={() => onStart(difficulty)} style={{ marginTop: 24 }} />
    </View>
  );
}
