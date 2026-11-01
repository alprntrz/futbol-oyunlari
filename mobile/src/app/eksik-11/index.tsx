import { router } from "expo-router";
import { useState } from "react";

import { XI_CATEGORIES } from "@/lib/leagues";

import { ChoiceSheet, GameHub, HubSetting } from "~/components/GameHub";
import { MissingXISteps } from "~/components/HowTo";
import { LeagueBadge } from "~/components/LeaguePicker";
import { BRAND } from "~/lib/brand";
import { useI18n } from "~/lib/i18n";
import { GAME } from "~/lib/theme";

/** Missing 11: one big Play (a random match from the chosen matches), today's match and pick-a-team below. */
export default function MissingXIHome() {
  const { t, locale } = useI18n();
  const [cat, setCat] = useState<string>(XI_CATEGORIES[0].id);
  const [picking, setPicking] = useState(false);
  const current = XI_CATEGORIES.find((c) => c.id === cat) ?? XI_CATEGORIES[0];

  return (
    <GameHub
      title={t("missingXI")}
      image={BRAND.icon.practice}
      bg={GAME.xi.bg}
      tagline={t("xiTagline")}
      primary={{ label: t("play"), icon: "play.fill", fallback: "▶", onPress: () => router.push({ pathname: "/eksik-11/pratik", params: { kategori: cat } }) }}
      secondary={[
        { label: t("daily"), icon: "calendar", fallback: "📅", onPress: () => router.push("/eksik-11/gunluk") },
        { label: t("byTeam"), icon: "tshirt.fill", fallback: "👕", onPress: () => router.push("/eksik-11/takimlar") },
        { label: t("archiveTitle"), icon: "archivebox.fill", fallback: "🗄", onPress: () => router.push("/arsiv") },
      ]}
      settings={
        <HubSetting label={t("xiMatchesFrom")} value={`${current.name[locale]} · ${current.matches().length}`} onPress={() => setPicking(true)} />
      }
      rules={<MissingXISteps />}
    >
      <ChoiceSheet
        visible={picking}
        title={t("xiMatchesFrom")}
        value={cat}
        options={XI_CATEGORIES.map((c) => ({ value: c.id, label: c.name[locale], hint: `${c.matches().length} ${t("matchesWord")}`, left: <LeagueBadge item={c} size={30} /> }))}
        onPick={setCat}
        onClose={() => setPicking(false)}
      />
    </GameHub>
  );
}
