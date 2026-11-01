import { useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { Alert, BackHandler } from "react-native";

import { Icon, Tap } from "~/components/ui";
import { useI18n } from "~/lib/i18n";
import { C } from "~/lib/theme";

/**
 * While `live`, backing out of an online match asks first: leaving a live match counts as a loss
 * on the server and pays no XP. The header back button is replaced by one that asks, the iOS swipe
 * back is off and Android's back button asks; usePreventRemove still catches anything else that
 * would close the screen (a back button calling router.back()).
 * Returns `leave()`: go back without asking (the player already confirmed, e.g. forfeit).
 */
export function useLeaveGuard(live: boolean) {
  const { t } = useI18n();
  const navigation = useNavigation();
  const confirmed = useRef(false);

  const leave = useCallback(() => {
    confirmed.current = true;
    navigation.goBack();
  }, [navigation]);

  const ask = useCallback(
    (go: () => void) =>
      Alert.alert(t("leaveMatchAsk"), t("leaveMatchDesc"), [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("leaveMatchGo"),
          style: "destructive",
          onPress: () => {
            confirmed.current = true;
            go();
          },
        },
      ]),
    [t]
  );

  usePreventRemove(live, ({ data }) => {
    if (confirmed.current) return navigation.dispatch(data.action);
    ask(() => navigation.dispatch(data.action));
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      gestureEnabled: !live,
      headerBackVisible: !live,
      headerLeft: live
        ? () => (
            <Tap onPress={() => ask(() => navigation.goBack())} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("back")}>
              <Icon name="chevron.left" size={22} color={C.text} />
            </Tap>
          )
        : undefined,
    });
  }, [live, navigation, ask, t]);

  useEffect(() => {
    if (!live) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      ask(() => navigation.goBack());
      return true;
    });
    return () => sub.remove();
  }, [live, navigation, ask]);

  return leave;
}
