import { Text } from "~/components/Text";
import { remindersDenied } from "~/components/ReminderAsk";
import { Card, SectionLabel, SwitchRow } from "~/components/ui";
import { useAccount } from "~/lib/account";
import { useI18n } from "~/lib/i18n";
import { askPush, pushAvailable, setPushPref, usePush, usePushPermission, type PushCategory } from "~/lib/push";
import { T } from "~/lib/theme";

const ROWS: { key: PushCategory; title: "pushInvites" | "pushFriends" | "pushNews"; desc: "pushInvitesDesc" | "pushFriendsDesc" | "pushNewsDesc" }[] = [
  { key: "invites", title: "pushInvites", desc: "pushInvitesDesc" },
  { key: "friends", title: "pushFriends", desc: "pushFriendsDesc" },
  { key: "news", title: "pushNews", desc: "pushNewsDesc" },
];

/**
 * Settings → Notifications (signed in only): the three push categories. A switch shows off while
 * the phone doesn't allow notifications; turning one on asks iOS / Android first.
 */
export function PushSettings() {
  const { t, locale } = useI18n();
  const account = useAccount();
  const { prefs } = usePush();
  const permission = usePushPermission();
  if (!pushAvailable || !account) return null;
  const allowed = permission === "granted";

  const change = async (key: PushCategory, on: boolean) => {
    await setPushPref(key, on, locale, account.id);
    if (on && !allowed && !(await askPush(locale, account.id))) remindersDenied(t);
  };

  return (
    <>
      <SectionLabel>{t("settingsPush")}</SectionLabel>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {ROWS.map((r, i) => (
          <SwitchRow key={r.key} title={t(r.title)} subtitle={t(r.desc)} value={allowed && prefs[r.key]} onChange={(on) => change(r.key, on)} last={i === ROWS.length - 1} />
        ))}
      </Card>
      <Text style={[T.caption, { marginTop: 6 }]}>{t("settingsPushNote")}</Text>
    </>
  );
}
