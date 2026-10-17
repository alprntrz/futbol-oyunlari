import { useEffect, useRef, useState, type ReactNode } from "react";
import { Image, Platform, Share, StyleSheet, View, type ImageSourcePropType } from "react-native";
import { captureRef } from "react-native-view-shot";

import { BRAND } from "~/lib/brand";
import { useI18n } from "~/lib/i18n";
import { C, F, GAME } from "~/lib/theme";

import { Text } from "./Text";

/** Where a shared result points: the public site (links to the stores). */
export const SHARE_URL = "https://alprntrz.github.io/futbol-oyunlari/";

/** One square of the result grid: right first time / right later / right late / wrong / not played. */
export type Mark = "ok" | "mid" | "late" | "miss" | "empty";

export type ShareSpec = {
  game: keyof typeof GAME;
  /** game name on the card, e.g. "Tic-Tac-Toe" */
  name: string;
  /** "#123" for a daily puzzle */
  tag?: string;
  rows: Mark[][];
  /** a picture in place of the grid (a game without one, e.g. Dribbling Rush) */
  art?: ImageSourcePropType;
  /** optional text inside each square (e.g. players found there) */
  labels?: string[][];
  /** the big number, e.g. "7/9" */
  score: string;
  detail?: string;
  /** the emoji text that goes with the image (and alone where an image can't go) */
  text: string;
};

const MARK: Record<Mark, string> = { ok: C.tileCorrect, mid: C.tilePresent, late: "#F97316", miss: C.coral, empty: "#FFFFFF" };

/**
 * Wordle-style sharing with a picture: `share(spec)` draws a result card off screen, snaps it
 * and opens the share sheet with the image, the emoji text and the site link (iOS). Where an
 * image can't be attached (Android's Share, or a failed snapshot) the text goes alone.
 * Nothing about the player is on the card: no nick, no avatar.
 */
export function useShareCard(): { share: (s: ShareSpec) => void; card: ReactNode } {
  const { t } = useI18n();
  const ref = useRef<View>(null);
  const [spec, setSpec] = useState<ShareSpec | null>(null);
  const ready = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!spec || !ready.current) return;
    const go = ready.current;
    ready.current = null;
    // two frames: the card is laid out and its images are drawn
    requestAnimationFrame(() => requestAnimationFrame(go));
  }, [spec]);

  const share = (s: ShareSpec) => {
    const message = `${s.text}\n\n${t("shareCta")} ${SHARE_URL}`;
    if (Platform.OS !== "ios") {
      Share.share({ message });
      return;
    }
    ready.current = async () => {
      try {
        const uri = await captureRef(ref, { format: "png", quality: 1, result: "tmpfile" });
        await Share.share({ url: uri, message });
      } catch {
        Share.share({ message });
      }
    };
    setSpec({ ...s });
  };

  const card = spec ? (
    <View style={styles.offscreen} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View ref={ref} collapsable={false} style={[styles.card, { backgroundColor: GAME[spec.game].bg }]}>
        <Image source={BRAND.wordmark} style={styles.logo} resizeMode="contain" />
        <Text allowFontScaling={false} style={[styles.name, { color: GAME[spec.game].ink }]}>
          {spec.name}
          {spec.tag ? <Text allowFontScaling={false} style={styles.tag}>{`  ${spec.tag}`}</Text> : null}
        </Text>
        {spec.art ? <Image source={spec.art} style={styles.art} resizeMode="contain" /> : null}
        <View style={[styles.grid, !!spec.art && styles.noGrid]}>
          {spec.rows.map((row, r) => (
            <View key={r} style={styles.row}>
              {row.map((m, i) => (
                <View
                  key={i}
                  style={[styles.square, { width: sizeOf(spec.rows), height: sizeOf(spec.rows), backgroundColor: MARK[m] }, m === "empty" && styles.empty]}
                >
                  {spec.labels?.[r]?.[i] ? (
                    <Text allowFontScaling={false} style={styles.label}>
                      {spec.labels[r][i]}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          ))}
        </View>
        <Text allowFontScaling={false} style={[styles.score, { color: GAME[spec.game].ink }]}>
          {spec.score}
        </Text>
        {spec.detail ? (
          <Text allowFontScaling={false} style={styles.detail}>
            {spec.detail}
          </Text>
        ) : null}
        <Text allowFontScaling={false} style={styles.footer}>
          {t("shareFooter")}
        </Text>
      </View>
    </View>
  ) : null;

  return { share, card };
}

/** Square size so the widest row fits the card (and short rows don't get huge). */
function sizeOf(rows: Mark[][]) {
  const n = Math.max(1, ...rows.map((r) => r.length));
  return Math.min(56, Math.floor((300 - (n - 1) * 8) / n));
}

const styles = StyleSheet.create({
  // laid out but outside the window; the snapshot still draws it
  offscreen: { position: "absolute", left: -10000, top: 0 },
  card: { width: 360, height: 450, borderRadius: 0, alignItems: "center", paddingTop: 28, paddingHorizontal: 24 },
  logo: { width: 132, height: 34 },
  name: { fontFamily: F.display, fontSize: 30, lineHeight: 34, marginTop: 14, textAlign: "center" },
  tag: { fontFamily: F.semi, fontSize: 24, color: C.text2 },
  grid: { gap: 8, marginTop: 20, alignItems: "center", flexGrow: 1, justifyContent: "center" },
  noGrid: { flexGrow: 0, marginTop: 0 },
  art: { width: 260, height: 220, marginTop: 16, flexGrow: 1 },
  row: { flexDirection: "row", gap: 8 },
  square: { borderRadius: 10, alignItems: "center", justifyContent: "center" },
  label: { fontFamily: F.black, fontSize: 26, color: "#FFFFFF" },
  empty: { borderWidth: 2, borderColor: "rgba(0,0,0,0.08)" },
  score: { fontFamily: F.black, fontSize: 44, lineHeight: 48, marginTop: 12 },
  detail: { fontFamily: F.semi, fontSize: 18, color: C.text2, marginTop: 2, textAlign: "center" },
  footer: { fontFamily: F.semi, fontSize: 14, color: C.text3, marginTop: 14, marginBottom: 20 },
});
