import * as AppleAuthentication from "expo-apple-authentication";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, View } from "react-native";

import { appleSignInAvailable, googleSignInAvailable, signInWithApple, signInWithGoogle } from "~/lib/account";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { C, R, T } from "~/lib/theme";

import { Text } from "./Text";
import { Button, Card, Icon } from "./ui";

/** Guest only: why to sign in, and the Apple / Google buttons. */
export function SignInCard() {
  const { t } = useI18n();
  const [apple, setApple] = useState(false);
  const [busy, setBusy] = useState(false);
  const google = googleSignInAvailable();

  useEffect(() => {
    appleSignInAvailable().then(setApple);
  }, []);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      if (await fn()) haptic.success();
    } catch {
      Alert.alert(t("signInFailed"));
    } finally {
      setBusy(false);
    }
  };

  if (!apple && !google) return null;

  return (
    <Card style={styles.card}>
      <Text style={T.headline}>{t("signInTitle")}</Text>
      {(["signInPerkCloud", "signInPerkBonus", "signInPerkRank"] as const).map((k) => (
        <View key={k} style={styles.perk}>
          <Icon name="checkmark.circle.fill" size={18} color={C.green} fallback="✓" />
          <Text style={[T.body, { flex: 1, fontSize: 15 }]}>{t(k)}</Text>
        </View>
      ))}

      <View style={{ gap: 10, marginTop: 14 }}>
        {busy ? (
          <ActivityIndicator style={{ height: 50 }} />
        ) : (
          <>
            {apple && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={R.button}
                style={{ height: 50 }}
                onPress={() => run(signInWithApple)}
              />
            )}
            {google && <Button title={t("signInGoogle")} kind="secondary" onPress={() => run(signInWithGoogle)} />}
          </>
        )}
      </View>
      <Text style={[T.caption, { marginTop: 10 }]}>{t("signInPrivacy")}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 16, padding: 18 },
  perk: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginTop: 8 },
});
