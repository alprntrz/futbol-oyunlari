import { router, Stack, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { Text } from "./Text";
import { Button, Card, Icon, Page, SectionLabel } from "./ui";
import { useI18n } from "~/lib/i18n";
import { loadNick, loadPlayerId, saveNick } from "~/lib/nick";
import { setNick } from "~/lib/raceSession";
import { getSocket } from "~/lib/socket";
import { C, F, T } from "~/lib/theme";

const TIMEOUT_MS = 6000;

/**
 * Online lobby shared by the multiplayer games: create a room (the creator's
 * phone deals the board) or join by code, then open the game's room screen.
 */
export function OnlineLobby({
  game,
  title,
  createPayload,
  roomHref,
  createOptions,
}: {
  /** socket event prefix: "ht" (Hat-trick), "pp" (Possession Play) or "qz" (Quiz) */
  game: "ht" | "pp" | "qz";
  title: string;
  createPayload: () => object;
  roomHref: (code: string) => Href;
  /** game options shown above the Create button */
  createOptions?: React.ReactNode;
}) {
  const { t } = useI18n();
  const [nick, setNickInput] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Start from this phone's saved nickname
  const [pid, setPid] = useState("");
  useEffect(() => {
    loadNick().then(setNickInput);
    loadPlayerId().then(setPid);
  }, []);

  /** Emit with an ack, failing cleanly if the server can't be reached. */
  const call = <R,>(event: string, payload: object, done: (res: R) => void) => {
    setBusy(true);
    setError(null);
    getSocket()
      .timeout(TIMEOUT_MS)
      .emit(event, payload, (err: Error | null, res: R) => {
        setBusy(false);
        if (err) setError(t("serverUnreachable"));
        else done(res);
      });
  };

  const goToRoom = (roomCode: string) => {
    setNick(nick);
    saveNick(nick);
    router.push(roomHref(roomCode));
  };

  const create = () =>
    call<{ ok: boolean; room?: { code: string } }>(`${game}:create`, { nick, pid, ...createPayload() }, (res) => {
      if (res.ok && res.room) goToRoom(res.room.code);
    });

  const join = () => {
    if (code.trim().length < 5) return;
    call<{ ok: boolean; error?: string; room?: { code: string } }>(`${game}:join`, { code: code.trim().toUpperCase(), nick, pid }, (res) => {
      if (res.ok && res.room) goToRoom(res.room.code);
      else setError(res.error === "full" ? t("roomFull") : res.error === "started" ? t("qzRoomStarted") : t("roomNotFound"));
    });
  };

  return (
    <Page>
      <Stack.Screen options={{ title: t("htOnline") }} />
      <Text style={T.title}>{title}</Text>
      <Text style={[T.body, { marginTop: 4 }]}>{t("htOnlineDesc")}</Text>

      <SectionLabel>{t("yourName")}</SectionLabel>
      <TextInput value={nick} onChangeText={setNickInput} placeholder={t("yourName")} placeholderTextColor={C.text3} maxLength={20} style={styles.input} />

      <Card style={styles.block}>
        <View style={styles.blockHead}>
          <View style={[styles.badge, { backgroundColor: C.greenSoft }]}>
            <Icon name="plus" size={18} color={C.greenMid} fallback="+" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={T.headline}>{t("createRoom")}</Text>
            <Text style={[T.body, { fontSize: 14 }]}>{t("createRoomDesc")}</Text>
          </View>
        </View>
        {createOptions}
        <Button title={t("createRoom")} onPress={create} disabled={busy} />
      </Card>

      <Card style={styles.block}>
        <View style={styles.blockHead}>
          <View style={[styles.badge, { backgroundColor: C.bg }]}>
            <Icon name="arrow.right.circle.fill" size={18} color={C.text2} fallback="→" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={T.headline}>{t("joinRoom")}</Text>
            <Text style={[T.body, { fontSize: 14 }]}>{t("joinRoomDesc")}</Text>
          </View>
        </View>
        <TextInput
          value={code}
          onChangeText={(v) => {
            setCode(v.toUpperCase());
            setError(null);
          }}
          placeholder="ABC12"
          placeholderTextColor={C.text3}
          maxLength={5}
          autoCapitalize="characters"
          autoCorrect={false}
          accessibilityLabel={t("roomCode")}
          style={[styles.input, styles.code]}
        />
        <Button title={t("joinRoom")} kind="secondary" onPress={join} disabled={busy || code.trim().length < 5} />
      </Card>

      {busy && <Text style={[T.body, { textAlign: "center", marginTop: 16 }]}>{t("connecting")}</Text>}
      {error && <Text style={[T.body, { textAlign: "center", marginTop: 16, color: C.red, fontWeight: "600" }]}>{error}</Text>}
    </Page>
  );
}

const styles = StyleSheet.create({
  input: { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: C.text },
  code: { fontFamily: F.black, fontSize: 30, letterSpacing: 8, textAlign: "center" },
  block: { marginTop: 16, gap: 14 },
  blockHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  badge: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
