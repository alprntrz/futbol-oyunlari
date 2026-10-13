import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Share, StyleSheet, TextInput, View } from "react-native";
import Animated from "react-native-reanimated";

import { Avatar } from "~/components/Avatar";
import { softIn } from "~/components/motion";
import { RankChip } from "~/components/Rank";
import { SignInCard } from "~/components/SignInCard";
import { Text } from "~/components/Text";
import { Button, Card, Icon, Page, SectionLabel, Tap } from "~/components/ui";
import { addFriend, fetchFriends, removeFriend, useAccount, type Friend, type FriendsInfo } from "~/lib/account";
import { haptic } from "~/lib/haptics";
import { gridToIds } from "~/lib/hattrick";
import { useI18n } from "~/lib/i18n";
import { dealGrid, useHtLeague } from "~/lib/league";
import { loadNick } from "~/lib/nick";
import { getSocket } from "~/lib/socket";
import { C, F, R, T } from "~/lib/theme";
import { GameBg, outline } from "~/components/game";

/**
 * Friends: your code to share, add someone by theirs, and invite an online friend
 * straight into a Tic-Tac-Toe room. Signed-in players only (the code lives on the account).
 */
export default function Friends() {
  const { t } = useI18n();
  const account = useAccount();
  const [league] = useHtLeague();
  const [info, setInfo] = useState<FriendsInfo | null>(null);
  const [error, setError] = useState(false);
  const [code, setCode] = useState("");
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!account) return;
      let live = true;
      const load = () =>
        fetchFriends()
          .then((d) => live && (setInfo(d), setError(false)))
          .catch(() => live && setError(true));
      load();
      // online dots stay fresh while the screen is open
      const id = setInterval(load, 15000);
      return () => {
        live = false;
        clearInterval(id);
      };
    }, [account])
  );

  const add = async () => {
    const c = code.trim().toUpperCase();
    if (c.length < 4) return;
    setBusy("add");
    const res = await addFriend(c);
    setBusy(null);
    if (typeof res === "string") {
      haptic.error();
      setNote({ text: t(res === "not_found" ? "friendsNotFound" : res === "self" ? "friendsSelf" : res === "limit" ? "friendsLimit" : "friendsError"), ok: false });
      return;
    }
    haptic.success();
    setInfo(res);
    setCode("");
    setNote({ text: t("friendsAdded"), ok: true });
  };

  const remove = (f: Friend) =>
    Alert.alert(t("friendsRemove"), t("friendsRemoveConfirm").replace("{nick}", f.nick), [
      { text: t("cancel"), style: "cancel" },
      { text: t("friendsRemove"), style: "destructive", onPress: () => removeFriend(f.code).then(setInfo).catch(() => setNote({ text: t("friendsError"), ok: false })) },
    ]);

  // open a Tic-Tac-Toe room, ring the friend's phone, then wait in the room
  const invite = async (f: Friend) => {
    if (!f.online) return setNote({ text: t("friendsInviteOffline").replace("{nick}", f.nick), ok: false });
    setBusy(f.code);
    const socket = getSocket();
    const fail = () => {
      setBusy(null);
      haptic.error();
      setNote({ text: t("friendsError"), ok: false });
    };
    socket
      .timeout(6000)
      .emit("ht:create", { nick: await loadNick(), grid: gridToIds(dealGrid(league)), steals: false, league }, (err: Error | null, res?: { ok: boolean; room?: { code: string } }) => {
        const room = res?.room?.code;
        if (err || !res?.ok || !room) return fail();
        socket.timeout(6000).emit("fr:invite", { to: f.code, game: "ht", room }, (err2: Error | null, r?: { ok: boolean; error?: string }) => {
          setBusy(null);
          if (err2 || !r?.ok) {
            if (r?.error === "offline") return setNote({ text: t("friendsInviteOffline").replace("{nick}", f.nick), ok: false });
            return fail();
          }
          haptic.success();
          setNote({ text: t("friendsInviteSent"), ok: true });
          router.push({ pathname: "/hat-trick/oda/[code]", params: { code: room } });
        });
      });
  };

  return (
    <Page topInset background={<GameBg />}>
      <Text style={[outline(40), { marginBottom: 6 }]}>{t("friends")}</Text>
      {account === undefined ? null : !account ? (
        <>
          <Text style={[T.body, { marginBottom: 12, color: "white" }]}>{t("friendsSignIn")}</Text>
          <SignInCard />
        </>
      ) : (
        <>
          <Card style={styles.codeCard}>
            <Text style={T.caption}>{t("friendsMyCode")}</Text>
            {info ? (
              <Text style={styles.code} selectable accessibilityLabel={info.code.split("").join(" ")}>
                {info.code}
              </Text>
            ) : error ? (
              <Text style={[T.body, { color: C.red }]}>{t("friendsError")}</Text>
            ) : (
              <ActivityIndicator style={{ marginVertical: 14 }} />
            )}
            <Button
              title={t("friendsShare")}
              icon="square.and.arrow.up"
              kind="secondary"
              disabled={!info}
              onPress={() => info && Share.share({ message: t("friendsShareText").replace("{code}", info.code) })}
            />
            <Text style={[T.caption, { marginTop: 10, textAlign: "center" }]}>{t("friendsPrivacy")}</Text>
          </Card>

          <SectionLabel>{t("friendsAddTitle")}</SectionLabel>
          <View style={styles.addRow}>
            <TextInput
              value={code}
              onChangeText={(v) => {
                setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8));
                setNote(null);
              }}
              onSubmitEditing={add}
              placeholder={t("friendsAddPlaceholder")}
              placeholderTextColor={C.text3}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              style={[styles.input, !code && styles.inputEmpty]}
            />
            <Button title={t("friendsAdd")} onPress={add} disabled={busy === "add" || code.trim().length < 4} style={{ minWidth: 92 }} />
          </View>
          {note && <Text style={[T.caption, { marginTop: 8, fontWeight: "700", color: note.ok ? "#9BE15D" : "#FFB4B4" }]}>{note.text}</Text>}

          <SectionLabel>{t("friends")}</SectionLabel>
          {info && info.friends.length === 0 && <Text style={[T.body, { color: "rgba(255,255,255,0.85)" }]}>{t("friendsEmpty")}</Text>}
          {info && info.friends.length > 0 && (
            <Card style={{ paddingVertical: 4 }}>
              {info.friends.map((f, i) => (
                <Animated.View key={f.code} entering={softIn(i)} style={[styles.friend, i > 0 && styles.divider]}>
                  <Tap onLongPress={() => remove(f)} delayLongPress={400} style={styles.who} accessibilityLabel={`${f.nick}, ${f.online ? t("friendsOnline") : t("friendsOffline")}`} accessibilityHint={t("friendsRemove")}>
                    <View>
                      <Avatar id={f.avatar} size={44} />
                      <View style={[styles.dot, { backgroundColor: f.online ? C.green : "#C7CDC9" }]} />
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={styles.nick} numberOfLines={1}>
                        {f.nick || "—"}
                      </Text>
                      <RankChip level={f.level} compact size="sm" />
                    </View>
                  </Tap>
                  {busy === f.code ? (
                    <ActivityIndicator style={{ width: 96 }} />
                  ) : (
                    <Tap onPress={() => invite(f)} style={[styles.invite, !f.online && styles.inviteOff]} accessibilityRole="button" accessibilityLabel={`${t("friendsInvite")} ${f.nick}`}>
                      <Icon name="paperplane.fill" size={13} color={f.online ? "white" : C.text3} fallback="✈" />
                      <Text style={[styles.inviteText, !f.online && { color: C.text3 }]}>{f.online ? t("friendsInvite") : t("friendsOffline")}</Text>
                    </Tap>
                  )}
                </Animated.View>
              ))}
            </Card>
          )}
          {info && info.friends.length > 0 && <Text style={[T.caption, { marginTop: 8, textAlign: "center", color: "rgba(255,255,255,0.75)" }]}>{t("friendsHoldToRemove")}</Text>}
        </>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  codeCard: { alignItems: "stretch", gap: 6 },
  code: { fontFamily: F.black, fontSize: 40, letterSpacing: 6, color: C.text, textAlign: "center", marginVertical: 6 },
  addRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  input: {
    flex: 1,
    minHeight: 50,
    borderRadius: R.button,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    fontFamily: F.display,
    fontSize: 20,
    letterSpacing: 3,
    color: C.text,
  },
  inputEmpty: { letterSpacing: 0, fontFamily: undefined, fontSize: 17 },
  friend: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 12 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  who: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  dot: { position: "absolute", right: 0, bottom: 0, width: 13, height: 13, borderRadius: 7, borderWidth: 2, borderColor: C.card },
  nick: { fontFamily: F.display, fontSize: 18, color: C.text },
  invite: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.blue, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  inviteOff: { backgroundColor: C.bg },
  inviteText: { fontFamily: F.display, fontSize: 15, color: "white" },
});
