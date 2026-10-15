import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Image, Modal, ScrollView, StyleSheet, TextInput, View, type ImageSourcePropType } from "react-native";

import { rankOf, RANKS } from "@/lib/levels";

import { syncProfile, useAccount } from "~/lib/account";
import { AVATARS, loadAvatar, saveAvatar, type AvatarId } from "~/lib/avatar";
import { FRAMES, frameFor, frameUnlocked, saveFrame, useChosenFrame, type FrameId } from "~/lib/cosmetics";
import { pickPhoto, savePhoto, useMyPhoto } from "~/lib/photo";
import { BRAND, TAKTIK } from "~/lib/brand";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { loadNick, saveNick } from "~/lib/nick";
import { C, F, R, T } from "~/lib/theme";
import { loadTrophies } from "~/lib/trophies";
import { loadXp, type XpGame } from "~/lib/xp";

import { Avatar } from "./Avatar";
import { LevelBadge } from "./QuizLevel";
import { RankChip } from "./Rank";
import { SignInCard } from "./SignInCard";
import { Text } from "./Text";
import { Button, Card, Icon, Row, SectionLabel, Tap } from "./ui";

type Xp = Awaited<ReturnType<typeof loadXp>>;

const GAMES: { game: XpGame; image: ImageSourcePropType; name: string }[] = [
  { game: "ht", image: BRAND.icon.tiki, name: "tikiTakaName" },
  { game: "qz", image: BRAND.icon.quiz, name: "qzName" },
  { game: "xi", image: BRAND.icon.practice, name: "missingXI" },
  { game: "mystery", image: BRAND.icon.mystery, name: "myName" },
  { game: "bingo", image: BRAND.icon.bingo, name: "bingoName" },
  { game: "pp", image: BRAND.icon.possession, name: "ppName" },
  { game: "tt", image: TAKTIK.hero, name: "ttkName" },
  { game: "dz", image: BRAND.icon.team, name: "dzName" },
];

