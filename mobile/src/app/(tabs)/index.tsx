import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, View, type ImageSourcePropType } from "react-native";
import Animated, { Easing, FadeIn, Keyframe, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { dailyMatch, dayNumber } from "@/lib/daily";
import { rankOf, RANKS } from "@/lib/levels";

import { Avatar } from "~/components/Avatar";
import { ChunkyButton, G, GameBg, outline } from "~/components/game";
import { RankChip } from "~/components/Rank";
import { Text } from "~/components/Text";
import { loadToday, type Today } from "~/components/TodayPuzzles";
import { Icon, Tap } from "~/components/ui";
import { useAccount } from "~/lib/account";
import { loadAvatar } from "~/lib/avatar";
import { bingoForDay } from "~/lib/bingo";
import { BRAND } from "~/lib/brand";
import { CALENDAR, claimDaily, useDailyRewards } from "~/lib/dailyRewards";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { loadNick } from "~/lib/nick";
import { usePlayStreak } from "~/lib/playStreak";
import { useQuests } from "~/lib/quests";
import { useQuizDifficulty } from "~/lib/quizLevel";
import { F } from "~/lib/theme";
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
    { id: "ht", name: t("tikiTakaName"), art: BRAND.icon.tiki, play: "/hat-trick/rastgele", friend: "/hat-trick/oda", same: "/hat-trick/yerel" },
    { id: "qz", name: t("qzName"), art: BRAND.icon.quiz, play: { pathname: "/bilgi/rastgele", params: { zorluk: level } }, friend: { pathname: "/bilgi/oda", params: { zorluk: level } }, same: null },
    { id: "pp", name: t("ppName"), art: BRAND.icon.possession, play: "/possession/rastgele", friend: "/possession/oda", same: "/possession/yerel" },
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
  const rank = rankOf(lv);
  const fraction = xp ? xp.into / xp.need : 0;
  const questsDone = quests.filter((q) => q.progress >= q.target).length;
  const slots: { key: string; art: ImageSourcePropType; done: boolean; started: boolean }[] = [
    { key: "grid", art: BRAND.icon.tiki, done: today?.grid.state === "done", started: today?.grid.state === "started" },
    { key: "xi", art: BRAND.icon.daily, done: today?.xi.state === "done", started: today?.xi.state === "started" },
    { key: "bingo", art: BRAND.icon.bingo, done: today?.bingo.state === "done", started: today?.bingo.state === "started" },
  ];

  return (
    <View style={{ flex: 1 }}>
      <GameBg />
      <View style={[styles.screen, { paddingTop: insets.top + 6 }]}>
        {/* counters: level, streak, today's gift */}
        <View style={styles.counters}>
          <View style={[styles.counter, { flex: 1 }]} accessibilityLabel={`${t("levelN").replace("{n}", String(lv))}`}>
            <View style={styles.levelGem}>
              <View style={styles.levelGemFace} />
              <Text style={outline(16)}>{lv}</Text>
            </View>
            <View style={styles.counterTrack}>
              <View style={[styles.counterFill, { width: `${Math.max(6, fraction * 100)}%` }]} />
              <Text style={[outline(12), styles.counterTrackText]}>
                {xp?.into ?? 0}/{xp?.need ?? 100}
              </Text>
            </View>
          </View>
          <View style={styles.counter} accessibilityLabel={`${t("streak")}: ${streak.count}`}>
            <Icon name="flame.fill" size={18} color={streak.count ? "#FFB020" : "rgba(255,255,255,0.4)"} fallback="🔥" />
            <Text style={outline(17)}>{streak.count}</Text>
          </View>
          <Tap
            onPress={() => {
              if (claimed) return router.push("/gunluk");
              haptic.success();
              claimDaily();
            }}
            accessibilityLabel={claimed ? t("dailyTitle") : `${t("dailyClaim")} +${CALENDAR[todayIndex]} XP`}
          >
            <Animated.View style={[styles.counter, !claimed && { backgroundColor: G.gold, borderColor: G.goldEdge }, giftStyle]}>
              <Icon name={claimed ? "checkmark" : "gift.fill"} size={17} color={claimed ? "rgba(255,255,255,0.6)" : "#3B2A05"} fallback="🎁" />
              {!claimed && <Text style={[styles.giftText]}>+{CALENDAR[todayIndex]}</Text>}
            </Animated.View>
          </Tap>
        </View>

        {/* you, and today's quests */}
        <View style={styles.cards}>
          <Tap onPress={() => router.push("/istatistik")} style={[styles.meCard]} accessibilityLabel={nick}>
            <View style={styles.meAvatar}>
              <Avatar id={avatar} size={46} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={outline(20)} numberOfLines={1}>
                {nick}
              </Text>
              <RankChip level={lv} compact size="sm" />
            </View>
          </Tap>
          <Tap onPress={() => router.push("/gunluk")} style={styles.questCard} accessibilityLabel={`${t("questsTitle")} ${questsDone}/${quests.length}`}>
            <Text style={[outline(13), { color: "#3B2A05", textShadowColor: "rgba(255,255,255,0.4)" }]} numberOfLines={1}>
              {t("questsTitle")}
            </Text>
            <View style={styles.questTrack}>
              <View style={[styles.questFill, { width: `${(questsDone / Math.max(1, quests.length)) * 100}%` }]} />
              <Text style={[outline(12), styles.counterTrackText]}>
                {questsDone}/{quests.length}
              </Text>
            </View>
          </Tap>
          <Tap onPress={() => router.push("/ayarlar")} style={styles.gear} accessibilityLabel={t("tabSettings")}>
            <Icon name="gearshape.fill" size={20} color="white" fallback="⚙" />
          </Tap>
        </View>

        {/* the chosen game, big */}
        <View style={styles.hero}>
          <View style={styles.glow} />
          <Animated.View key={current.id} entering={swapIn(dir)} style={floatStyle}>
            <Image source={current.art} style={styles.heroArt} resizeMode="contain" />
          </Animated.View>
        </View>

        {/* road to the next rank */}
        <View style={styles.roadTrack} accessibilityLabel={rank.nextAt ? t("rankNext").replace("{rank}", t(`rank_${RANKS[rank.index + 1].id}` as Parameters<typeof t>[0])).replace("{n}", String(rank.nextAt)) : t("rankTop")}>
          <View style={[styles.roadFill, { width: `${Math.max(4, (rank.nextAt ? (lv - RANKS[rank.index].from + fraction) / (rank.nextAt - RANKS[rank.index].from) : 1) * 100)}%` }]} />
          <Text style={[outline(14), styles.roadText]}>
            {rank.nextAt
              ? t("rankNext")
                  .replace("{rank}", t(`rank_${RANKS[rank.index + 1].id}` as Parameters<typeof t>[0]))
                  .replace("{n}", String(rank.nextAt))
              : t("rankTop")}
          </Text>
        </View>

        {/* game picker, like the arena switcher */}
        <View style={styles.picker}>
          <Tap onPress={() => step(-1)} style={styles.arrow} accessibilityLabel="◀">
            <Icon name="arrowtriangle.left.fill" size={16} color="white" fallback="◀" />
          </Tap>
          <Animated.View key={current.id} entering={FadeIn.duration(180)} style={{ flex: 1, alignItems: "center" }}>
            <Text style={outline(24)} numberOfLines={1} adjustsFontSizeToFit>
              {current.name}
            </Text>
          </Animated.View>
          <Tap onPress={() => step(1)} style={styles.arrow} accessibilityLabel="▶">
            <Icon name="arrowtriangle.right.fill" size={16} color="white" fallback="▶" />
          </Tap>
        </View>

        {/* today's three puzzles */}
        <Tap onPress={() => router.push("/gunluk")} style={styles.slots} accessibilityLabel={t("homePuzzles")}>
          {slots.map((s) => (
            <View key={s.key} style={[styles.slot, s.done && styles.slotDone]}>
              {s.done ? <Icon name="checkmark" size={22} color="white" fallback="✓" /> : <Image source={s.art} style={{ width: 34, height: 34, opacity: s.started ? 1 : 0.85 }} />}
            </View>
          ))}
        </Tap>

        <ChunkyButton title={t("qpPlay").toUpperCase()} size="lg" onPress={() => router.push(current.play)} style={styles.play} />

        <View style={styles.more}>
          <ChunkyButton title={t("htFriend")} icon="person.2.fill" size="sm" color={G.blue} edge={G.blueEdge} onPress={() => router.push(current.friend)} style={{ flex: 1 }} />
          {current.same && (
            <ChunkyButton title={t("htSame")} icon="iphone" size="sm" color={G.teal} edge={G.tealEdge} onPress={() => router.push(current.same!)} style={{ flex: 1 }} />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 14, paddingBottom: 12 },
  counters: { flexDirection: "row", alignItems: "center", gap: 8 },
  counter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.12)",
  },
  giftText: { fontFamily: F.black, fontSize: 17, color: "#3B2A05" },
  levelGem: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  levelGemFace: { position: "absolute", width: 24, height: 24, borderRadius: 7, backgroundColor: G.purple, borderWidth: 2, borderColor: G.ink, transform: [{ rotate: "45deg" }] },
  counterTrack: { flex: 1, height: 18, borderRadius: 9, backgroundColor: "rgba(0,0,0,0.35)", overflow: "hidden", justifyContent: "center" },
  counterFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 9, backgroundColor: G.purple },
  counterTrackText: { textAlign: "center" },
  cards: { flexDirection: "row", gap: 8, marginTop: 10, alignItems: "stretch" },
  meCard: { flex: 1.35, flexDirection: "row", alignItems: "center", gap: 10, padding: 8, borderRadius: 16, backgroundColor: "#7CC242", borderWidth: 2.5, borderColor: G.ink, borderBottomWidth: 6 },
  meAvatar: { width: 50, height: 50, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.9)", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  questCard: { flex: 1, padding: 8, gap: 6, borderRadius: 16, backgroundColor: G.gold, borderWidth: 2.5, borderColor: G.ink, borderBottomWidth: 6, justifyContent: "center" },
  questTrack: { height: 18, borderRadius: 9, backgroundColor: "rgba(0,0,0,0.3)", overflow: "hidden", justifyContent: "center" },
  questFill: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: G.purple },
  gear: { width: 40, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.3)", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.12)" },
  hero: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 150 },
  glow: { position: "absolute", width: 230, height: 230, borderRadius: 115, backgroundColor: "rgba(155,225,93,0.18)" },
  heroArt: { width: 200, height: 200 },
  roadTrack: { height: 30, borderRadius: 15, backgroundColor: "rgba(0,0,0,0.35)", borderWidth: 2.5, borderColor: G.ink, overflow: "hidden", justifyContent: "center", marginHorizontal: 18 },
  roadFill: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: G.orange },
  roadText: { textAlign: "center" },
  picker: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    marginHorizontal: 30,
    height: 44,
    borderRadius: 14,
    backgroundColor: G.purple,
    borderWidth: 2.5,
    borderColor: G.ink,
    borderBottomWidth: 5,
  },
  arrow: { width: 44, height: "100%", alignItems: "center", justifyContent: "center" },
  slots: { flexDirection: "row", justifyContent: "center", gap: 12, marginTop: 12 },
  slot: { width: 54, height: 54, borderRadius: 27, backgroundColor: "rgba(0,0,0,0.3)", borderWidth: 2.5, borderColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },
  slotDone: { backgroundColor: G.lime, borderColor: G.ink },
  play: { marginTop: 14, marginHorizontal: 34 },
  more: { flexDirection: "row", gap: 10, marginTop: 10 },
});
