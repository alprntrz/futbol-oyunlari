import { router } from "expo-router";
import { useState } from "react";

import { PLAYERS_SEASON, PLAYERS_UPDATED } from "@/data/players";
import { LEAGUES, leagueById, type LeagueId } from "@/lib/leagues";
import { GRID_CATEGORIES } from "@/lib/tiki";

import { ChoiceSheet, GameHub, HubSetting, ToggleSheet } from "~/components/GameHub";
import { TikiSteps } from "~/components/HowTo";
import { LeagueBadge } from "~/components/LeaguePicker";
import { Text } from "~/components/Text";
import { BRAND } from "~/lib/brand";
import { useI18n } from "~/lib/i18n";
import { useHtCategories, useHtLeague } from "~/lib/league";
import { GAME, T } from "~/lib/theme";

/** Tic-Tac-Toe: one big Find opponent; friend / same phone / solo below; the league is a setting. */
export default function HatTrickHome() {
  const { t, locale } = useI18n();
  const [league, setLeague] = useHtLeague();
  const [picking, setPicking] = useState(false);
  const [cats, setCats] = useHtCategories();
  const [pickingCats, setPickingCats] = useState(false);
  const catsLabel = cats.length >= GRID_CATEGORIES.length ? t("htCategoriesAll") : `${cats.length + 1}/${GRID_CATEGORIES.length + 1}`;
  const name = (l: (typeof LEAGUES)[number]) => (locale === "tr" ? l.name.tr : l.name.en);

  return (
    <GameHub
      title={t("tikiTakaName")}
      image={BRAND.icon.tiki}
      bg={GAME.ht.bg}
      tagline={t("tikiTakaTagline")}
      primary={{ label: t("playFind"), icon: "play.fill", fallback: "▶", onPress: () => router.push("/hat-trick/rastgele") }}
      secondary={[
        { label: t("htFriend"), icon: "person.2.fill", fallback: "👥", onPress: () => router.push("/hat-trick/oda") },
        { label: t("htSame"), icon: "iphone", fallback: "📱", onPress: () => router.push("/hat-trick/yerel") },
        { label: t("htSolo"), icon: "person.fill", fallback: "👤", onPress: () => router.push("/hat-trick/tek") },
      ]}
      settings={
        <>
          <HubSetting label={t("htLeague")} value={name(leagueById(league))} onPress={() => setPicking(true)} />
          <HubSetting label={t("htCategories")} value={catsLabel} onPress={() => setPickingCats(true)} />
        </>
      }
      rules={<TikiSteps />}
    >
      <ChoiceSheet
        visible={picking}
        title={t("htLeague")}
        value={league}
        options={LEAGUES.map((l) => ({ value: l.id, label: name(l), left: <LeagueBadge item={l} size={30} /> }))}
        onPick={(id) => setLeague(id as LeagueId)}
        onClose={() => setPicking(false)}
      />
      <ToggleSheet
        visible={pickingCats}
        title={t("htCategories")}
        hint={t("htCategoriesHint")}
        value={cats}
        options={[
          { value: "clubs" as const, label: t("htCat_clubs"), hint: t("htCatD_clubs"), locked: true },
          ...GRID_CATEGORIES.map((c) => ({ value: c, label: t(`htCat_${c}`), hint: t(`htCatD_${c}`) })),
        ]}
        onChange={(v) => setCats(v.filter((c): c is (typeof GRID_CATEGORIES)[number] => c !== "clubs"))}
        onClose={() => setPickingCats(false)}
      />
      {/* when the squads were last scraped, so players know new transfers are in */}
      <Text style={[T.caption, { textAlign: "center", marginTop: 16 }]}>
        {t("htDataUpdated")
          .replace("{date}", new Date(`${PLAYERS_UPDATED}T12:00:00`).toLocaleDateString(locale === "tr" ? "tr-TR" : "en-GB", { day: "numeric", month: "long", year: "numeric" }))
          .replace("{season}", `${PLAYERS_SEASON}/${String(PLAYERS_SEASON + 1).slice(2)}`)}
      </Text>
    </GameHub>
  );
}