/** Top of the Profile tab: avatar, nickname, overall level and XP per game. */
export function ProfileCard() {
  const { t } = useI18n();
  const [nick, setNick] = useState("");
  const [avatar, setAvatar] = useState<AvatarId | null>(null);
  const [xp, setXp] = useState<Xp | null>(null);
  const [trophies, setTrophies] = useState(0);
  const [editing, setEditing] = useState(false);
  const account = useAccount();
  const myPhoto = useMyPhoto();
  const chosenFrame = useChosenFrame();

  const refresh = useCallback(() => {
    loadNick().then(setNick);
    loadAvatar().then(setAvatar);
    loadXp().then(setXp);
    loadTrophies().then(setTrophies);
  }, []);
  useFocusEffect(refresh);
  // signing in / out swaps the XP, nickname and avatar
  useEffect(() => {
    if (account !== undefined) refresh();
  }, [account, refresh]);

  const level = xp?.level ?? 1;
  const rank = rankOf(level);
  const fraction = xp ? xp.into / xp.need : 0;

  return (
    <>
      <Card style={styles.card}>
        <View style={styles.top}>
          <Tap onPress={() => setEditing(true)} accessibilityLabel={t("editProfile")}>
            <Avatar id={avatar} nick={nick} size={72} me />
          </Tap>
          <View style={{ flex: 1 }}>
            <Text style={T.title} numberOfLines={1}>
              {nick}
            </Text>
            <View style={[styles.guest, account && { backgroundColor: C.greenSoft }]}>
              <Text style={[styles.guestText, account && { color: C.greenDark }]}>
                {account ? t(account.provider === "apple" ? "signedInApple" : "signedInGoogle") : t("guest")}
              </Text>
            </View>
          </View>
          <Tap onPress={() => setEditing(true)} style={styles.edit} accessibilityLabel={t("editProfile")}>
            <Icon name="pencil" size={18} color={C.text} fallback="✎" />
          </Tap>
        </View>

        <View style={styles.levelRow}>
          <LevelBadge level={level} size={44} />
          <View style={{ flex: 1 }}>
            <View style={styles.levelHead}>
              <Text style={styles.levelText}>{t("levelN").replace("{n}", String(level))}</Text>
              <Text style={T.caption}>
                {xp?.into ?? 0} / {xp?.need ?? 100} XP
              </Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.max(3, fraction * 100)}%` }]} />
            </View>
            <Text style={[T.caption, { marginTop: 4 }]}>{t("totalXp").replace("{n}", String(xp?.xp ?? 0))}</Text>
          </View>
        </View>
        {/* rank: where this level sits in the career ladder, and the next step */}
        <View style={styles.rankRow}>
          <RankChip level={level} />
          <Text style={T.caption} numberOfLines={1}>
            {rank.nextAt === null
              ? t("rankTop")
              : t("rankNext")
                  .replace("{rank}", t(`rank_${RANKS[rank.index + 1].id}` as Parameters<typeof t>[0]))
                  .replace("{n}", String(rank.nextAt))}
          </Text>
        </View>
        {!account && <Text style={[T.caption, { marginTop: 12 }]}>{t("guestNote")}</Text>}
      </Card>

      {account === null && <SignInCard />}

      <Card style={{ padding: 0, overflow: "hidden", marginTop: 16 }}>
        <Row icon="person.2.fill" iconFallback="👥" color={C.blue} soft={C.blueSoft} title={t("friends")} subtitle={t("friendsDesc")} onPress={() => router.push("/arkadaslar")} />
        <Row icon="trophy.fill" iconFallback="🏆" color={C.amber} soft={C.amberSoft} title={t("leaderboards")} onPress={() => router.push("/siralamalar")} last />
      </Card>

      <SectionLabel>{t("xpByGame")}</SectionLabel>
      <Card style={{ paddingVertical: 6 }}>
        {GAMES.map((g, i) => (
          <View key={g.game} style={[styles.gameRow, i > 0 && styles.divider]}>
            <View style={styles.gameIcon}>
              <Image source={g.image} style={{ width: 30, height: 30 }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={T.headline}>{t(g.name as Parameters<typeof t>[0])}</Text>
              {g.game === "ht" && trophies > 0 && <Text style={T.caption}>{t("trophiesN").replace("{n}", String(trophies))}</Text>}
              {account && (g.game === "ht" || g.game === "qz" || g.game === "pp") && account.ratings[g.game] && (
                <Text style={T.caption}>
                  {t("ratingLabel")} {account.ratings[g.game]!.rating} · {(account.ratings[g.game]!.games === 1 ? t("gamesOne") : t("gamesN").replace("{n}", String(account.ratings[g.game]!.games)))}
                </Text>
              )}
            </View>
            <Text style={styles.gameXp}>{xp?.byGame[g.game] ?? 0} XP</Text>
          </View>
        ))}
      </Card>

      <EditProfile
        visible={editing}
        nick={nick}
        avatar={avatar}
        photo={myPhoto}
        level={level}
        frame={chosenFrame}
        onClose={() => setEditing(false)}
        onSave={async (n, a, photo, frame) => {
          saveFrame(frame);
          const savedNick = await saveNick(n);
          setNick(savedNick);
          setAvatar(await saveAvatar(a));
          if (photo !== myPhoto) await savePhoto(photo).catch(() => {});
          setEditing(false);
          syncProfile(savedNick, a);
        }}
      />
    </>
  );
}

/** Sheet: change nickname and pick an avatar. */
function EditProfile({
  visible,
  nick,
  avatar,
  photo,
  level,
  frame,
  onClose,
  onSave,
}: {
  visible: boolean;
  nick: string;
  avatar: AvatarId | null;
  photo: string | null;
  level: number;
  frame: FrameId | null;
  onClose: () => void;
  onSave: (nick: string, avatar: AvatarId, photo: string | null, frame: FrameId | null) => void;
}) {
  const { t } = useI18n();
  const [draftNick, setDraftNick] = useState(nick);
  const [draftAvatar, setDraftAvatar] = useState<AvatarId>(avatar ?? AVATARS[0].id);
  const [draftPhoto, setDraftPhoto] = useState(photo);
  const [draftFrame, setDraftFrame] = useState<FrameId | null>(frame);

  const choosePhoto = async () => {
    haptic.tap();
    const uri = await pickPhoto().catch(() => null);
    if (uri) setDraftPhoto(uri);
  };

  // start from the saved values each time the sheet opens
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) {
      setDraftNick(nick);
      setDraftAvatar(avatar ?? AVATARS[0].id);
      setDraftPhoto(photo);
      setDraftFrame(frame);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
        <View style={styles.sheetHead}>
          <Text style={T.title}>{t("editProfile")}</Text>
          <Tap onPress={onClose} style={styles.edit} accessibilityLabel={t("cancel")}>
            <Icon name="xmark" size={16} color={C.text2} fallback="✕" />
          </Tap>
        </View>

        <View style={{ alignItems: "center", marginVertical: 12 }}>
          <Avatar id={draftAvatar} nick={draftNick || "?"} size={96} photo={draftPhoto} frame={frameFor(level, draftFrame)} />
          <View style={styles.photoRow}>
            <Tap onPress={choosePhoto} style={styles.photoBtn} accessibilityRole="button" accessibilityLabel={t("photoPick")}>
              <Icon name="photo" size={15} color={C.greenDark} fallback="🖼" />
              <Text style={styles.photoText}>{t(draftPhoto ? "photoChange" : "photoPick")}</Text>
            </Tap>
            {draftPhoto && (
              <Tap onPress={() => (haptic.tap(), setDraftPhoto(null))} style={[styles.photoBtn, { backgroundColor: "#EEF2EF" }]} accessibilityRole="button" accessibilityLabel={t("photoRemove")}>
                <Text style={[styles.photoText, { color: C.text2 }]}>{t("photoRemove")}</Text>
              </Tap>
            )}
          </View>
          <Text style={[T.caption, { textAlign: "center", marginTop: 6 }]}>{t("photoNote")}</Text>
        </View>

        <SectionLabel>{t("nickname")}</SectionLabel>
        <TextInput
          value={draftNick}
          onChangeText={setDraftNick}
          maxLength={20}
          autoCorrect={false}
          autoCapitalize="none"
          placeholder={t("nickname")}
          placeholderTextColor={C.text3}
          style={styles.input}
        />

        <SectionLabel>{t("avatarLabel")}</SectionLabel>
        <View style={styles.grid}>
          {AVATARS.map((a) => (
            <Tap
              key={a.id}
              onPress={() => (haptic.tap(), setDraftAvatar(a.id), setDraftPhoto(null))}
              accessibilityRole="button"
              accessibilityState={{ selected: !draftPhoto && a.id === draftAvatar }}
              style={styles.gridCell}
            >
              <Avatar id={a.id} size={68} ring={!draftPhoto && a.id === draftAvatar ? C.greenMid : undefined} />
            </Tap>
          ))}
        </View>

        <SectionLabel>{t("frameLabel")}</SectionLabel>
        <View style={styles.grid}>
          {FRAMES.map((f) => {
            const open = frameUnlocked(f.id, level);
            const on = frameFor(level, draftFrame) === f.id;
            return (
              <Tap
                key={f.id}
                disabled={!open}
                onPress={() => (haptic.tap(), setDraftFrame(f.id))}
                accessibilityRole="button"
                accessibilityState={{ selected: on, disabled: !open }}
                accessibilityLabel={t(`frame_${f.id}`)}
                style={[styles.gridCell, { gap: 4 }]}
              >
                <View style={!open && { opacity: 0.55 }}>
                  <Avatar id={draftAvatar} size={60} photo={draftPhoto} frame={f.id} ring={on ? C.greenMid : undefined} />
                </View>
                {!open && (
                  <View style={styles.lock}>
                    <Icon name="lock.fill" size={14} color={C.text2} fallback="🔒" />
                  </View>
                )}
                <Text style={[T.caption, { textAlign: "center" }, on && { color: C.greenDark, fontWeight: "800" }]} numberOfLines={1}>
                  {open ? t(`frame_${f.id}`) : t(`rank_${RANKS[f.rank].id}`)}
                </Text>
              </Tap>
            );
          })}
        </View>

        <Button title={t("save")} icon="checkmark" onPress={() => onSave(draftNick, draftAvatar, draftPhoto, draftFrame)} style={{ marginTop: 24 }} />
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 16, padding: 18 },
  top: { flexDirection: "row", alignItems: "center", gap: 14 },
  guest: { alignSelf: "flex-start", marginTop: 4, backgroundColor: "#EEF2EF", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  guestText: { fontSize: 13, fontWeight: "700", color: C.text2 },
  edit: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#EEF2EF", alignItems: "center", justifyContent: "center" },
  rankRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 14 },
  levelRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 18 },
  levelHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  levelText: { fontFamily: F.display, fontSize: 20, color: C.text },
  track: { height: 10, borderRadius: 5, backgroundColor: "#E3E8E4", marginTop: 6, overflow: "hidden" },
  fill: { height: 10, borderRadius: 5, backgroundColor: C.green },
  gameRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  gameIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#EEF2EF", alignItems: "center", justifyContent: "center" },
  gameXp: { fontFamily: F.display, fontSize: 18, color: C.greenDark },
  sheet: { padding: 20, paddingBottom: 48 },
  sheetHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  input: { backgroundColor: C.card, borderRadius: R.button, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 13, fontSize: 17, color: C.text },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 12 },
  gridCell: { width: "25%", alignItems: "center" },
  lock: { position: "absolute", top: 20, alignSelf: "center" },
  photoRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  photoBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.greenSoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  photoText: { fontWeight: "700", fontSize: 14, color: C.greenDark },
});
