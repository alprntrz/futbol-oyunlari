import { useState } from "react";
import { Pressable } from "react-native";

import { useI18n } from "~/lib/i18n";
import { C } from "~/lib/theme";

import { InfoSheet, MissingXISteps, TikiSteps } from "./HowTo";
import { Icon } from "./ui";

/** "?" header button that opens the how-to-play sheet for a game. */
export function HelpButton({ game }: { game: "xi" | "tiki" }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={10} accessibilityLabel={t("howToPlay")}>
        <Icon name="questionmark.circle" size={22} color={C.text} fallback="?" />
      </Pressable>
      <InfoSheet visible={open} onClose={() => setOpen(false)} title={game === "xi" ? t("missingXI") : t("tikiTakaName")}>
        {game === "xi" ? <MissingXISteps /> : <TikiSteps />}
      </InfoSheet>
    </>
  );
}
