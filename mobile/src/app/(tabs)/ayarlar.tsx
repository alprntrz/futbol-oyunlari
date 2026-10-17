import Constants from "expo-constants";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Linking, View } from "react-native";

import { BingoSteps, DuelSteps, InfoSheet, MissingXISteps, MysterySteps, PossessionSteps, QuizSteps, TaktikSteps, TikiSteps } from "~/components/HowTo";
import { Text } from "~/components/Text";
import { Card, Page, Row, SectionLabel, Segmented } from "~/components/ui";
import { deleteAccount, signOut, useAccount } from "~/lib/account";
import { BRAND, ROZET, TAKTIK } from "~/lib/brand";
import { ONBOARDING } from "~/lib/features";
import { useI18n } from "~/lib/i18n";
import { PRIVACY_URL, SUPPORT_URL } from "~/lib/links";
import { deleteMyData, restartApp } from "~/lib/privacy";
import { remindersDenied } from "~/components/ReminderAsk";
import { setRemindersOn, useReminders } from "~/lib/reminders";
import { play, setSoundsOn, soundsOn } from "~/lib/sound";
import { C, T } from "~/lib/theme";

export default function SettingsTab() {
  const { t, locale, setLocale } = useI18n();
  const [sheet, setSheet] = useState<string | null>(null);
  // every game's rules, in the Games tab's order and with its art
  const games = [
    { key: "tiki", title: t("tikiTakaName"), image: BRAND.icon.tiki, steps: <TikiSteps /> },
    { key: "duel", title: t("dzName"), image: ROZET.duel, steps: <DuelSteps /> },
    { key: "quiz", title: t("qzName"), image: BRAND.icon.quiz, steps: <QuizSteps /> },
    { key: "pp", title: t("ppName"), image: BRAND.icon.possession, steps: <PossessionSteps /> },
    { key: "taktik", title: t("ttkName"), image: TAKTIK.hero, steps: <TaktikSteps /> },
    { key: "mystery", title: t("myName"), image: BRAND.icon.mystery, steps: <MysterySteps /> },
    { key: "xi", title: t("missingXI"), image: BRAND.icon.practice, steps: <MissingXISteps /> },
    { key: "bingo", title: t("bingoName"), image: BRAND.icon.bingo, steps: <BingoSteps /> },
  ];
  const open = games.find((g) => g.key === sheet);
  const account = useAccount();
  const confirmSignOut = () =>
    Alert.alert(t("signOutAsk"), t("signOutDesc"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("signOut"), style: "destructive", onPress: () => signOut() },
    ]);
  // signed in: the account goes first (server), then everything on the phone
  const confirmDelete = () =>
    Alert.alert(account ? t("deleteAccount") : t("deleteDataAsk"), account ? t("deleteAccountDesc") : t("deleteDataDesc"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: account ? t("deleteAccount") : t("deleteData"),
        style: "destructive",
        onPress: async () => {
          if (account) {
            try {
              await deleteAccount();
            } catch {
              return Alert.alert(t("deleteAccountFailed"));
            }
          }
          const { server } = await deleteMyData();
          Alert.alert(t("deleteDataDone"), server ? undefined : t("deleteDataOffline"), [{ text: "OK", onPress: restartApp }]);
        },
      },
    ]);
  const [sound, setSound] = useState(soundsOn() ? "on" : "off");
  const reminders = useReminders();

  return (
    <Page topInset>
      <Text style={T.largeTitle}>{t("tabSettings")}</Text>

      <SectionLabel>{t("settingsLanguage")}</SectionLabel>
      <Segmented
        value={locale}
        onChange={setLocale}
        options={[
          { value: "tr", label: "Türkçe" },
          { value: "en", label: "English" },
        ]}
      />

      <SectionLabel>{t("settingsSound")}</SectionLabel>
      <Segmented
        value={sound}
        onChange={(v) => {
          setSound(v);
          setSoundsOn(v === "on");
          if (v === "on") play("coin");
        }}
        options={[
          { value: "on", label: t("soundOn") },
          { value: "off", label: t("soundOff") },
        ]}
      />

      <SectionLabel>{t("settingsReminders")}</SectionLabel>
      <Segmented
        value={reminders.on ? "on" : "off"}
        onChange={async (v) => {
          const on = await setRemindersOn(v === "on");
          if (v === "on" && !on) remindersDenied(t);
        }}
        options={[
          { value: "on", label: t("soundOn") },
          { value: "off", label: t("soundOff") },
        ]}
      />
      <Text style={[T.caption, { marginTop: 6 }]}>{t("settingsRemindersNote")}</Text>

      <SectionLabel>{t("howToPlay")}</SectionLabel>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {games.map((g, i) => (
          <Row key={g.key} image={g.image} title={g.title} onPress={() => setSheet(g.key)} last={!ONBOARDING && i === games.length - 1} />
        ))}
        {ONBOARDING && <Row icon="sparkles" iconFallback="✨" color={C.greenMid} soft={C.greenSoft} title={t("obReplay")} onPress={() => router.push("/onboarding")} last />}
      </Card>

      {account && (
        <>
          <SectionLabel>{t("accountSection")}</SectionLabel>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <Row
              icon="rectangle.portrait.and.arrow.right"
              iconFallback="↩"
              color={C.text2}
              soft="#EEF2EF"
              title={t("signOut")}
              subtitle={t(account.provider === "apple" ? "signedInApple" : "signedInGoogle")}
              onPress={confirmSignOut}
              last
            />
          </Card>
        </>
      )}

      <SectionLabel>{t("privacyTitle")}</SectionLabel>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <Row image={BRAND.settings.privacy} title={t("privacyPolicy")} onPress={() => Linking.openURL(PRIVACY_URL)} />
        <Row image={BRAND.settings.support} title={t("support")} onPress={() => Linking.openURL(SUPPORT_URL)} />
        <Row image={BRAND.settings.delete} title={account ? t("deleteAccount") : t("deleteData")} onPress={confirmDelete} last />
      </Card>

      <SectionLabel>{t("about")}</SectionLabel>
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={[T.body, { color: C.text }]}>{t("version")}</Text>
          <Text style={T.body}>{Constants.expoConfig?.version ?? "1.0.0"}</Text>
        </View>
      </Card>

      <InfoSheet visible={!!open} onClose={() => setSheet(null)} title={open?.title ?? ""}>
        {open?.steps}
      </InfoSheet>
    </Page>
  );
}
