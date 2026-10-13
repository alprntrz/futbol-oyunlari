import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, View, type ImageSourcePropType } from "react-native";
import Animated, { Easing, FadeIn, Keyframe, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { dailyMatch, dayNumber } from "@/lib/daily";

import { Avatar } from "~/components/Avatar";
import { Bang, Counter, FatBar, G, GameBg, Grad, HexButton, outline, SlantCard } from "~/components/game";
import { RankChip } from "~/components/Rank";
import { Text } from "~/components/Text";
import { loadToday, type Today } from "~/components/TodayPuzzles";
import { Icon, Tap } from "~/components/ui";
import { useAccount } from "~/lib/account";
import { loadAvatar } from "~/lib/avatar";
import { bingoForDay } from "~/lib/bingo";
import { BRAND, OYUN, REWARD } from "~/lib/brand";
import { CALENDAR, claimDaily, useDailyRewards } from "~/lib/dailyRewards";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { loadNick } from "~/lib/nick";
import { usePlayStreak } from "~/lib/playStreak";
import { useQuests } from "~/lib/quests";
import { useQuizDifficulty } from "~/lib/quizLevel";
import { loadXp, onXpAward } from "~/lib/xp";

type GameId = "ht" | "qz" | "pp";
const KEY = "quick-game";
type Xp = Awaited<ReturnType<typeof loadXp>>;

const swapIn = (dir: 1 | -1) =>
  new Keyframe({
    0: { opacity: 0, transform: [{ translateX: 70 * dir }, { scale: 0.8 }] },
    100: { opacity: 1, transform: [{ translateX: 0 }, { scale: 1 }] },
  }).duration(260);

/**
 * Play tab (Draft Showdown's battle screen): who you are and your counters on
 * top, the chosen game big in the middle with its picker, today's puzzle
 * slots, and one big Play button into a random match. Fits one screen.
 */
export default function Home() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const account = useAccount();
  const [level] = useQuizDifficulty();
  const [game, setGame] = useState<GameId>("ht");
  const [dir, setDir] = useState<1 | -1>(1);
  const [nick, setNick] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [xp, setXp] = useState<Xp | null>(null);
  const [today, setToday] = useState<Today | null>(null);
  const streak = usePlayStreak();
  const quests = useQuests();
  const { todayIndex, claimed } = useDailyRewards();

  const day = useMemo(() => dayNumber(), []);
  const xiMatchId = useMemo(() => dailyMatch().match.id, []);
  const bingoLength = useMemo(() => bingoForDay(day).stream.length, [day]);

  useFocusEffect(
    useCallback(() => {
      loadNick().then(setNick);
      loadAvatar().then(setAvatar);
      loadXp().then(setXp);
      loadToday(day, xiMatchId, bingoLength).then(setToday);
    }, [day, xiMatchId, bingoLength])
  );
  useEffect(() => onXpAward(() => loadXp().then(setXp)), []);
  useEffect(() => {
    if (account !== undefined) loadNick().then(setNick);
  }, [account]);
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => (v === "ht" || v === "qz" || v === "pp") && setGame(v))
      .catch(() => {});
  }, []);

  const games: { id: GameId; name: string; art: ImageSourcePropType; play: Href; friend: Href; same: Href | null }[] = [
    { id: "ht", name: t("tikiTakaName"), art: OYUN.hero.ht, play: "/hat-trick/rastgele", friend: "/hat-trick/oda", same: "/hat-trick/yerel" },
    { id: "qz", name: t("qzName"), art: OYUN.hero.qz, play: { pathname: "/bilgi/rastgele", params: { zorluk: level } }, friend: { pathname: "/bilgi/oda", params: { zorluk: level } }, same: null },
    { id: "pp", name: t("ppName"), art: OYUN.hero.pp, play: "/possession/rastgele", friend: "/possession/oda", same: "/possession/yerel" },
  ];
  const i = Math.max(0, games.findIndex((g) => g.id === game));
  const current = games[i];
  const step = (d: 1 | -1) => {
    haptic.tap();
    const next = games[(i + d + games.length) % games.length].id;
    setDir(d);
    setGame(next);
    AsyncStorage.setItem(KEY, next).catch(() => {});
  };

  // the hero art floats a little
  const float = useSharedValue(0);
  useEffect(() => {
    float.set(withRepeat(withSequence(withTiming(-8, { duration: 1400, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) })), -1));
  }, [float]);
  const floatStyle = useAnimatedStyle(() => ({ transform: [{ translateY: float.get() }] }));

  // the gift wiggles until today's reward is taken
  const wiggle = useSharedValue(0);
  useEffect(() => {
    wiggle.set(
      claimed
        ? 0
        : withRepeat(withSequence(withTiming(-10, { duration: 90 }), withTiming(10, { duration: 90 }), withTiming(-6, { duration: 80 }), withTiming(0, { duration: 80 }), withTiming(0, { duration: 1500 })), -1)
    );
  }, [claimed, wiggle]);
  const giftStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${wiggle.get()}deg` }] }));

  const lv = xp?.level ?? 1;
  const fraction = xp ? xp.into / xp.need : 0;
  const questsDone = quests.filter((q) => q.progress >= q.target).length;
  const slots: { key: string; art: ImageSourcePropType; done: boolean; started: boolean }[] = [
    { key: "grid", art: BRAND.icon.tiki, done: today?.grid.state === "done", started: today?.grid.state === "started" },
    { key: "xi", art: BRAND.icon.daily, done: today?.xi.state === "done", started: today?.xi.state === "started" },
    { key: "bingo", art: BRAND.icon.bingo, done: today?.bingo.state === "done", started: today?.bingo.state === "started" },
  ];

  const totalXp = xp?.xp ?? 0;
  const xpText = totalXp >= 10000 ? `${(totalXp / 1000).toFixed(1)}K` : String(totalXp);

  return (
    <View style={{ flex: 1 }}>
      <GameBg />
      <View style={[styles.screen, { paddingTop: insets.top + 4 }]}>
        {/* counters, like the currencies row */}
        <View style={styles.counters}>
          <Counter label={`${totalXp} XP`} value={xpText} icon={<Image source={REWARD.xp} style={styles.counterArt} />} onPress={() => router.push("/istatistik")} />
          <Counter
            label={`${t("streak")}: ${streak.count}`}
            value={String(streak.count)}
            icon={<Icon name="flame.fill" size={30} color={streak.count ? "#FF8A1F" : "#B9A9F2"} fallback="🔥" />}
          />
          <View style={{ flex: 1 }}>
            <Counter
              label={claimed ? t("dailyTitle") : `${t("dailyClaim")} +${CALENDAR[todayIndex]} XP`}
              value={claimed ? "✓" : `+${CALENDAR[todayIndex]}`}
              tint={claimed ? undefined : "rgba(246,185,21,0.85)"}
              icon={
                <Animated.View style={giftStyle}>
                  <Image source={claimed ? REWARD.chestOpen : REWARD.chest} style={styles.counterArt} />
                </Animated.View>
              }
              onPress={() => {
                if (claimed) return router.push("/gunluk");
                haptic.success();
                claimDaily();
              }}
            />
          </View>
        </View>

        {/* you (slanted lime card) and today's quests (slanted gold card) */}
        <View style={styles.cards}>
          <Tap onPress={() => router.push("/istatistik")} style={styles.meTap} accessibilityLabel={nick}>
            <SlantCard from={G.lime1} to={G.lime2} style={styles.meCard}>
              <View style={styles.cardRow}>
                <View style={styles.meAvatar}>
                  <Avatar id={avatar} size={52} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={outline(21)} numberOfLines={1}>
                    {nick}
                  </Text>
                  <View style={styles.pills}>
                    <View style={styles.pill}>
                      <Image source={REWARD.levelBadge} style={{ width: 16, height: 18 }} />
                      <Text style={outline(14)}>{lv}</Text>
                    </View>
                    <RankChip level={lv} compact size="sm" />
                  </View>
                </View>
              </View>
            </SlantCard>
          </Tap>
          <Tap onPress={() => router.push("/gunluk")} style={styles.questTap} accessibilityLabel={`${t("questsTitle")} ${questsDone}/${quests.length}`}>
            <SlantCard from={G.gold1} to={G.gold2} style={styles.questCard}>
              <View style={{ gap: 5 }}>
                <Text style={outline(15, G.brown, "rgba(255,255,255,0.5)")} numberOfLines={1}>
                  {t("questsTitle").toUpperCase()}
                </Text>
                <View style={styles.questRow}>
                  <View style={styles.questLevel}>
                    <Text style={outline(15)}>{questsDone}</Text>
                  </View>
                  <View style={styles.questTrack}>
                    <View style={[styles.questFill, { width: `${(questsDone / Math.max(1, quests.length)) * 100}%` }]} />
                    <Text style={[outline(13), { textAlign: "center" }]}>
                      {questsDone}/{quests.length}
                    </Text>
                  </View>
                </View>
              </View>
            </SlantCard>
            {questsDone < quests.length && <Bang size={26} style={styles.cardBang} />}
          </Tap>
        </View>

        {/* side buttons (left) and settings (right), over the hero */}
        <View style={styles.sideRow}>
          <View style={{ gap: 10 }}>
            <Tap onPress={() => router.push(current.friend)} style={styles.sideBtn} accessibilityLabel={t("htFriend")}>
              <Image source={BRAND.mode.friend} style={styles.sideArt} />
              <Text style={[outline(11), styles.sideLabel]} numberOfLines={1}>
                {t("htFriend")}
              </Text>
            </Tap>
            {current.same && (
              <Tap onPress={() => router.push(current.same!)} style={styles.sideBtn} accessibilityLabel={t("htSame")}>
                <Image source={BRAND.mode.same} style={styles.sideArt} />
                <Text style={[outline(11), styles.sideLabel]} numberOfLines={1}>
                  {t("htSame")}
                </Text>
              </Tap>
            )}
          </View>
          <Tap onPress={() => router.push("/ayarlar")} style={styles.gear} accessibilityLabel={t("tabSettings")}>
            <Icon name="gearshape.fill" size={24} color="#E9E3FF" fallback="⚙" />
          </Tap>
        </View>

        {/* the chosen game, big */}
        <View style={styles.hero} pointerEvents="none">
          <Animated.View key={current.id} entering={swapIn(dir)} style={floatStyle}>
            <Image source={current.art} style={styles.heroArt} resizeMode="contain" />
          </Animated.View>
        </View>

        {/* road to the next rank */}
        <FatBar
          fraction={fraction}
          text={`${xp?.into ?? 0}/${xp?.need ?? 100}`}
          icon={<Image source={REWARD.trophy} style={{ width: 40, height: 40 }} resizeMode="contain" />}
        />

        {/* game picker, the arena switcher */}
        <View style={styles.picker}>
          <Tap onPress={() => step(-1)} style={styles.arrow} accessibilityLabel="◀">
            <Icon name="arrowtriangle.left.fill" size={15} color="#3B2A8F" fallback="◀" />
          </Tap>
          <Animated.View key={current.id} entering={FadeIn.duration(180)} style={styles.pickerName}>
            <Text style={outline(23)} numberOfLines={1} adjustsFontSizeToFit>
              {i + 1}. {current.name}
            </Text>
          </Animated.View>
          <Tap onPress={() => step(1)} style={styles.arrow} accessibilityLabel="▶">
            <Icon name="arrowtriangle.right.fill" size={15} color="#3B2A8F" fallback="▶" />
          </Tap>
        </View>

        {/* today's three puzzles, the chest slots */}
        <Tap onPress={() => router.push("/gunluk")} style={styles.tray} accessibilityLabel={t("homePuzzles")}>
          {slots.map((s) => (
            <View key={s.key} style={[styles.slot, s.done && styles.slotDone]}>
              {!s.done && <Grad from={G.peach1} to={G.peach2} />}
              {s.done ? <Icon name="checkmark" size={24} color="white" fallback="✓" /> : <Image source={s.art} style={{ width: 36, height: 36 }} />}
            </View>
          ))}
        </Tap>

        <View style={{ marginTop: 10 }}>
          <HexButton title={t("qpPlay").toUpperCase()} onPress={() => router.push(current.play)} width={260} height={74} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 10, paddingBottom: 8 },
  counters: { flexDirection: "row", gap: 6, paddingHorizontal: 4 },
  counterArt: { width: 38, height: 38, resizeMode: "contain" },
  cards: { flexDirection: "row", gap: 8, marginTop: 8, marginHorizontal: -14 },
  meTap: { flex: 1.25 },
  meCard: { paddingVertical: 9, paddingLeft: 18, paddingRight: 26 },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  meAvatar: { width: 58, height: 58, borderRadius: 12, backgroundColor: "#7EB6FF", borderWidth: 2.5, borderColor: G.ink, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  pills: { flexDirection: "row", alignItems: "center", gap: 6 },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#5A45C8", borderRadius: 999, borderWidth: 2, borderColor: G.ink, paddingHorizontal: 8, paddingVertical: 1 },
  questTap: { flex: 1 },
  questCard: { paddingVertical: 10, paddingLeft: 30, paddingRight: 22, flex: 1, justifyContent: "center" },
  questRow: { flexDirection: "row", alignItems: "center" },
  questLevel: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#3D8BEA", borderWidth: 2.5, borderColor: G.ink, alignItems: "center", justifyContent: "center", zIndex: 1 },
  questTrack: { flex: 1, height: 22, marginLeft: -8, borderRadius: 11, backgroundColor: "#3A2A90", borderWidth: 2, borderColor: G.ink, overflow: "hidden", justifyContent: "center" },
  questFill: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: "#8E63F2" },
  cardBang: { position: "absolute", top: -10, left: -6 },
  sideRow: { position: "absolute", left: 12, right: 12, top: 200, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", zIndex: 3 },
  sideBtn: { alignItems: "center", width: 66 },
  sideArt: { width: 52, height: 52 },
  sideLabel: { marginTop: -4, textAlign: "center" },
  gear: { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(43,29,107,0.45)", alignItems: "center", justifyContent: "center" },
  hero: { flex: 1, alignItems: "center", justifyContent: "flex-end", minHeight: 170, paddingBottom: 4 },
  heroArt: { width: 250, height: 250 },
  picker: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, marginHorizontal: 30 },
  arrow: { width: 38, height: 40, borderRadius: 10, backgroundColor: "#A994F7", borderWidth: 2.5, borderColor: G.ink, alignItems: "center", justifyContent: "center" },
  pickerName: { flex: 1, height: 40, borderRadius: 10, backgroundColor: G.plate, borderWidth: 2.5, borderColor: G.ink, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  tray: { flexDirection: "row", alignSelf: "center", gap: 10, marginTop: 10, padding: 7, borderRadius: 40, backgroundColor: G.plate, borderWidth: 2.5, borderColor: G.ink },
  slot: { width: 54, height: 54, borderRadius: 27, borderWidth: 2.5, borderColor: G.ink, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  slotDone: { backgroundColor: "#4A36A8" },
});
