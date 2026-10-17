import { router, Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, AppState, Image, Modal, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import Animated, { Easing, FadeIn, FadeInDown, FadeOut, SlideInRight, SlideOutRight, useAnimatedStyle, useSharedValue, withRepeat, withTiming, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { XP } from "@/lib/levels";
import { ALL_CRITERIA } from "@/lib/tiki";
import { alive, bench, fieldCap, fielded, namesPlayer, priceOf, sellValue, xpToNext } from "@/lib/taktik/engine";
import { INCOME, planSeconds, REROLL_COST, SCOUT_DISCOUNT, SLOTS, START_HP, streakGold, XP_COST, type Pos } from "@/lib/taktik/rules";
import { sheet } from "@/lib/taktik/sim";
import { effectsOf, STYLES, type EffectKey, type TraitState } from "@/lib/taktik/traits";
import type { Manager, ShopCard } from "@/lib/taktik/types";

import { FocusStatusBar } from "~/components/StadiumHeader";
import { Flag } from "~/components/Flag";
import { CLUB_KITS, ClubShirt } from "~/components/HatTrickBoard";
import { COST_COLOR, ItemIcon, PosTag, clubCriterion, surname } from "~/components/taktik/Card";
import { Jersey } from "~/components/Jersey";
import { CoinFly } from "~/components/taktik/CoinFly";
import { avatarsOf, LobbyIntro } from "~/components/taktik/LobbyIntro";
import { Avatar } from "~/components/Avatar";
import { PlanClock } from "~/components/taktik/PlanClock";
import { TacticsCard, TacticsChips } from "~/components/taktik/TacticsCard";
import { MatchView } from "~/components/taktik/MatchView";
import { Text } from "~/components/Text";
import { TourOverlay, useTour } from "~/components/Tour";
import { Button, Icon, Tap } from "~/components/ui";
import { TAKTIK } from "~/lib/brand";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { expireTaktik, kickOff, leaveRoom, loadTaktik, markTaktikSeen, play, quitTaktik, useTaktik } from "~/lib/taktik";
import { C, F, GAME, R, shadow, T } from "~/lib/theme";
import { useXpAward } from "~/lib/xp";

type Sel = { kind: "unit"; uid: string } | { kind: "item"; index: number } | null;

const COUNTRY = new Map(ALL_CRITERIA.filter((c) => c.kind === "country").map((c) => [c.id, c]));

/**
 * One Taktik Tahtası game: health table, the pitch (12 spots by zone), synergies,
 * items, the bench, the shop and the buttons. Tap a player, then a spot.
 */
/** seed of the game whose intro has played (kept while the app runs) */
let introShown = -1;

export default function TaktikGame() {
  // the engine mutates the lobby in place: no compiler memoization here
  "use no memo";
  const { t, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { lobby, version, online, meId } = useTaktik();
  /** online friends' own avatars, by manager id */
  const known = new Map((online?.seats ?? []).filter((s) => s.avatar).map((s) => [s.id, s.avatar!]));
  const [sel, setSel] = useState<Sel>(null);
  const [note, setNote] = useState<string | null>(null);
  const [match, setMatch] = useState(false);
  const [scout, setScout] = useState<number | null>(null);
  const [guess, setGuess] = useState("");
  const [scoutMsg, setScoutMsg] = useState<string | null>(null);
  const [info, setInfo] = useState<TraitState | null>(null);
  /** the tactics card just tapped: it lights up for a moment before it's taken */
  const [augPick, setAugPick] = useState<number | null>(null);
  /** height left for the board between the top bar and the shop (the pitch fits into it) */
  /** the pitch's measured size (it takes whatever height is left) */
  const [pitchBox, setPitchBox] = useState({ w: 0, h: 0 });
  /** the managers' panel is open */
  const [mgrOpen, setMgrOpen] = useState(false);
  /** every synergy, not just the live and nearly-live ones */
  const [allTraits, setAllTraits] = useState(false);
  /** coins flying into the gold counter after a match: how many are still in the air */
  const [coins, setCoins] = useState<{ id: number; total: number; left: number; amount: number; to: { x: number; y: number } } | null>(null);
  /** gold at kick-off: what the round paid (win, friendly drop, salary, savings, streak) flies in after the match */
  const goldAtKick = useRef<number | null>(null);
  const goldRef = useRef<View | null>(null);
  /** the lobby intro was seen for this game (seed) */
  const [introSeen, setIntroSeen] = useState(() => introShown);
  const scroller = useRef<ScrollView>(null);
  // first game: a walkthrough that lights up each part of the screen in turn
  // the walkthrough can't hold a server's clock: online it only runs from "?"
  const tour = useTour(
    "taktik-v1",
    [
    { target: "shop", title: t("ttkTour1T"), body: t("ttkTour1") },
    { target: "gold", title: t("ttkTour2T"), body: t("ttkTour2").replace("{income}", String(INCOME)) },
    { target: "pitch", title: t("ttkTour3T"), body: t("ttkTour3") },
    { target: "traits", title: t("ttkTour4T"), body: t("ttkTour4") },
    { target: "bench", title: t("ttkTour5T"), body: t("ttkTour5"), before: () => scroller.current?.scrollToEnd({ animated: true }) },
    { target: "reroll", title: t("ttkTour6T"), body: t("ttkTour6").replace("{g}", String(REROLL_COST)) },
    { target: "xp", title: t("ttkTour7T"), body: t("ttkTour7").replace("{g}", String(XP_COST)) },
    { target: "hp", title: t("ttkTour8T"), body: t("ttkTour8"), before: () => scroller.current?.scrollTo({ y: 0, animated: true }) },
    { target: "table", title: t("ttkTour9T"), body: t("ttkTour9") },
    { target: "kick", title: t("ttkTour10T"), body: t("ttkTour10") },
    ],
    !online
  );

  const me: Manager | undefined = lobby?.managers[meId];
  const out = !!me && (me.place !== null || !!lobby?.over || online?.phase === "over");
  // a new round: say where the gold came from (salary, interest, streak), like the reference game's round card
  const roundKey = lobby ? `${lobby.stage}-${lobby.round}` : "";
  const [incomeSeen, setIncomeSeen] = useState("");
  const inc = me?.income;
  const incomeNote =
    inc && !match && incomeSeen !== roundKey
      ? `+${inc.base + inc.interest + inc.streak} 🪙 · ${[
          t("ttkIncomeBase").replace("{g}", String(inc.base)),
          inc.interest ? t("ttkIncomeInterest").replace("{g}", String(inc.interest)) : "",
          inc.streak ? t("ttkIncomeStreak").replace("{g}", String(inc.streak)) : "",
        ]
          .filter(Boolean)
          .join(" · ")}`
      : null;
  useEffect(() => {
    if (!incomeNote) return;
    const id = setTimeout(() => setIncomeSeen(roundKey), 3500);
    return () => clearTimeout(id);
  }, [incomeNote, roundKey]);
  // the seat in the lobby: stamped while the screen is open, and when it goes away or the app goes to the background
  // (back within a minute: same game; later: it's gone, see lib/taktik.ts)
  useEffect(() => {
    // back to the app after more than a minute away: the seat is gone
    const check = () => {
      if (expireTaktik()) router.replace("/taktik");
      else markTaktikSeen();
    };
    loadTaktik().then(check);
    const id = setInterval(markTaktikSeen, 5000);
    const sub = AppState.addEventListener("change", (state) => (state === "active" ? check() : markTaktikSeen()));
    return () => {
      clearInterval(id);
      sub.remove();
      markTaktikSeen();
    };
  }, []);
  const traitLabel = (x: TraitState) => {
    if (x.kind === "club") {
      const c = clubCriterion(x.id);
      return c ? (locale === "tr" ? c.tr : c.en) : x.id;
    }
    if (x.kind === "country") {
      const c = COUNTRY.get(x.id);
      return c ? (locale === "tr" ? c.tr : c.en) : x.id.charAt(0).toUpperCase() + x.id.slice(1);
    }
    return t(`ttkHonour_${x.id as "wc"}`);
  };
  /** one effect as a sentence ("Attack +7%"); accuracy counts at 30 % in the shot (sim.ts) */
  const fxText = (key: EffectKey, value: number) => {
    if (key === "flex" && value >= 1) return t("ttkFx_flexAll");
    const v = Math.round(value * (key === "accuracy" ? 30 : 100));
    return t(`ttkFx_${key}`).replace("{v}", String(v));
  };
  const fxLine = (x: TraitState, tier: number) => effectsOf(x.kind, x.id, tier).map((e) => fxText(e.key, e.value)).join(" · ");
  // a synergy switching on (or going up a step) says what it gives, over the pitch for a moment
  const tiersSeen = useRef<Map<string, number> | null>(null);
  const [fxToast, setFxToast] = useState<{ id: number; text: string } | null>(null);
  useEffect(() => {
    const m = lobby?.managers[meId];
    if (!m) return;
    const traits = sheet({ name: m.name, units: m.units, coach: m.coach, augments: m.augments }).traits;
    const before = tiersSeen.current;
    tiersSeen.current = new Map(traits.map((x) => [`${x.kind}:${x.id}`, x.tier]));
    if (!before || match) return;
    const up = traits.find((x) => x.tier > (before.get(`${x.kind}:${x.id}`) ?? 0));
    if (!up) return;
    haptic.success();
    setFxToast({ id: Date.now(), text: t("ttkFxOn").replace("{name}", traitLabel(up)).replace("{fx}", fxLine(up, up.tier)) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);
  useEffect(() => {
    if (!fxToast) return;
    const id = setTimeout(() => setFxToast(null), 2600);
    return () => clearTimeout(id);
  }, [fxToast]);
  // online: the server kicks off for everyone; the match plays here when a new round's results come in
  const planGold = useRef<number | null>(null);
  const playedSeen = useRef<number | null>(null);
  useEffect(() => {
    if (!online || !lobby) return;
    const m = lobby.managers[online.you];
    if (online.phase === "plan" && m) planGold.current = m.gold;
    // joined (or came back) mid-game: nothing to replay
    if (playedSeen.current === null) {
      playedSeen.current = lobby.played;
      return;
    }
    if (online.phase !== "match" || lobby.played <= playedSeen.current) return;
    playedSeen.current = lobby.played;
    setSel(null);
    setScout(null);
    goldAtKick.current = planGold.current;
    haptic.press();
    setMatch(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);
  // a plain "+XP" toast: the reward screen is a second modal on top of the end card and froze the screen
  useXpAward(out && !match && !!me?.place, `ttk-${lobby?.seed}`, "tt", me?.place ? XP.ttPlace[me.place - 1] : 0, {
    label: me?.place === 1 ? t("ttkWinner") : t("ttkPlace").replace("{n}", String(me?.place ?? "")),
  });

  if (!lobby || !me) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <Stack.Screen options={{ title: t("ttkName") }} />
      </View>
    );
  }

  const augW = Math.min(150, (width - 24 - 20) / 3);
  const showIntro = introSeen !== lobby.seed && lobby.played === 0 && lobby.stage === 1 && lobby.round === 0;
  const pickAugment = (i: number) => {
    haptic.success();
    setAugPick(i);
    setTimeout(() => {
      play({ op: "augment", i });
      setAugPick(null);
    }, 650);
  };

  const flash = (s: string) => {
    setNote(s);
    haptic.warning();
    setTimeout(() => setNote((n) => (n === s ? null : n)), 1800);
  };

  const selectedUnit = sel?.kind === "unit" ? me.units.find((u) => u.uid === sel.uid) : undefined;
  const cap = fieldCap(me);
  const onPitch = fielded(me);
  const sh = sheet({ name: me.name, units: me.units, coach: me.coach, augments: me.augments });
  const traits = sh.traits.filter((x) => x.count >= 1);
  /** completed synergies: their players light up on the pitch */
  const active = sh.traits.filter((x) => x.tier > 0);
  /** in the row: the live synergies, then the three closest to switching on (by share filled); the rest behind "+n" */
  const shownTraits = [
    ...active,
    ...traits
      .filter((x) => x.tier === 0 && x.count >= x.steps[0] - 1)
      .sort((a, b) => b.count / b.steps[0] - a.count / a.steps[0] || b.count - a.count)
      .slice(0, 3),
  ];
  /** a heads-up on the board: spots left empty, or no real back line */
  const emptySpots = cap - onPitch.length;
  const backLine = onPitch.filter((u) => SLOTS[u.slot!] === "DEF").length;
  const boardWarn =
    emptySpots > 0 ? t("ttkEmptySpots").replace("{n}", String(emptySpots)) : onPitch.length >= 4 && (backLine === 0 || sh.def < sh.atk * 0.5) ? t("ttkWeakDefence") : null;


  const tapUnit = (uid: string) => {
    haptic.tap();
    const u = me.units.find((x) => x.uid === uid)!;
    if (sel?.kind === "item") {
      if (!play({ op: "equip", index: sel.index, uid })) flash(t("ttkFieldFull"));
      setSel(null);
      return;
    }
    if (sel?.kind === "unit" && sel.uid !== uid && selectedUnit) {
      // swap / place the selected one where this one stands
      if (u.slot !== null) {
        play({ op: "move", uid: selectedUnit.uid, slot: u.slot });
        setSel(null);
        return;
      }
      if (selectedUnit.slot !== null) {
        play({ op: "move", uid, slot: selectedUnit.slot });
        setSel(null);
        return;
      }
    }
    setSel(sel?.kind === "unit" && sel.uid === uid ? null : { kind: "unit", uid });
  };

  const tapSlot = (slot: number) => {
    if (sel?.kind !== "unit") return;
    if (!play({ op: "move", uid: sel.uid, slot })) flash(t("ttkFieldFull"));
    else haptic.tap();
    setSel(null);
  };

  const tapBench = () => {
    if (sel?.kind !== "unit") return;
    if (!play({ op: "move", uid: sel.uid, slot: null })) flash(t("ttkBenchFull"));
    setSel(null);
  };

  const tapShop = (i: number, card: ShopCard) => {
    if (sel) return setSel(null);
    if (card.scout) {
      setScout(i);
      setGuess("");
      setScoutMsg(null);
      return;
    }
    // (it walks straight onto the pitch while there's room, see lib/taktik/ops.ts)
    const r = play({ op: "buy", i });
    if (r === "gold") flash(t("ttkNoGold"));
    else if (r === "full") flash(t("ttkBenchFull"));
    else if (r) haptic.success();
  };

  const scoutCard = scout !== null ? me.shop[scout] : null;
  const scoutPlayer = scoutCard ? lobby.players[scoutCard.pid] : null;
  const tryScout = () => {
    if (scout === null || !scoutPlayer) return;
    if (!namesPlayer(guess, scoutPlayer.name)) {
      setScoutMsg(t("ttkScoutWrong"));
      haptic.error();
      return;
    }
    const r = play({ op: "buy", i: scout, guess });
    if (r === "ok") {
      haptic.success();
      flash(t("ttkScoutRight").replace("{name}", scoutPlayer.name));
      setScout(null);
    } else setScoutMsg(r === "gold" ? t("ttkNoGold") : t("ttkBenchFull"));
  };
  const buyScoutFull = () => {
    if (scout === null) return;
    const r = play({ op: "buy", i: scout });
    if (r === "ok") setScout(null);
    else setScoutMsg(r === "gold" ? t("ttkNoGold") : t("ttkBenchFull"));
  };

  const traitDesc = (x: TraitState) =>
    x.kind === "club" ? t("ttkClubTrait") : x.kind === "country" ? t(STYLES[x.id] ? (`ttkStyle_${x.id}` as "ttkStyle_brazil") : "ttkStyle_other") : x.id === "legend" ? t("ttkLegendTrait") : "";
  const traitIcon = (x: TraitState) => {
    if (x.kind === "club") {
      const c = clubCriterion(x.id);
      return c ? <ClubShirt c={c} size={13} /> : null;
    }
    if (x.kind === "country") return <Flag id={x.id} width={17} />;
    return <Text style={{ fontSize: 14 }}>{({ wc: "🏆", ucl: "⭐", ballon: "🥇", euro: "🌍", legend: "👑" } as Record<string, string>)[x.id]}</Text>;
  };

  // back from the match: gold it paid flies from the middle of the screen into the counter
  const closeMatch = () => {
    setMatch(false);
    if (goldAtKick.current === null) return;
    const gold = me.gold - goldAtKick.current;
    goldAtKick.current = null;
    if (gold <= 0) return;
    // once the match screen has faded away
    setTimeout(() => goldRef.current?.measureInWindow((x, y, w, h) => setCoins({ id: Date.now(), total: Math.min(gold, 8), left: Math.min(gold, 8), amount: gold, to: { x: x + 11, y: y + h / 2 } })), 450);
  };

  const startMatch = () => {
    setSel(null);
    haptic.press();
    goldAtKick.current = me.gold;
    kickOff();
    setMatch(true);
  };

  // leaving a live lobby: ask first (a minute to come back, then the seat is gone)
  const leave = () => {
    if (out) return router.back();
    Alert.alert(t("ttkLeaveTitle"), t("ttkLeaveBody"), [
      { text: t("ttkLeaveStay"), style: "cancel" },
      {
        text: t("ttkLeaveGo"),
        style: "destructive",
        onPress: () => {
          // online: the server keeps the seat a minute (then a house manager takes it)
          if (online) leaveRoom();
          router.back();
        },
      },
    ]);
  };

  const standings = lobby.managers.slice().sort((a, b) => (a.place ?? 0) - (b.place ?? 0) || b.hp - a.hp);
  const xpNeed = xpToNext(me);

  // the flat pitch fills what's left between the top rows and the bottom panels; spots sit on four lines
  // the pitch picture laid back a little (rotateX) like a TV camera; spots are projected the same way so they sit on it
  const LINE_Y: Record<Pos, number> = { FWD: 0.17, MID: 0.42, DEF: 0.66, GK: 0.88 };
  const LINE_X: Record<number, number[]> = { 1: [0.5], 3: [0.2, 0.5, 0.8], 4: [0.12, 0.37, 0.63, 0.88] };
  const img = { w: pitchBox.w * 1.04, h: pitchBox.h / Math.cos(TILT) };
  const project = (px: number, py: number) => {
    const y = py - pitchBox.h / 2;
    const k = PERSPECTIVE / (PERSPECTIVE - y * Math.sin(TILT));
    return { x: pitchBox.w / 2 + (px - pitchBox.w / 2) * k, y: pitchBox.h / 2 + y * Math.cos(TILT) * k, k };
  };
  const spot = (slot: number) => {
    const zone = SLOTS[slot];
    const inZone = SLOTS.map((z, i) => (z === zone ? i : -1)).filter((i) => i >= 0);
    // into the picture's playing area (pitch-full: touchlines at 5–95 % across, 5.3–93.1 % down)
    const fx = 0.05 + 0.9 * LINE_X[inZone.length][inZone.indexOf(slot)];
    const fy = 0.053 + 0.878 * LINE_Y[zone];
    const p = project((pitchBox.w - img.w) / 2 + fx * img.w, (pitchBox.h - img.h) / 2 + fy * img.h);
    return { x: p.x, y: p.y, sz: shirtW * p.k };
  };
  const shirtW = Math.min(64, pitchBox.w * 0.15, pitchBox.h * 0.13);
  const looks = avatarsOf(lobby.managers, me.id, known);
  const benchW = (width - 24 - 7 * 6) / 8;
  const shopW = (width - 24 - 4 * 8) / 5;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* no swipe back: leaving the lobby goes through the question */}
      <Stack.Screen options={{ headerShown: false, gestureEnabled: out }} />
      <FocusStatusBar style="dark" />
      {/* top: back, the round, the clock, health / gold / streak */}
      <View style={[styles.top, { paddingTop: insets.top + 2 }]}>
        <View style={styles.topRow}>
          <Tap onPress={leave} style={styles.back} accessibilityLabel="‹">
            <Icon name="chevron.left" size={17} color={C.text} fallback="‹" />
          </Tap>
          <Text style={styles.stage} numberOfLines={1}>
            {t("ttkRound").replace("{s}", String(lobby.stage)).replace("{r}", String(lobby.round + 1))}
          </Text>
          <View style={{ flex: 1 }} />
          <View ref={tour.ref("hp")} collapsable={false} style={styles.stat}>
            <Image source={TAKTIK.ui.heart} style={styles.statIcon} />
            <Text style={styles.statText}>{Math.max(0, me.hp)}</Text>
          </View>
          <View
            ref={(v) => {
              tour.ref("gold")(v);
              goldRef.current = v;
            }}
            collapsable={false}
            style={styles.stat}
          >
            <Image source={TAKTIK.ui.coin} style={styles.statIcon} />
            {/* coins still flying in aren't counted yet */}
            <Text style={styles.statText}>{me.gold - (coins ? Math.round((coins.amount * coins.left) / coins.total) : 0)}</Text>
          </View>
          {/* a streak of 2+ pays extra gold each round: show it */}
          {Math.abs(me.streak) >= 2 && (
            <Tap
              onPress={() => flash(t(me.streak > 0 ? "ttkWinStreak" : "ttkLossStreak").replace("{n}", String(Math.abs(me.streak))).replace("{g}", String(streakGold(Math.abs(me.streak)))))}
              style={styles.stat}
              accessibilityLabel={t(me.streak > 0 ? "ttkWinStreak" : "ttkLossStreak").replace("{n}", String(Math.abs(me.streak))).replace("{g}", String(streakGold(Math.abs(me.streak))))}
            >
              {me.streak > 0 ? <Image source={TAKTIK.ui.flame} style={styles.statIcon} /> : <Icon name="snowflake" size={18} color={C.blue} fallback="🧊" />}
              <Text style={styles.statText}>{Math.abs(me.streak)}</Text>
            </Tap>
          )}
          {/* the other managers: a panel from the right */}
          <View ref={tour.ref("table")} collapsable={false}>
            <Tap onPress={() => setMgrOpen(true)} style={styles.mgrBtn} accessibilityLabel={t("ttkManagers")}>
              <Icon name="person.3.fill" size={15} color={C.text} fallback="👥" />
              <Text style={styles.mgrBtnText}>{alive(lobby).length}</Text>
            </Tap>
          </View>
          <Tap onPress={tour.start} style={styles.help} accessibilityLabel={t("ttkHowTo")}>
            <Icon name="questionmark" size={15} color={C.text} fallback="?" />
          </Tap>
        </View>
        {/* the set-up clock, big: at zero everyone kicks off at once; nothing pauses it but the first-time walkthrough */}
        <View ref={tour.ref("kick")} collapsable={false} style={{ marginTop: 4 }}>
          {online ? (
            // online the server keeps the time and kicks off for everyone (the clock here only shows it)
            <PlanClock
              key={`clock-${lobby.seed}-${roundKey}-${online.phase}`}
              wide
              seconds={planSeconds(lobby.stage)}
              endsAt={online.planEnds}
              running={online.phase === "plan"}
              onEnd={() => setSel(null)}
            />
          ) : (
            <PlanClock key={`clock-${lobby.seed}-${roundKey}`} wide seconds={planSeconds(lobby.stage)} running={!match && !out && !showIntro && tour.step === null} onEnd={startMatch} />
          )}
        </View>
      </View>

      {/* the tactics cards in play and the synergies: what your side is getting right now */}
      <View ref={tour.ref("traits")} collapsable={false}>
        <View style={styles.traits}>
          {me.augments.length > 0 && <TacticsChips ids={me.augments} />}
          {(allTraits ? traits : shownTraits).map((x) => (
            <Tap key={`${x.kind}-${x.id}`} onPress={() => setInfo(x)} style={[styles.trait, x.tier > 0 && styles.traitOn]} accessibilityLabel={traitLabel(x)}>
              {traitIcon(x)}
              <Text style={[styles.traitText, x.tier > 0 && { color: "white" }]}>
                {x.count}/{x.steps[Math.min(x.tier, x.steps.length - 1)]}
              </Text>
            </Tap>
          ))}
          {me.items.map((it, i) => (
            <Tap key={`i${i}`} onPress={() => setSel(sel?.kind === "item" && sel.index === i ? null : { kind: "item", index: i })} style={[styles.item, sel?.kind === "item" && sel.index === i && styles.itemOn]} accessibilityLabel={t(`ttkI_${it}`)}>
              <ItemIcon id={it} size={18} />
            </Tap>
          ))}
          {/* the rest (more than one player short) behind a tap */}
          {(() => {
            const hidden = traits.length - shownTraits.length;
            if (!hidden && !allTraits) return null;
            return (
              <Tap onPress={() => setAllTraits((v) => !v)} style={[styles.trait, { borderStyle: "dashed" }]} accessibilityLabel={t(allTraits ? "ttkTraitsLess" : "ttkTraitsMore")}>
                <Text style={[styles.traitText, { color: C.text2 }]}>{allTraits ? t("ttkTraitsLess") : `+${hidden}`}</Text>
              </Tap>
            );
          })()}
          {traits.length === 0 && me.augments.length === 0 && me.items.length === 0 && <Text style={styles.hint}>{t("ttkNoTraits")}</Text>}
        </View>
        {sel?.kind === "item" && <Text style={[styles.hint, { marginBottom: 4 }]}>{t(`ttkId_${me.items[sel.index]}`)}</Text>}
      </View>

      {/* the pitch: big and flat, the spots on four lines, every player his shirt and his name */}
      <View ref={tour.ref("pitch")} collapsable={false} style={{ flex: 1 }} onLayout={(e) => setPitchBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        <Pressable onPress={() => setSel(null)} style={StyleSheet.absoluteFill}>
          {pitchBox.h > 0 && (
            <View style={[StyleSheet.absoluteFill, { overflow: "hidden" }]} pointerEvents="none">
              <View style={{ position: "absolute", left: (pitchBox.w - img.w) / 2, top: (pitchBox.h - img.h) / 2, width: img.w, height: img.h, transform: [{ perspective: PERSPECTIVE }, { rotateX: `${(TILT * 180) / Math.PI}deg` }] }}>
                {/* explicit size: absoluteFill on an Image misrenders in RN */}
                <Image source={TAKTIK.pitch.full} style={{ width: img.w, height: img.h }} resizeMode="stretch" />
              </View>
            </View>
          )}
          {pitchBox.h > 0 &&
            SLOTS.map((zone, slot) => {
              const p = spot(slot);
              const u = me.units.find((x) => x.slot === slot);
              const picked = !!u && sel?.kind === "unit" && sel.uid === u.uid;
              if (!u)
                return (
                  <Tap
                    key={slot}
                    onPress={() => tapSlot(slot)}
                    style={[styles.plus, { left: p.x - p.sz * 0.62, top: p.y - p.sz * 0.55, width: p.sz * 1.24, height: p.sz * 1.1 }, sel?.kind === "unit" && styles.plusLit]}
                    accessibilityLabel={t(`ttkPos_${zone}`)}
                  >
                    <Text style={styles.plusText}>+</Text>
                  </Tap>
                );
              return (
                <Tap key={slot} onPress={() => tapUnit(u.uid)} style={[styles.onPitch, { left: p.x - p.sz, top: p.y - p.sz * 0.8, width: p.sz * 2 }, picked && { transform: [{ translateY: -4 }] }]} accessibilityLabel={u.name}>
                  {/* the completed synergies he's part of, lit up over his shirt */}
                  {(() => {
                    const lit = active.filter((x) => (x.kind === "club" ? u.club === x.id : x.kind === "country" ? u.country === x.id : u.badges.includes(x.id)));
                    if (!lit.length) return null;
                    return (
                      <View style={[styles.lit, { top: -15 }]} pointerEvents="none">
                        {lit.slice(0, 3).map((x) => (
                          <View key={`${x.kind}-${x.id}`} style={styles.litChip}>
                            {traitIcon(x)}
                          </View>
                        ))}
                      </View>
                    );
                  })()}
                  {active.some((x) => (x.kind === "club" ? u.club === x.id : x.kind === "country" ? u.country === x.id : u.badges.includes(x.id))) && (
                    <View style={[styles.glow, { width: p.sz * 1.15, height: p.sz * 1.15, borderRadius: p.sz * 0.6, top: p.sz * -0.05 }]} pointerEvents="none" />
                  )}
                  <Shirt club={u.club} size={p.sz} number={NUMBER[slot]} />
                  <View style={[styles.tag, picked && styles.tagPicked, { borderBottomColor: COST_COLOR[u.cost] }]}>
                    <Text style={styles.tagName} numberOfLines={1}>
                      {surname(u.name)}
                    </Text>
                    <View style={styles.tagLine}>
                      <Flag id={u.country} width={13} />
                      <Text style={styles.tagPos}>
                        {"★".repeat(u.star)} {t(`ttkPos_${u.pos}`)}
                      </Text>
                    </View>
                  </View>
                  {u.items.length > 0 && (
                    <View style={styles.tagItems}>
                      {u.items.map((it, k) => (
                        <ItemIcon key={k} id={it} size={14} />
                      ))}
                    </View>
                  )}
                </Tap>
              );
            })}
          {fxToast ? (
            <Animated.View key={fxToast.id} entering={FadeIn} exiting={FadeOut} style={styles.fxToast} pointerEvents="none">
              <Icon name="sparkles" size={14} color="white" fallback="✨" />
              <Text style={styles.fxToastText} numberOfLines={2}>
                {fxToast.text}
              </Text>
            </Animated.View>
          ) : boardWarn && (
            <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.warn} pointerEvents="none">
              <Icon name="exclamationmark.triangle.fill" size={13} color={C.amber} fallback="⚠️" />
              <Text style={styles.warnText}>{boardWarn}</Text>
            </Animated.View>
          )}
          {/* the near edge: how many are on it, and one tap for the best side */}
          <View style={styles.pills} pointerEvents="box-none">
            <View style={styles.pill}>
              <Text style={styles.pillText}>{t("ttkOnPitch").replace("{n}", String(onPitch.length)).replace("{m}", String(cap))}</Text>
            </View>
            <Button
              small
              kind="secondary"
              title={t("ttkBestLineup")}
              left={<Image source={TAKTIK.ui.wand} style={{ width: 16, height: 17 }} />}
              onPress={() => {
                play({ op: "arrange" });
                setSel(null);
                haptic.success();
              }}
            />
          </View>
        </Pressable>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 4 }]}>
        {/* subs: all eight in one row; the club level and Buy XP in its header */}
        <View ref={tour.ref("bench")} collapsable={false} style={{ paddingHorizontal: 12 }}>
          <View style={styles.headRow}>
            <Text style={styles.head}>{t("ttkSubs")}</Text>
            <Text style={styles.headSub}>{bench(me).length}/8</Text>
            <View style={{ flex: 1 }} />
            <Text style={styles.level}>{t("ttkLevel").replace("{n}", String(me.level))}</Text>
            <View style={styles.levelTrack}>
              <View style={[styles.levelFill, { width: `${xpNeed ? (me.xp / xpNeed) * 100 : 100}%` }]} />
            </View>
            <Text style={styles.headSub}>{xpNeed ? `${me.xp}/${xpNeed}` : "MAX"}</Text>
            <View ref={tour.ref("xp")} collapsable={false}>
              <Button
                small
                kind="secondary"
                title={`XP · ${XP_COST}`}
                right={<Image source={TAKTIK.ui.coin} style={{ width: 16, height: 16 }} />}
                onPress={() => (play({ op: "xp" }) ? haptic.tap() : flash(t("ttkNoGold")))}
                style={{ paddingHorizontal: 10 }}
              />
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {Array.from({ length: 8 }, (_, i) => {
              const u = bench(me)[i];
              if (!u)
                return (
                  <Pressable key={`e${i}`} onPress={tapBench} style={[styles.subEmpty, { width: benchW, height: benchW * 1.4 }, sel?.kind === "unit" && styles.plusLit]}>
                    <Text style={[styles.plusText, { color: C.text3 }]}>+</Text>
                  </Pressable>
                );
              const picked = sel?.kind === "unit" && sel.uid === u.uid;
              return (
                <Tap key={u.uid} onPress={() => tapUnit(u.uid)} style={[styles.sub, { width: benchW, height: benchW * 1.4, borderBottomColor: COST_COLOR[u.cost] }, picked && styles.subPicked]} accessibilityLabel={u.name}>
                  <Shirt club={u.club} size={benchW * 0.68} />
                  <Text style={styles.subName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                    {surname(u.name)}
                  </Text>
                  <View style={styles.tagLine}>
                    <Flag id={u.country} width={11} />
                    <Text style={styles.subPos}>{t(`ttkPos_${u.pos}`)}</Text>
                  </View>
                </Tap>
              );
            })}
          </View>
        </View>

        <View style={styles.rule} />

        {/* the transfer market: price on top, a big shirt, the name and position */}
        <View ref={tour.ref("shop")} collapsable={false} style={{ paddingHorizontal: 12, gap: 8 }}>
          <View style={styles.headRow}>
            <Text style={styles.head} numberOfLines={1}>
              {t("ttkMarket")}
            </Text>
            <View style={{ flex: 1 }} />
            {note ?? incomeNote ? (
              <Animated.Text entering={FadeIn} style={styles.note} numberOfLines={1}>
                {note ?? incomeNote}
              </Animated.Text>
            ) : null}
            <View ref={tour.ref("reroll")} collapsable={false}>
              <Button
                small
                kind="secondary"
                title={`${t("ttkReroll")} · ${REROLL_COST}`}
                left={<Image source={TAKTIK.ui.reroll} style={{ width: 18, height: 17 }} />}
                right={<Image source={TAKTIK.ui.coin} style={{ width: 16, height: 16 }} />}
                onPress={() => (play({ op: "reroll" }) ? haptic.tap() : flash(t("ttkNoGold")))}
              />
            </View>
          </View>
          <View style={styles.shop}>
            {me.shop.map((card, i) => {
              if (!card) return <View key={i} style={[styles.shopCard, styles.shopGone, { width: shopW }]} />;
              const p = lobby.players[card.pid];
              const owned = me.units.filter((u) => u.pid === p.pid && u.star === 1).length;
              /** a third copy makes him two-star */
              const starUp = !card.scout && owned === 2;
              return (
                <Tap
                  key={i}
                  onPress={() => tapShop(i, card)}
                  style={[styles.shopCard, { width: shopW, borderBottomColor: card.scout ? "#A78BFA" : COST_COLOR[p.cost] }, card.scout && styles.scoutCard, me.gold < p.cost && { opacity: 0.45 }]}
                  accessibilityLabel={card.scout ? t("ttkScoutTitle") : `${p.name}, ${p.cost}`}
                >
                  <View style={styles.shopPrice}>
                    <Image source={TAKTIK.ui.coin} style={{ width: 16, height: 16 }} />
                    <Text style={styles.shopPriceText}>{p.cost}</Text>
                  </View>
                  {card.scout ? <Image source={TAKTIK.ui.scout} style={{ width: shopW * 0.6, height: shopW * 0.68 }} resizeMode="contain" /> : <Shirt club={p.club} size={shopW * 0.7} />}
                  <Text style={[styles.shopName, card.scout && { color: GAME.qz.ink }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                    {card.scout ? t("ttkScoutShort") : surname(p.name)}
                  </Text>
                  {card.scout ? (
                    <Text style={styles.shopPos}> </Text>
                  ) : starUp ? (
                    <Text style={styles.starUpText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                      {t("ttkStarUp")}
                    </Text>
                  ) : (
                    <View style={styles.tagLine}>
                      <Flag id={p.country} width={14} />
                      <Text style={styles.shopPos}>{t(`ttkPos_${p.pos}`)}</Text>
                    </View>
                  )}
                  {starUp && <StarUpGlow />}
                  {owned > 0 && (
                    <View style={styles.owned}>
                      <Text style={styles.ownedText}>{owned}/3</Text>
                    </View>
                  )}
                </Tap>
              );
            })}
          </View>
        </View>

        {/* a picked player can be sold here */}
        {selectedUnit && (
          <Button
            kind="danger"
            title={t("ttkSell").replace("{g}", String(sellValue(selectedUnit)))}
            left={<Image source={TAKTIK.ui.coin} style={{ width: 22, height: 22 }} />}
            onPress={() => {
              play({ op: "sell", uid: selectedUnit.uid });
              haptic.success();
              setSel(null);
            }}
            style={{ marginHorizontal: 12 }}
          />
        )}
      </View>

      <Modal visible={!!info} transparent animationType="fade" onRequestClose={() => setInfo(null)}>
        <Pressable style={styles.backdrop} onPress={() => setInfo(null)}>
          {info && (
            <Animated.View entering={ZoomIn.duration(180)} style={styles.infoCard}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {traitIcon(info)}
                <Text style={T.headline}>{traitLabel(info)}</Text>
              </View>
              {traitDesc(info) ? <Text style={T.body}>{traitDesc(info)}</Text> : null}
              {/* every step and exactly what it gives; the steps reached are lit */}
              <View style={{ gap: 6, marginTop: 2 }}>
                {info.steps.map((n, i) => {
                  const on = i < info.tier;
                  return (
                    <View key={n} style={[styles.fxRow, on && styles.fxRowOn]}>
                      <Text style={[styles.fxStep, on && { color: C.greenDark }]}>
                        {on ? "✓ " : ""}
                        {t("ttkFxStep").replace("{n}", String(n))}
                      </Text>
                      <Text style={[styles.fxText, on && { color: C.greenDark }]}>{fxLine(info, i + 1)}</Text>
                    </View>
                  );
                })}
              </View>
            </Animated.View>
          )}
        </Pressable>
      </Modal>

      {/* scout report */}
      <Modal visible={scout !== null} transparent animationType="slide" onRequestClose={() => setScout(null)}>
        <Pressable style={styles.backdrop} onPress={() => setScout(null)} />
        {scoutPlayer && (
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={{ alignItems: "center", gap: 6 }}>
              <Image source={TAKTIK.scout} style={{ width: 90, height: 90 }} />
              <Text style={T.title}>{t("ttkScoutTitle")}</Text>
              <Text style={[T.body, { textAlign: "center" }]}>{t("ttkScoutHint").replace("{n}", String(SCOUT_DISCOUNT))}</Text>
              <View style={styles.cluesBig}>
                <Flag id={scoutPlayer.country} width={36} />
                {clubCriterion(scoutPlayer.club) && <ClubShirt c={clubCriterion(scoutPlayer.club)!} size={26} />}
                <PosTag pos={scoutPlayer.pos} />
                <View style={[styles.price, { backgroundColor: COST_COLOR[scoutPlayer.cost] }]}>
                  <Image source={TAKTIK.ui.coin} style={{ width: 16, height: 16 }} />
                  <Text style={styles.priceText}>{scoutPlayer.cost}</Text>
                </View>
              </View>
            </View>
            <TextInput
              value={guess}
              onChangeText={(v) => {
                setGuess(v);
                setScoutMsg(null);
              }}
              onSubmitEditing={tryScout}
              placeholder={t("ttkScoutGuess")}
              placeholderTextColor={C.text3}
              autoCorrect={false}
              autoFocus
              style={styles.input}
            />
            {scoutMsg && <Text style={[T.caption, { color: C.red, fontWeight: "700", textAlign: "center" }]}>{scoutMsg}</Text>}
            <Button title={`${t("ttkScoutTry")} · ${priceOf(lobby, scoutPlayer.pid, true)}`} kind="gold" onPress={tryScout} />
            <Button title={t("ttkScoutFull").replace("{g}", String(scoutPlayer.cost))} kind="secondary" onPress={buyScoutFull} />
          </View>
        )}
      </Modal>

      {/* tactics card offer: three tall cards, a swap under each, the pick lights up and is taken */}
      <Modal visible={!!me.offer && !match && !out} transparent animationType="fade">
        <View style={styles.augScreen}>
          <View style={styles.augHead}>
            <View style={styles.augLine} />
            <Text style={styles.augTitle}>{t("ttkAugTitle")}</Text>
            <View style={styles.augLine} />
          </View>
          <Text style={styles.augHint}>{t("ttkAugHint").replace("{n}", String(me.offerRerolls ?? 0))}</Text>
          <View style={styles.augRow}>
            {me.offer?.map((a, i) => (
              <Animated.View key={`${a}-${i}`} entering={FadeInDown.delay(i * 90).duration(260)} style={{ alignItems: "center", gap: 12 }}>
                <TacticsCard
                  id={a}
                  width={augW}
                  state={augPick === null ? "idle" : augPick === i ? "picked" : "faded"}
                  onPress={augPick === null ? () => pickAugment(i) : undefined}
                />
                <Button
                  small
                  kind="secondary"
                  icon="arrow.triangle.2.circlepath"
                  title={t("ttkAugSwap")}
                  disabled={augPick !== null || !me.offerRerolls}
                  onPress={() => (play({ op: "augSwap", i }) ? haptic.tap() : flash(t("ttkAugNoSwaps")))}
                />
              </Animated.View>
            ))}
          </View>
        </View>
      </Modal>

      {/* the managers' panel, from the right: place, avatar, name, health */}
      {mgrOpen && (
        <View style={StyleSheet.absoluteFill}>
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(180)} style={[StyleSheet.absoluteFill, styles.drawerShade]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setMgrOpen(false)} accessibilityLabel={t("close")} />
          </Animated.View>
          <Animated.View entering={SlideInRight.duration(240)} exiting={SlideOutRight.duration(200)} style={[styles.drawer, { paddingTop: insets.top + 12 }]}>
            <Text style={styles.drawerTitle}>{t("ttkManagers")}</Text>
            {standings.map((m, i) => (
              <View key={m.id} style={[styles.drawerRow, m.place !== null && { opacity: 0.4 }]}>
                <Text style={[styles.drawerHp, { minWidth: 16, textAlign: "left" }]}>{m.place ?? i + 1}</Text>
                <Avatar id={m.id === me.id ? null : (looks.get(m.id) ?? null)} me={m.id === me.id} size={34} ring={m.id === me.id ? C.green : "white"} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[styles.drawerName, m.id === me.id && { color: C.greenMid }]} numberOfLines={1}>
                    {m.id === me.id ? t("you") : m.name}
                  </Text>
                  {/* an online friend whose phone dropped out (a minute to come back) */}
                  {online?.seats.some((x) => x.id === m.id && x.away && !x.gone) && <Text style={[T.caption, { color: C.amber }]}>{t("ttkAway")}</Text>}
                  <View style={[styles.mgrBar, { width: "100%" }]}>
                    <View style={[styles.mgrFill, { width: `${Math.max(0, m.hp)}%`, backgroundColor: m.hp > 50 ? C.green : m.hp > 25 ? C.amber : C.red }]} />
                  </View>
                </View>
                <Text style={styles.drawerHp}>{Math.max(0, m.hp)}</Text>
              </View>
            ))}
          </Animated.View>
        </View>
      )}

      {match && <MatchView lobby={lobby} meId={me.id} onClose={closeMatch} />}
      {/* gold won in the match flies into the counter */}
      {coins && <CoinFly key={coins.id} count={coins.total} to={coins.to} onLand={() => setCoins((c) => (c && c.left > 1 ? { ...c, left: c.left - 1 } : null))} />}

      {/* out of the game */}
      {out && !match && (
        <View style={[StyleSheet.absoluteFill, styles.backdrop, { justifyContent: "center", padding: 24 }]}>
          <Animated.View entering={ZoomIn.duration(260)} style={styles.offer}>
            <Image source={TAKTIK.hero} style={{ width: 120, height: 120, alignSelf: "center" }} />
            <Text style={[T.title, { textAlign: "center" }]}>{me.place === 1 ? t("ttkWinner") : t("ttkOver")}</Text>
            <Text style={[T.headline, { textAlign: "center" }]}>{t("ttkPlace").replace("{n}", String(me.place ?? alive(lobby).length))}</Text>
            {me.place === 1 && me.hp >= START_HP && <Text style={[T.caption, { textAlign: "center", color: C.greenMid, fontWeight: "800" }]}>{t("ttkFlawless")}</Text>}
            {/* everyone's final place, squad and best synergies */}
            <ScrollView style={{ maxHeight: 300 }} contentContainerStyle={{ gap: 6 }}>
              {standings.map((m, i) => {
                const top = sheet({ name: m.name, units: m.units, coach: m.coach, augments: m.augments })
                  .traits.filter((x) => x.tier > 0)
                  .sort((a, b) => b.tier - a.tier || b.count - a.count)
                  .slice(0, 3);
                return (
                  <View key={m.id} style={[styles.finalRow, m.id === me.id && styles.finalMe]}>
                    {/* still playing: their place is where they stand now (by health) */}
                    <Text style={styles.finalPlace}>{m.place ?? i + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={T.headline} numberOfLines={1}>
                        {m.id === me.id ? t("you") : m.name}
                      </Text>
                      <Text style={T.caption} numberOfLines={1}>
                        {t("ttkOnPitchN").replace("{n}", String(fielded(m).length))}
                      </Text>
                    </View>
                    <View style={styles.finalTraits}>
                      {top.map((x) => (
                        <View key={`${x.kind}-${x.id}`} style={styles.finalTrait}>
                          {traitIcon(x)}
                          <Text style={styles.finalTraitText}>{x.count}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
            <Button
              title={t("ttkNewGame")}
              onPress={() => {
                quitTaktik();
                if (router.canGoBack()) router.back();
                else router.replace("/taktik");
              }}
            />
          </Animated.View>
        </View>
      )}

      {/* a new game opens on the eight managers' cards (first round only, once per game) */}
      {showIntro ? (
        <LobbyIntro
          managers={lobby.managers}
          meId={me.id}
          known={known}
          onDone={() => {
            introShown = lobby.seed;
            setIntroSeen(lobby.seed);
          }}
        />
      ) : (
        !out && !match && <TourOverlay tour={tour} />
      )}
    </View>
  );
}

/** the set-up pitch's camera: tilted back this much, seen from this far */
const TILT = (24 * Math.PI) / 180;
const PERSPECTIVE = 900;

/** shirt numbers by spot: keeper 1, back four 2–5, midfield 6, 8, 10, 7, front three 9, 11, 7 */
const NUMBER = [1, 2, 5, 4, 3, 6, 8, 10, 7, 9, 11, 7];

/** a player's shirt: his main club's kit (plain grey without a club) */
function Shirt({ club, size, number }: { club: string | null; size: number; number?: number }) {
  const c = clubCriterion(club);
  const kit = (c && (CLUB_KITS[c.id] ?? (c.c1 ? { body: c.c1, sleeves: c.c1 } : null))) ?? { body: "#CBD5D0", sleeves: "#CBD5D0" };
  return <Jersey body={kit.body} sleeves={kit.sleeves} pattern={kit.pattern} numberColor={kit.body === "#FFFFFF" || kit.body.toUpperCase() === "#FACC15" ? "#111" : "#fff"} number={number ?? 0} hideNumber={number === undefined} size={size} variant="crew" />;
}

const styles = StyleSheet.create({
  top: { backgroundColor: C.bg, paddingHorizontal: 10, paddingBottom: 4 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  back: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.card, alignItems: "center", justifyContent: "center", ...shadow },
  help: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.card, alignItems: "center", justifyContent: "center", ...shadow },
  stage: { fontFamily: F.display, fontSize: 22, color: C.text },
  vline: { width: 1, height: 26, backgroundColor: C.border },
  stat: { flexDirection: "row", alignItems: "center", gap: 3 },
  statIcon: { width: 22, height: 22, resizeMode: "contain" },
  statText: { fontFamily: F.black, fontSize: 21, color: C.text },
  table: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 12, paddingBottom: 4 },
  mgr: { alignItems: "center", gap: 3 },
  mgrBar: { width: 26, height: 3, borderRadius: 2, backgroundColor: C.key, overflow: "hidden" },
  mgrFill: { height: 3, borderRadius: 2 },
  traits: { flexDirection: "row", flexWrap: "wrap", gap: 5, paddingHorizontal: 12, paddingVertical: 6, alignItems: "center" },
  trait: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 28, backgroundColor: C.card, borderRadius: R.chip, paddingHorizontal: 9, borderWidth: 1, borderColor: C.border },
  traitOn: { backgroundColor: C.green, borderColor: C.green },
  traitText: { fontFamily: F.display, fontSize: 14, color: C.text },
  item: { width: 34, height: 28, borderRadius: R.chip, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  itemOn: { backgroundColor: C.amberSoft, borderColor: C.amber },
  hint: { color: C.text3, fontSize: 12, textAlign: "center" },
  plus: { position: "absolute", borderRadius: 10, borderWidth: 1.5, borderStyle: "dashed", borderColor: "rgba(255,255,255,0.75)", backgroundColor: "rgba(0,0,0,0.06)", alignItems: "center", justifyContent: "center" },
  plusLit: { borderColor: C.amber, backgroundColor: "rgba(245,158,11,0.2)" },
  plusText: { fontSize: 24, fontWeight: "300", color: "rgba(255,255,255,0.9)" },
  onPitch: { position: "absolute", alignItems: "center" },
  tag: { marginTop: -4, minWidth: "70%", maxWidth: "100%", backgroundColor: C.card, borderRadius: 6, paddingHorizontal: 6, paddingTop: 2, paddingBottom: 1, alignItems: "center", borderBottomWidth: 3 },
  tagPicked: { backgroundColor: C.amberSoft },
  tagName: { fontFamily: F.display, fontSize: 14, lineHeight: 16, color: C.text },
  tagPos: { fontSize: 9, fontWeight: "800", color: C.text3, letterSpacing: 0.5 },
  tagLine: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3 },
  lit: { position: "absolute", flexDirection: "row", gap: 2, alignSelf: "center", zIndex: 3 },
  litChip: { backgroundColor: "white", borderRadius: 999, paddingHorizontal: 3, paddingVertical: 1, borderWidth: 1.5, borderColor: "#22C55E", shadowColor: "#22C55E", shadowOpacity: 0.9, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } },
  glow: { position: "absolute", alignSelf: "center", backgroundColor: "rgba(250,250,140,0.35)", shadowColor: "#FDE047", shadowOpacity: 0.9, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  tagItems: { position: "absolute", top: 0, right: 4, gap: 1 },
  pills: { position: "absolute", left: 8, right: 8, bottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.92)", borderRadius: R.chip, paddingHorizontal: 12, minHeight: 32 },
  pillText: { fontFamily: F.display, fontSize: 15, color: C.text },
  footer: { backgroundColor: C.bg, paddingTop: 10, gap: 8 },
  mgrBtn: { flexDirection: "row", alignItems: "center", gap: 5, height: 36, backgroundColor: C.card, borderRadius: R.chip, paddingHorizontal: 12, ...shadow },
  mgrBtnText: { fontFamily: F.display, fontSize: 17, color: C.text },
  drawerShade: { backgroundColor: "rgba(0,0,0,0.3)" },
  drawer: { position: "absolute", right: 0, top: 0, bottom: 0, width: 250, backgroundColor: C.card, borderTopLeftRadius: R.card, borderBottomLeftRadius: R.card, paddingHorizontal: 16, gap: 4, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 16 },
  drawerTitle: { ...T.heading, marginBottom: 6 },
  drawerRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.divider },
  drawerName: { fontFamily: F.display, fontSize: 17, color: C.text },
  drawerHp: { fontFamily: F.display, fontSize: 16, color: C.text2, minWidth: 30, textAlign: "right" },
  headRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  head: T.heading,
  level: { fontFamily: F.display, fontSize: 18, color: C.text },
  headSub: { fontSize: 13, fontWeight: "600", color: C.text2 },
  sub: { alignItems: "center", justifyContent: "center", backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, borderBottomWidth: 3 },
  subPicked: { backgroundColor: C.amberSoft, borderColor: C.amber },
  subEmpty: { alignItems: "center", justifyContent: "center", borderRadius: 10, borderWidth: 1.5, borderStyle: "dashed", borderColor: C.border },
  subName: { fontFamily: F.display, fontSize: 13, color: C.text, paddingHorizontal: 2 },
  subPos: { fontSize: 9, fontWeight: "800", color: C.text3 },
  levelLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  levelTrack: { width: 54, height: 6, borderRadius: 3, backgroundColor: C.key, overflow: "hidden" },
  levelFill: { height: 6, borderRadius: 3, backgroundColor: C.green },
  rule: { height: 1, backgroundColor: C.border, marginHorizontal: 12 },
  note: { position: "absolute", left: 0, right: 0, top: -16, textAlign: "center", color: C.greenMid, fontWeight: "800", fontSize: 12 },
  shop: { flexDirection: "row", gap: 8 },
  shopCard: { alignItems: "center", backgroundColor: C.card, borderRadius: R.inner, borderWidth: 1, borderColor: C.border, borderBottomWidth: 4, paddingTop: 6, paddingBottom: 7, overflow: "hidden" },
  shopGone: { backgroundColor: "transparent", borderWidth: 1.5, borderBottomWidth: 1.5, borderStyle: "dashed", borderColor: C.border },
  scoutCard: { backgroundColor: GAME.qz.bg },
  shopPrice: { flexDirection: "row", alignItems: "center", gap: 3 },
  shopPriceText: { fontFamily: F.black, fontSize: 18, color: C.text },
  shopName: { fontFamily: F.display, fontSize: 16, color: C.text, marginTop: 2, paddingHorizontal: 3 },
  shopPos: { fontSize: 10, fontWeight: "800", color: C.text3, letterSpacing: 0.5 },
  starUpText: { fontSize: 10, fontWeight: "900", color: GAME.my.ink, paddingHorizontal: 3 },
  starUpGlow: { position: "absolute", left: -1, right: -1, top: -1, bottom: -4, borderRadius: R.inner, borderWidth: 2.5, borderColor: C.amber, backgroundColor: "rgba(245,158,11,0.1)" },
  warn: { position: "absolute", top: 8, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.amberSoft, borderRadius: R.chip, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: C.amber },
  warnText: { fontWeight: "800", fontSize: 13, color: GAME.my.ink },
  owned: { position: "absolute", top: 30, right: 4, backgroundColor: C.text, borderRadius: R.chip, paddingHorizontal: 5 },
  ownedText: { fontSize: 9, fontWeight: "900", color: "white" },
  cluesBig: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  price: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: R.chip, paddingLeft: 4, paddingRight: 10, paddingVertical: 3 },
  priceText: { fontFamily: F.display, fontSize: 17, color: "white" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  fxRow: { borderRadius: R.inner, backgroundColor: C.bg, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  fxRowOn: { backgroundColor: C.greenSoft },
  fxStep: { fontFamily: F.display, fontSize: 16, color: C.text2 },
  fxText: { fontSize: 14, fontWeight: "600", color: C.text },
  fxToast: { position: "absolute", top: 8, alignSelf: "center", maxWidth: "92%", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.green, borderRadius: R.chip, paddingHorizontal: 14, paddingVertical: 7, ...shadow },
  fxToastText: { fontWeight: "800", fontSize: 13, color: "white", flexShrink: 1 },
  infoCard: { margin: 24, marginTop: "60%", backgroundColor: C.card, borderRadius: R.card, padding: 18, gap: 8, ...shadow },
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 16, gap: 10 },
  input: { backgroundColor: C.card, borderRadius: R.button, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, height: 50, fontSize: 18, color: C.text },
  offer: { backgroundColor: C.bg, borderRadius: R.card, padding: 18, gap: 10 },
  finalRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.card, borderRadius: R.inner, paddingHorizontal: 12, paddingVertical: 8 },
  finalMe: { borderWidth: 2, borderColor: C.green },
  finalPlace: { width: 22, fontFamily: F.display, fontSize: 20, color: C.text2, textAlign: "center" },
  finalTraits: { flexDirection: "row", gap: 4 },
  finalTrait: { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: C.greenSoft, borderRadius: R.chip, paddingHorizontal: 6, paddingVertical: 3 },
  finalTraitText: { fontFamily: F.display, fontSize: 13, color: C.greenDark },
  augScreen: { flex: 1, backgroundColor: "rgba(3,15,9,0.86)", justifyContent: "center", paddingHorizontal: 12 },
  augHead: { flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "center" },
  augLine: { flex: 1, height: 1, backgroundColor: "rgba(253,230,138,0.5)" },
  augTitle: { fontFamily: F.display, fontSize: 28, color: "#FDE68A" },
  augHint: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "600", textAlign: "center", marginTop: 4 },
  augRow: { flexDirection: "row", justifyContent: "center", gap: 10, marginTop: 22 },
});

/** a market card that would make a two-star player: a soft gold pulse */
function StarUpGlow() {
  const o = useSharedValue(0.45);
  useEffect(() => {
    o.set(withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [o]);
  const style = useAnimatedStyle(() => ({ opacity: o.get() }));
  return <Animated.View style={[styles.starUpGlow, style]} pointerEvents="none" />;
}
