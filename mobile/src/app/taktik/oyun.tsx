import { router, Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut, SlideInRight, SlideOutRight, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { XP } from "@/lib/levels";
import { ALL_CRITERIA } from "@/lib/tiki";
import { alive, autoArrange, bench, buy, buyXp, chooseAugment, fillField, rerollAugment, equip, fieldCap, fielded, move, namesPlayer, priceOf, reroll, sell, sellValue, xpToNext } from "@/lib/taktik/engine";
import { INCOME, INTEREST_STEP, planSeconds, REROLL_COST, SCOUT_DISCOUNT, SLOTS, START_HP, streakGold, XP_COST, type Pos } from "@/lib/taktik/rules";
import { sheet } from "@/lib/taktik/sim";
import { STYLES, type TraitState } from "@/lib/taktik/traits";
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
import { act, kickOff, quitTaktik, useTaktik } from "~/lib/taktik";
import { C, F, T } from "~/lib/theme";
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
  const { lobby } = useTaktik();
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
  const [coins, setCoins] = useState<{ id: number; total: number; left: number; to: { x: number; y: number } } | null>(null);
  const goldRef = useRef<View | null>(null);
  /** the lobby intro was seen for this game (seed) */
  const [introSeen, setIntroSeen] = useState(() => introShown);
  const scroller = useRef<ScrollView>(null);
  // first game: a walkthrough that lights up each part of the screen in turn
  const tour = useTour("taktik-v1", [
    { target: "shop", title: t("ttkTour1T"), body: t("ttkTour1") },
    { target: "gold", title: t("ttkTour2T"), body: t("ttkTour2").replace("{income}", String(INCOME)).replace("{step}", String(INTEREST_STEP)) },
    { target: "pitch", title: t("ttkTour3T"), body: t("ttkTour3") },
    { target: "traits", title: t("ttkTour4T"), body: t("ttkTour4") },
    { target: "bench", title: t("ttkTour5T"), body: t("ttkTour5"), before: () => scroller.current?.scrollToEnd({ animated: true }) },
    { target: "reroll", title: t("ttkTour6T"), body: t("ttkTour6").replace("{g}", String(REROLL_COST)) },
    { target: "xp", title: t("ttkTour7T"), body: t("ttkTour7").replace("{g}", String(XP_COST)) },
    { target: "hp", title: t("ttkTour8T"), body: t("ttkTour8"), before: () => scroller.current?.scrollTo({ y: 0, animated: true }) },
    { target: "table", title: t("ttkTour9T"), body: t("ttkTour9") },
    { target: "kick", title: t("ttkTour10T"), body: t("ttkTour10") },
  ]);

  const me: Manager | undefined = lobby?.managers[0];
  const out = !!me && (me.place !== null || !!lobby?.over);
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
      act((l) => chooseAugment(l, me, i));
      // a card that brings players (Academy, Star signing) walks them onto the pitch too
      act(() => fillField(me));
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


  const tapUnit = (uid: string) => {
    haptic.tap();
    const u = me.units.find((x) => x.uid === uid)!;
    if (sel?.kind === "item") {
      if (!act(() => equip(me, sel.index, uid))) flash(t("ttkFieldFull"));
      setSel(null);
      return;
    }
    if (sel?.kind === "unit" && sel.uid !== uid && selectedUnit) {
      // swap / place the selected one where this one stands
      if (u.slot !== null) {
        act(() => move(me, selectedUnit.uid, u.slot));
        setSel(null);
        return;
      }
      if (selectedUnit.slot !== null) {
        act(() => move(me, uid, selectedUnit.slot));
        setSel(null);
        return;
      }
    }
    setSel(sel?.kind === "unit" && sel.uid === uid ? null : { kind: "unit", uid });
  };

  const tapSlot = (slot: number) => {
    if (sel?.kind !== "unit") return;
    if (!act(() => move(me, sel.uid, slot))) flash(t("ttkFieldFull"));
    else haptic.tap();
    setSel(null);
  };

  const tapBench = () => {
    if (sel?.kind !== "unit") return;
    if (!act(() => move(me, sel.uid, null))) flash(t("ttkBenchFull"));
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
    const r = act((l) => buy(l, me, i));
    if (r === "gold") flash(t("ttkNoGold"));
    else if (r === "full") flash(t("ttkBenchFull"));
    else {
      // straight onto the pitch while there's room (the manager's own placements stay)
      act(() => fillField(me));
      haptic.success();
    }
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
    const r = act((l) => buy(l, me, scout, guess));
    if (r === "ok") act(() => fillField(me));
    if (r === "ok") {
      haptic.success();
      flash(t("ttkScoutRight").replace("{name}", scoutPlayer.name));
      setScout(null);
    } else setScoutMsg(r === "gold" ? t("ttkNoGold") : t("ttkBenchFull"));
  };
  const buyScoutFull = () => {
    if (scout === null) return;
    const r = act((l) => buy(l, me, scout));
    if (r === "ok") setScout(null);
    else setScoutMsg(r === "gold" ? t("ttkNoGold") : t("ttkBenchFull"));
  };

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
  const traitDesc = (x: TraitState) =>
    x.kind === "club" ? t("ttkClubTrait") : x.kind === "country" ? t(STYLES[x.id] ? (`ttkStyle_${x.id}` as "ttkStyle_brazil") : "ttkStyle_other") : x.id === "legend" ? t("ttkLegendTrait") : traitLabel(x);
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
    const gold = lobby.last.find((r) => r.home === me.id && r.away === -1)?.drops?.gold ?? 0;
    if (!gold) return;
    // once the match screen has faded away
    setTimeout(() => goldRef.current?.measureInWindow((x, y, w, h) => setCoins({ id: Date.now(), total: Math.min(gold, 8), left: Math.min(gold, 8), to: { x: x + 11, y: y + h / 2 } })), 450);
  };

  const startMatch = () => {
    setSel(null);
    haptic.press();
    kickOff();
    setMatch(true);
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
  const looks = avatarsOf(lobby.managers, me.id);
  const benchW = (width - 24 - 7 * 6) / 8;
  const shopW = (width - 24 - 4 * 8) / 5;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <FocusStatusBar style="dark" />
      {/* top: back, the round, the clock, health / gold / streak */}
      <View style={[styles.top, { paddingTop: insets.top + 2 }]}>
        <View style={styles.topRow}>
          <Tap onPress={() => router.back()} style={styles.back} accessibilityLabel="‹">
            <Icon name="arrow.left" size={20} color={C.text} fallback="‹" />
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
            <Text style={styles.statText}>{me.gold - (coins?.left ?? 0)}</Text>
          </View>
          {/* a streak of 2+ pays extra gold each round: show it */}
          {Math.abs(me.streak) >= 2 && (
            <Tap
              onPress={() => flash(t(me.streak > 0 ? "ttkWinStreak" : "ttkLossStreak").replace("{n}", String(Math.abs(me.streak))).replace("{g}", String(streakGold(Math.abs(me.streak)))))}
              style={styles.stat}
              accessibilityLabel={t(me.streak > 0 ? "ttkWinStreak" : "ttkLossStreak").replace("{n}", String(Math.abs(me.streak))).replace("{g}", String(streakGold(Math.abs(me.streak))))}
            >
              {me.streak > 0 ? <Image source={TAKTIK.ui.flame} style={styles.statIcon} /> : <Text style={{ fontSize: 15 }}>🧊</Text>}
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
            <Icon name="questionmark" size={13} color={C.text2} fallback="?" />
          </Tap>
        </View>
        {/* the set-up clock, big: at zero everyone kicks off at once; nothing pauses it but the first-time walkthrough */}
        <View ref={tour.ref("kick")} collapsable={false} style={{ marginTop: 4 }}>
          <PlanClock key={`clock-${lobby.seed}-${roundKey}`} wide seconds={planSeconds(lobby.stage)} running={!match && !out && !showIntro && tour.step === null} onEnd={startMatch} />
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
          {/* the near edge: how many are on it, and one tap for the best side */}
          <View style={styles.pills} pointerEvents="box-none">
            <View style={styles.pill}>
              <Text style={styles.pillText}>{t("ttkOnPitch").replace("{n}", String(onPitch.length)).replace("{m}", String(cap))}</Text>
            </View>
            <Tap
              onPress={() => {
                act(() => autoArrange(me));
                setSel(null);
                haptic.success();
              }}
              style={styles.pill}
              accessibilityLabel={t("ttkBestLineup")}
            >
              <Image source={TAKTIK.ui.wand} style={{ width: 15, height: 16 }} />
              <Text style={styles.pillText}>{t("ttkBestLineup")}</Text>
            </Tap>
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
            <Text style={[styles.head, { fontSize: 17 }]}>{t("ttkLevel").replace("{n}", String(me.level))}</Text>
            <View style={styles.levelTrack}>
              <View style={[styles.levelFill, { width: `${xpNeed ? (me.xp / xpNeed) * 100 : 100}%` }]} />
            </View>
            <Text style={styles.headSub}>{xpNeed ? `${me.xp}/${xpNeed}` : "MAX"}</Text>
            <View ref={tour.ref("xp")} collapsable={false}>
              <Tap onPress={() => (act(() => buyXp(me)) ? haptic.tap() : flash(t("ttkNoGold")))} style={[styles.grayBtn, { paddingVertical: 6, paddingHorizontal: 9 }]} accessibilityLabel={`${t("ttkBuyXp")} ${XP_COST}`}>
                <Text style={[styles.grayBtnText, { fontSize: 15 }]}>XP · {XP_COST}</Text>
                <Image source={TAKTIK.ui.coin} style={{ width: 15, height: 15 }} />
              </Tap>
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
              <Tap onPress={() => (act((l) => reroll(l, me)) ? haptic.tap() : flash(t("ttkNoGold")))} style={styles.grayBtn} accessibilityLabel={`${t("ttkReroll")} ${REROLL_COST}`}>
                <Image source={TAKTIK.ui.reroll} style={{ width: 18, height: 17 }} />
                <Text style={styles.grayBtnText}>
                  {t("ttkReroll")} · {REROLL_COST}
                </Text>
                <Image source={TAKTIK.ui.coin} style={{ width: 16, height: 16 }} />
              </Tap>
            </View>
          </View>
          <View style={styles.shop}>
            {me.shop.map((card, i) => {
              if (!card) return <View key={i} style={[styles.shopCard, styles.shopGone, { width: shopW }]} />;
              const p = lobby.players[card.pid];
              const owned = me.units.filter((u) => u.pid === p.pid && u.star === 1).length;
              return (
                <Tap
                  key={i}
                  onPress={() => tapShop(i, card)}
                  style={[styles.shopCard, { width: shopW }, card.scout && styles.scoutCard, me.gold < p.cost && { opacity: 0.45 }]}
                  accessibilityLabel={card.scout ? t("ttkScoutTitle") : `${p.name}, ${p.cost}`}
                >
                  <View style={styles.shopPrice}>
                    <Image source={TAKTIK.ui.coin} style={{ width: 16, height: 16 }} />
                    <Text style={styles.shopPriceText}>{p.cost}</Text>
                  </View>
                  {card.scout ? <Image source={TAKTIK.ui.scout} style={{ width: shopW * 0.6, height: shopW * 0.68 }} resizeMode="contain" /> : <Shirt club={p.club} size={shopW * 0.7} />}
                  <Text style={[styles.shopName, card.scout && { color: "#5B21B6" }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                    {card.scout ? t("ttkScoutShort") : surname(p.name)}
                  </Text>
                  {card.scout ? (
                    <Text style={styles.shopPos}> </Text>
                  ) : (
                    <View style={styles.tagLine}>
                      <Flag id={p.country} width={14} />
                      <Text style={styles.shopPos}>{t(`ttkPos_${p.pos}`)}</Text>
                    </View>
                  )}
                  <View style={[styles.costBar, { backgroundColor: card.scout ? "#A78BFA" : COST_COLOR[p.cost] }]} />
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
          <Tap
            onPress={() => {
              act((l) => sell(l, me, selectedUnit.uid));
              haptic.success();
              setSel(null);
            }}
            style={[styles.chunky, styles.sell]}
          >
            <Image source={TAKTIK.ui.coin} style={{ width: 24, height: 24 }} />
            <Text style={styles.sellText}>{t("ttkSell").replace("{g}", String(sellValue(selectedUnit)))}</Text>
          </Tap>
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
              <Text style={T.body}>{traitDesc(info)}</Text>
              <Text style={T.caption}>{info.steps.map((s, i) => (i < info.tier ? `✓ ${s}` : String(s))).join("  ·  ")}</Text>
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
                <View style={[styles.price, { position: "relative", backgroundColor: COST_COLOR[scoutPlayer.cost] }]}>
                  <Text style={styles.priceText}>🪙 {scoutPlayer.cost}</Text>
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
                <Tap
                  onPress={() => (act((l) => rerollAugment(l, me, i)) ? haptic.tap() : flash(t("ttkAugNoSwaps")))}
                  disabled={augPick !== null || !me.offerRerolls}
                  style={[styles.augSwap, (!me.offerRerolls || augPick !== null) && { opacity: 0.35 }]}
                  accessibilityLabel={t("ttkAugSwap")}
                >
                  <Icon name="arrow.triangle.2.circlepath" size={13} color="white" fallback="↻" />
                  <Text style={styles.augSwapText}>{t("ttkAugSwap")}</Text>
                </Tap>
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
                  <View style={[styles.mgrBar, { width: "100%" }]}>
                    <View style={[styles.mgrFill, { width: `${Math.max(0, m.hp)}%`, backgroundColor: m.hp > 50 ? C.green : m.hp > 25 ? "#F59E0B" : C.red }]} />
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
  back: { width: 30, height: 34, alignItems: "center", justifyContent: "center" },
  help: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.key, alignItems: "center", justifyContent: "center" },
  stage: { fontFamily: F.black, fontSize: 21, color: C.text },
  vline: { width: 1, height: 26, backgroundColor: C.border },
  stat: { flexDirection: "row", alignItems: "center", gap: 3 },
  statIcon: { width: 22, height: 22, resizeMode: "contain" },
  statText: { fontFamily: F.black, fontSize: 21, color: C.text },
  table: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 12, paddingBottom: 4 },
  mgr: { alignItems: "center", gap: 3 },
  mgrBar: { width: 26, height: 3, borderRadius: 2, backgroundColor: C.key, overflow: "hidden" },
  mgrFill: { height: 3, borderRadius: 2 },
  traits: { flexDirection: "row", flexWrap: "wrap", gap: 5, paddingHorizontal: 12, paddingVertical: 6, alignItems: "center" },
  trait: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: C.card, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: C.border },
  traitOn: { backgroundColor: C.green, borderColor: C.green },
  traitText: { fontFamily: F.display, fontSize: 13, color: C.text },
  item: { width: 28, height: 26, borderRadius: 13, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  itemOn: { backgroundColor: "#FEF3C7", borderColor: "#FACC15" },
  hint: { color: C.text3, fontSize: 12, textAlign: "center" },
  plus: { position: "absolute", borderRadius: 8, borderWidth: 1.5, borderStyle: "dashed", borderColor: "rgba(255,255,255,0.75)", backgroundColor: "rgba(0,0,0,0.06)", alignItems: "center", justifyContent: "center" },
  plusLit: { borderColor: "#FACC15", backgroundColor: "rgba(250,204,21,0.22)" },
  plusText: { fontSize: 24, fontWeight: "300", color: "rgba(255,255,255,0.9)" },
  onPitch: { position: "absolute", alignItems: "center" },
  tag: { marginTop: -4, minWidth: "70%", maxWidth: "100%", backgroundColor: "white", borderRadius: 4, paddingHorizontal: 6, paddingTop: 2, paddingBottom: 1, alignItems: "center", borderBottomWidth: 3 },
  tagPicked: { backgroundColor: "#FEF3C7" },
  tagName: { fontFamily: F.display, fontSize: 14, lineHeight: 16, color: C.text },
  tagPos: { fontSize: 9, fontWeight: "800", color: C.text3, letterSpacing: 0.5 },
  tagLine: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3 },
  lit: { position: "absolute", flexDirection: "row", gap: 2, alignSelf: "center", zIndex: 3 },
  litChip: { backgroundColor: "white", borderRadius: 999, paddingHorizontal: 3, paddingVertical: 1, borderWidth: 1.5, borderColor: "#22C55E", shadowColor: "#22C55E", shadowOpacity: 0.9, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } },
  glow: { position: "absolute", alignSelf: "center", backgroundColor: "rgba(250,250,140,0.35)", shadowColor: "#FDE047", shadowOpacity: 0.9, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  tagItems: { position: "absolute", top: 0, right: 4, gap: 1 },
  pills: { position: "absolute", left: 8, right: 8, bottom: 6, flexDirection: "row", justifyContent: "space-between" },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  pillText: { fontFamily: F.display, fontSize: 13, color: C.text },
  footer: { backgroundColor: C.bg, paddingTop: 10, gap: 8 },
  mgrBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.key, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  mgrBtnText: { fontFamily: F.display, fontSize: 15, color: C.text },
  drawerShade: { backgroundColor: "rgba(0,0,0,0.3)" },
  drawer: { position: "absolute", right: 0, top: 0, bottom: 0, width: 240, backgroundColor: C.card, paddingHorizontal: 14, gap: 4, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 16 },
  drawerTitle: { fontFamily: F.black, fontSize: 22, color: C.text, marginBottom: 6, textTransform: "uppercase" },
  drawerRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.divider },
  drawerName: { fontFamily: F.display, fontSize: 17, color: C.text },
  drawerHp: { fontFamily: F.display, fontSize: 16, color: C.text2, minWidth: 30, textAlign: "right" },
  headRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  head: { fontFamily: F.black, fontSize: 21, color: C.text, textTransform: "uppercase" },
  headSub: { fontSize: 13, fontWeight: "600", color: C.text2 },
  sub: { alignItems: "center", justifyContent: "center", backgroundColor: "#E8ECE9", borderRadius: 6, borderBottomWidth: 3 },
  subPicked: { backgroundColor: "#FEF3C7" },
  subEmpty: { alignItems: "center", justifyContent: "center", borderRadius: 6, borderWidth: 1.5, borderStyle: "dashed", borderColor: C.border },
  subName: { fontFamily: F.display, fontSize: 13, color: C.text, paddingHorizontal: 2 },
  subPos: { fontSize: 9, fontWeight: "800", color: C.text3 },
  levelLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  levelTrack: { width: 54, height: 6, borderRadius: 3, backgroundColor: C.key, overflow: "hidden" },
  levelFill: { height: 6, borderRadius: 3, backgroundColor: "#F43F5E" },
  grayBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#E2E7E3", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
  grayBtnText: { fontFamily: F.display, fontSize: 17, color: C.text },
  rule: { height: 1, backgroundColor: C.border, marginHorizontal: 12 },
  note: { position: "absolute", left: 0, right: 0, top: -16, textAlign: "center", color: C.greenMid, fontWeight: "800", fontSize: 12 },
  shop: { flexDirection: "row", gap: 8 },
  shopCard: { alignItems: "center", backgroundColor: "#E8ECE9", borderRadius: 8, paddingTop: 6, paddingBottom: 8, overflow: "hidden" },
  shopGone: { backgroundColor: "transparent", borderWidth: 1.5, borderStyle: "dashed", borderColor: C.border },
  scoutCard: { backgroundColor: "#EDE9FE" },
  shopPrice: { flexDirection: "row", alignItems: "center", gap: 3 },
  shopPriceText: { fontFamily: F.black, fontSize: 18, color: C.text },
  shopName: { fontFamily: F.display, fontSize: 16, color: C.text, marginTop: 2, paddingHorizontal: 3 },
  shopPos: { fontSize: 10, fontWeight: "800", color: C.text3, letterSpacing: 0.5 },
  costBar: { position: "absolute", left: 0, right: 0, bottom: 0, height: 3 },
  owned: { position: "absolute", top: 4, right: 4, backgroundColor: C.text, borderRadius: 6, paddingHorizontal: 4 },
  ownedText: { fontSize: 9, fontWeight: "900", color: "white" },
  cluesBig: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  price: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  priceText: { fontWeight: "800", fontSize: 12, color: "white" },
  // Duolingo-style chunky button: a darker bottom edge instead of a shadow
  chunky: { minHeight: 52, borderRadius: 10, borderBottomWidth: 4, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 10 },
  sell: { marginHorizontal: 12, backgroundColor: "#F43F5E", borderBottomColor: "#BE123C" },
  sellText: { fontFamily: F.black, fontSize: 24, color: "white" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  infoCard: { margin: 24, marginTop: "60%", backgroundColor: C.card, borderRadius: 18, padding: 16, gap: 8 },
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 16, gap: 10 },
  input: { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, height: 50, fontSize: 18, color: C.text },
  offer: { backgroundColor: C.bg, borderRadius: 22, padding: 18, gap: 10 },
  finalRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.card, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  finalMe: { borderWidth: 2, borderColor: C.green },
  finalPlace: { width: 22, fontFamily: F.display, fontSize: 20, color: C.text2, textAlign: "center" },
  finalTraits: { flexDirection: "row", gap: 4 },
  finalTrait: { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: C.greenSoft, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 3 },
  finalTraitText: { fontFamily: F.display, fontSize: 13, color: C.greenDark },
  augScreen: { flex: 1, backgroundColor: "rgba(3,15,9,0.86)", justifyContent: "center", paddingHorizontal: 12 },
  augHead: { flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "center" },
  augLine: { flex: 1, height: 1, backgroundColor: "rgba(253,230,138,0.5)" },
  augTitle: { fontFamily: F.display, fontSize: 26, color: "#FDE68A" },
  augHint: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "600", textAlign: "center", marginTop: 4 },
  augRow: { flexDirection: "row", justifyContent: "center", gap: 10, marginTop: 22 },
  augSwap: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  augSwapText: { fontFamily: F.display, fontSize: 15, color: "white" },
});
