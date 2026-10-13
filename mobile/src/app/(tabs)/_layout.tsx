import { TabList, Tabs, TabSlot, TabTrigger, type TabTriggerSlotProps } from "expo-router/ui";
import { useFocusEffect } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { forwardRef, useCallback, useEffect } from "react";
import { Image, Pressable, StyleSheet, View, type ImageSourcePropType } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { G, outline } from "~/components/game";
import { Icon } from "~/components/ui";
import { OYUN } from "~/lib/brand";
import { useDailyRewards } from "~/lib/dailyRewards";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { useQuests } from "~/lib/quests";

type TabDef = { name: string; href: "/oyunlar" | "/gunluk" | "/" | "/arkadaslar" | "/istatistik"; label: string; art: ImageSourcePropType; color: string; edge: string };

/**
 * Game-style tab bar (after Draft Showdown): a dark strip of chunky coloured
 * tiles; the open tab rises, grows and shows its name. Play sits in the middle.
 */
export default function TabsLayout() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { claimed } = useDailyRewards();
  const quests = useQuests();
  const dailyDue = !claimed || quests.some((q) => q.progress < q.target);
  // every tab sits on the dark green: light status bar while the tabs are showing
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("light");
      return () => setStatusBarStyle("dark");
    }, [])
  );

  const tabs: TabDef[] = [
    { name: "oyunlar", href: "/oyunlar", label: t("tabGames"), art: OYUN.tab.games, color: G.blue, edge: G.blueEdge },
    { name: "gunluk", href: "/gunluk", label: t("tabDaily"), art: OYUN.tab.daily, color: G.orange, edge: G.orangeEdge },
    { name: "index", href: "/", label: t("tabPlay"), art: OYUN.tab.play, color: G.lime, edge: G.limeEdge },
    { name: "arkadaslar", href: "/arkadaslar", label: t("tabFriends"), art: OYUN.tab.friends, color: G.purple, edge: G.purpleEdge },
    { name: "istatistik", href: "/istatistik", label: t("tabProfile"), art: OYUN.tab.profile, color: G.pink, edge: G.pinkEdge },
  ];

  return (
    <Tabs>
      <TabSlot />
      <TabList asChild>
        <View style={StyleSheet.flatten([styles.bar, { paddingBottom: Math.max(insets.bottom - 6, 8) }])}>
          {tabs.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <TabButton tab={tab} badge={tab.name === "gunluk" && dailyDue} />
            </TabTrigger>
          ))}
        </View>
      </TabList>
    </Tabs>
  );
}

const TabButton = forwardRef<View, TabTriggerSlotProps & { tab: TabDef; badge: boolean }>(function TabButton({ tab, badge, isFocused, onPress, ...rest }, ref) {
  const lift = useSharedValue(isFocused ? 1 : 0);
  useEffect(() => {
    lift.set(withSpring(isFocused ? 1 : 0, { damping: 13, stiffness: 220 }));
  }, [isFocused, lift]);
  const tileStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -14 * lift.get() }, { scale: 1 + 0.16 * lift.get() }] }));

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
      style={styles.slot}
    >
      <Animated.View style={[styles.tile, { backgroundColor: tab.edge }, !isFocused && styles.tileIdle, tileStyle]}>
        <View style={[styles.face, { backgroundColor: tab.color }]}>
          <View style={styles.shine} />
          <Image source={tab.art} style={styles.art} />
        </View>
        {badge && (
          <View style={styles.badge}>
            <Icon name="exclamationmark" size={11} color="white" fallback="!" />
          </View>
        )}
      </Animated.View>
      <View style={styles.labelSlot}>{isFocused && <Animated.Text style={[outline(14), styles.label]}>{tab.label}</Animated.Text>}</View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    backgroundColor: G.bar,
    borderTopWidth: 3,
    borderTopColor: G.barEdge,
    paddingTop: 10,
    paddingHorizontal: 6,
  },
  slot: { flex: 1, alignItems: "center" },
  tile: { width: 58, height: 58, borderRadius: 16, paddingBottom: 5, borderWidth: 2.5, borderColor: G.ink },
  tileIdle: { opacity: 0.88 },
  face: { flex: 1, borderRadius: 12, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  art: { width: 44, height: 44 },
  shine: { position: "absolute", top: 3, left: 6, right: 6, height: "40%", borderRadius: 9, backgroundColor: "rgba(255,255,255,0.25)" },
  badge: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#22C55E",
    borderWidth: 2,
    borderColor: G.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  labelSlot: { height: 18, justifyContent: "center", marginTop: -8 },
  label: { textTransform: "uppercase" },
});
