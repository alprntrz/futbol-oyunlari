import { router, Stack } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { randomMatch } from "@/lib/daily";
import type { Difficulty } from "@/lib/types";

import { Screen } from "~/components/Screen";
import { Button, Tap } from "~/components/ui";
import { useI18n } from "~/lib/i18n";
import { getSocket } from "~/lib/socket";
import { setNick } from "~/lib/raceSession";
import { C, F } from "~/lib/theme";

const TIMEOUT_MS = 6000;

export default function RaceLobby() {
  const { t } = useI18n();
  const [nick, setNickInput] = useState("");
  const [code, setCode] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Emit with an ack, failing cleanly if the server can't be reached. */
  const call = <T,>(event: string, payload: object, done: (res: T) => void) => {
    setBusy(true);
    setError(null);
    getSocket()
      .timeout(TIMEOUT_MS)
      .emit(event, payload, (err: Error | null, res: T) => {
        setBusy(false);
        if (err) setError(t("serverUnreachable"));
        else done(res);
      });
  };

  const create = () =>
    call<{ ok: boolean; room?: { code: string } }>("room:create", { nick, difficulty, matchId: randomMatch().id }, (res) => {
      if (res.ok && res.room) {
        setNick(nick);
        router.push({ pathname: "/eksik-11/oda/[code]", params: { code: res.room.code } });
      }
    });

  const join = () => {
    if (!code.trim()) return;
    call<{ ok: boolean; error?: string; room?: { code: string } }>("room:join", { code: code.trim().toUpperCase(), nick }, (res) => {
      if (res.ok && res.room) {
        setNick(nick);
        router.push({ pathname: "/eksik-11/oda/[code]", params: { code: res.room.code } });
      } else setError(res.error === "full" ? t("roomFull") : t("roomNotFound"));
    });
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: t("onlineRace") }} />
      <View style={{ width: "100%", gap: 16 }}>
        <Text style={styles.desc}>{t("raceDesc")}</Text>
        <TextInput value={nick} onChangeText={setNickInput} placeholder={t("yourName")} placeholderTextColor={C.textMute} maxLength={20} style={styles.input} />

        <View style={styles.box}>
          <Text style={styles.boxTitle}>{t("createRoom")}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["normal", "hard"] as const).map((d) => (
              <Tap
                key={d}
                onPress={() => setDifficulty(d)}
                style={[styles.seg, difficulty === d && { backgroundColor: d === "normal" ? C.indigo : C.rose }]}
              >
                <Text style={[styles.segText, difficulty === d && { color: "white" }]}>{t(d)}</Text>
              </Tap>
            ))}
          </View>
          <Button title={t("createRoom")} color="#059669" onPress={create} disabled={busy} />
        </View>

        <View style={styles.box}>
          <Text style={styles.boxTitle}>{t("joinRoom")}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              value={code}
              onChangeText={(v) => {
                setCode(v.toUpperCase());
                setError(null);
              }}
              placeholder={t("roomCode")}
              placeholderTextColor="#52525b"
              maxLength={5}
              autoCapitalize="characters"
              autoCorrect={false}
              style={[styles.input, styles.code]}
            />
            <Button title={t("joinRoom")} onPress={join} disabled={busy} />
          </View>
        </View>
        {busy && <Text style={styles.info}>{t("connecting")}</Text>}
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  desc: { color: C.textDim, fontFamily: F.body, fontSize: 14, textAlign: "center" },
  input: { borderWidth: 1, borderColor: "#52525b", backgroundColor: C.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontFamily: F.bold, fontSize: 16 },
  code: { flex: 1, fontFamily: F.black, letterSpacing: 4, fontSize: 18 },
  box: { borderWidth: 1, borderColor: C.border, backgroundColor: "rgba(24,24,27,0.6)", borderRadius: 16, padding: 14, gap: 12 },
  boxTitle: { color: "#d4d4d8", fontFamily: F.black, fontSize: 14 },
  seg: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: "center", backgroundColor: C.surface2 },
  segText: { color: C.textDim, fontFamily: F.black, fontSize: 14 },
  info: { color: C.textDim, fontFamily: F.bold, textAlign: "center" },
  error: { color: "#f87171", fontFamily: F.bold, textAlign: "center" },
});
