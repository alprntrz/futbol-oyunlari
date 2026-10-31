import { useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { useRef } from "react";
import { Alert } from "react-native";

import { useI18n } from "~/lib/i18n";

/**
 * While `live`, backing out of an online match (header back, swipe, Android back, a back button calling
 * router.back()) asks first: leaving a live match counts as a loss on the server.
 * Returns `leave()`: go back without asking (the player already confirmed, e.g. forfeit).
 */
export function useLeaveGuard(live: boolean) {
  const { t } = useI18n();
  const navigation = useNavigation();
  const confirmed = useRef(false);
  usePreventRemove(live, ({ data }) => {
    if (confirmed.current) return navigation.dispatch(data.action);
    Alert.alert(t("leaveMatchAsk"), t("leaveMatchDesc"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("leaveMatchGo"), style: "destructive", onPress: () => navigation.dispatch(data.action) },
    ]);
  });
  return () => {
    confirmed.current = true;
    navigation.goBack();
  };
}
