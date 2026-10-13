import { TabList, Tabs, TabSlot, TabTrigger, type TabTriggerSlotProps } from "expo-router/ui";
import { useFocusEffect } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { forwardRef, useCallback, useEffect } from "react";
import { Image, Pressable, StyleSheet, View, type ImageSourcePropType } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Bang, G, Grad, outline } from "~/components/game";
import { Text } from "~/components/Text";
import { OYUN } from "~/lib/brand";
import { useDailyRewards } from "~/lib/dailyRewards";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { useQuests } from "~/lib/quests";

type TabDef = { name: string; href: "/oyunlar" | "/gunluk" | "/" | "/arkadaslar" | "/istatistik"; label: string; art: ImageSourcePropType };

/**
 * Draft Showdown tab bar: a row of lavender card tabs rising from the bottom,
 * the open one taller and lighter with its name; icons float on the cards.
 */
export default function TabsLayout() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { claimed } = useDailyRewards();
  const quests = useQuests();
  const dailyDue = !claimed || quests.some((q) => q.progress < q.target);
  // every tab sits on the violet: light status bar while the tabs are showing
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("light");
      return () => setStatusBarStyle("dark");
    }, [])
  );

  const tabs: TabDef[] = [
    { name: "oyunlar", href: "/oyunlar", label: t("tabGames"), art: OYUN.tab.games },
    { name: "gunluk", href: "/gunluk", label: t("tabDaily"), art: OYUN.tab.daily },
    { name: "index", href: "/", label: t("tabPlay"), art: OYUN.tab.play },
    { name: "arkadaslar", href: "/arkadaslar", label: t("tabFriends"), art: OYUN.tab.friends },
    { name: "istatistik", href: "/istatistik", label: t("tabProfile"), art: OYUN.tab.profile },
  ];

  return (
    <Tabs>
      <View style={{ flex: 1, backgroundColor: G.bg }}>
        <TabSlot />
      </View>
      <TabList asChild>
        <View style={StyleSheet.flatten([styles.bar, { height: 92 + insets.bottom * 0.6 }])}>
          {tabs.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <TabButton tab={tab} badge={tab.name === "gunluk" && dailyDue} bottom={insets.bottom * 0.6} />
            </TabTrigger>
          ))}
        </View>
      </TabList>
    </Tabs>
  );
}

const TabButton = forwardRef<View, TabTriggerSlotProps & { tab: TabDef; badge: boolean; bottom: number }>(function TabButton({ tab, badge, bottom, isFocused, onPress, ...rest }, ref) {
  const rise = useSharedValue(isFocused ? 1 : 0);
  useEffect(() => {
    rise.set(withSpring(isFocused ? 1 : 0, { damping: 14, stiffness: 230 }));
  }, [isFocused, rise]);
  const cardStyle = useAnimatedStyle(() => ({ height: 84 + bottom + 18 * rise.get() }));
  const artStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -6 * rise.get() }, { scale: 1 + 0.12 * rise.get() }] }));

  return (
    <Pressable
      ref={ref}
      {...rest}
      onPress={(e) => {
        if (!isFocused) haptic.tap();
        onPress?.(e);
      }}
      accessibilityRole="tab"
      accessibilityState={{ selected: !!isFocused }}
      accessibilityLabel={tab.label}
      style={[styles.slot, isFocused && { zIndex: 2, flex: 1.25 }]}
    >
      <Animated.View style={[styles.card, cardStyle]}>
        <Grad from={isFocused ? G.lav1 : G.lavIdle1} to={isFocused ? G.lav2 : G.lavIdle2} />
        <View style={styles.cardTop} />
        <Animated.View style={[styles.artWrap, artStyle]}>
          <Image source={tab.art} style={styles.art} />
          {badge && <Bang size={24} style={styles.badge} />}
        </Animated.View>
        {isFocused && (
          <Text style={[outline(16, "#FFFFFF", G.ink), styles.label]} numberOfLines={1}>
            {tab.label.toUpperCase()}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "flex-end", backgroundColor: G.bg, paddingHorizontal: 2, overflow: "visible" },
  slot: { flex: 1, justifyContent: "flex-end", marginHorizontal: -2 },
  card: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 2.5,
    borderBottomWidth: 0,
    borderColor: G.ink,
    overflow: "hidden",
    alignItems: "center",
  },
  cardTop: { position: "absolute", top: 0, left: 10, right: 10, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.7)" },
  artWrap: { marginTop: 8 },
  art: { width: 56, height: 56 },
  badge: { position: "absolute", top: -4, right: -10 },
  label: { marginTop: -2 },
});
