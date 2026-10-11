import { Stack } from "expo-router";

import { PLAYERS_SEASON, PLAYERS_UPDATED } from "@/data/players";
import { LEAGUES, type LeagueId } from "@/lib/leagues";

import { HelpButton } from "~/components/HelpButton";
import { LeaguePicker } from "~/components/LeaguePicker";
import { TikiSteps } from "~/components/HowTo";
import { ModeGrid, type Mode } from "~/components/ModeGrid";
import { Text } from "~/components/Text";
import { Card, Page, SectionLabel } from "~/components/ui";
import { BRAND } from "~/lib/brand";
import { useI18n } from "~/lib/i18n";
import { useHtLeague } from "~/lib/league";
import { C, T } from "~/lib/theme";

/** Hat-trick hub: four ways to play. */
export default function HatTrickHome() {
  const { t, locale } = useI18n();
  const [league, setLeague] = useHtLeague();
  const modes: Mode[] = [
    {
      icon: "person.2.fill",
      fallback: "👥",
      title: t("htFriend"),
      desc: t("htFriendDesc"),
      href: "/hat-trick/oda",
      image: BRAND.mode.friend,
      color: C.greenMid,
      soft: C.greenSoft,
    },
    {
      icon: "antenna.radiowaves.left.and.right",
      fallback: "📡",
      title: t("htRandom"),
      desc: t("htRandomDesc"),
      href: "/hat-trick/rastgele",
      image: BRAND.mode.random,
      color: C.blue,
      soft: C.blueSoft,
    },
    {
      icon: "iphone",
      fallback: "📱",
      title: t("htSame"),
      desc: t("htSameDesc"),
      href: "/hat-trick/yerel",
      image: BRAND.mode.same,
      color: C.coral,
      soft: C.coralSoft,
    },
    {
      icon: "person.fill",
      fallback: "👤",
      title: t("htSolo"),
      desc: t("htSoloDesc"),
      href: "/hat-trick/tek",
      image: BRAND.mode.solo,
      color: "#B7791F",
      soft: C.amberSoft,
    },
  ];

  return (
    <Page>
      <Stack.Screen
        options={{
          title: t("tikiTakaName"),
          headerRight: () => <HelpButton game="tiki" />,
        }}
      />
      <Text style={T.title}>{t("tikiTakaName")}</Text>
      <Text style={[T.body, { marginTop: 4 }]}>{t("tikiTakaTagline")}</Text>

      {/* the league applies to every mode below (the daily single-player grid stays all clubs) */}
      <SectionLabel>{t("htLeague")}</SectionLabel>
      <LeaguePicker items={LEAGUES} value={league} onChange={(id) => setLeague(id as LeagueId)} />

      <SectionLabel>{t("htModes")}</SectionLabel>
      <ModeGrid modes={modes} />

      <SectionLabel>{t("howToPlay")}</SectionLabel>
      <Card style={{ padding: 20 }}>
        <TikiSteps />
      </Card>

      {/* when the squads were last scraped, so players know new transfers are in */}
      <Text style={[T.caption, { textAlign: "center", marginTop: 16 }]}>
        {t("htDataUpdated")
          .replace("{date}", new Date(`${PLAYERS_UPDATED}T12:00:00`).toLocaleDateString(locale === "tr" ? "tr-TR" : "en-GB", { day: "numeric", month: "long", year: "numeric" }))
          .replace("{season}", `${PLAYERS_SEASON}/${String(PLAYERS_SEASON + 1).slice(2)}`)}
      </Text>
    </Page>
  );
}
