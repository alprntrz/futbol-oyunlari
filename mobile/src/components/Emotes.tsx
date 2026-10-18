import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeOut, ZoomIn } from "react-native-reanimated";

import { haptic } from "~/lib/haptics";
import { getSocket } from "~/lib/socket";

import { Text } from "./Text";
import { Icon, Tap } from "./ui";

/** A fixed set (server.js EMOTES): no free text, so nothing to moderate. */
export const EMOTES = { clap: "👏", wow: "😮", laugh: "😂", fire: "🔥", gg: "🤝", think: "🤔", cry: "😭", cool: "😎" } as const;
export type EmoteId = keyof typeof EMOTES;
const IDS = Object.keys(EMOTES) as EmoteId[];
/** what the house player sends back now and then */
const FRIENDLY: EmoteId[] = ["clap", "laugh", "gg", "cool", "think", "wow"];

const SHOW_MS = 2400;

type Bubble = { id: number; emote: EmoteId };

/** Emote state for one game screen; pair with EmoteButton and EmoteLayer (or use Emotes). */
export function useEmotes(game: "ht" | "pp" | "dz" | "rd", online: boolean) {
  const [open, setOpen] = useState(false);
  const [mine, setMine] = useState<Bubble | null>(null);
  const [theirs, setTheirs] = useState<Bubble | null>(null);
  const n = useRef(0);

  useEffect(() => {
    if (!online) return;
    const socket = getSocket();
    const onRecv = (m: { game: string; emote: EmoteId }) => {
      if (m.game !== game || !(m.emote in EMOTES)) return;
      haptic.tap();
      setTheirs({ id: ++n.current, emote: m.emote });
    };
    socket.on("em:recv", onRecv);
    return () => {
      socket.off("em:recv", onRecv);
    };
  }, [online, game]);

  // bubbles fade on their own
  useEffect(() => {
    if (!mine) return;
    const id = setTimeout(() => setMine(null), SHOW_MS);
    return () => clearTimeout(id);
  }, [mine]);
  useEffect(() => {
    if (!theirs) return;
    const id = setTimeout(() => setTheirs(null), SHOW_MS);
    return () => clearTimeout(id);
  }, [theirs]);

  const send = (emote: EmoteId) => {
    haptic.tap();
    setOpen(false);
    setMine({ id: ++n.current, emote });
    if (online) getSocket().emit("em:send", { game, emote });
    else if (Math.random() < 0.4) {
      // the house player answers now and then
      const back = FRIENDLY[Math.floor(Math.random() * FRIENDLY.length)];
      setTimeout(() => setTheirs({ id: ++n.current, emote: back }), 1200 + Math.random() * 1800);
    }
  };
  return { open, toggle: () => (haptic.tap(), setOpen((o) => !o)), mine, theirs, send };
}

type EmoteState = ReturnType<typeof useEmotes>;

export function EmoteButton({ e, color = "white", bg = "rgba(255,255,255,0.14)" }: { e: EmoteState; color?: string; bg?: string }) {
  return (
    <Tap onPress={e.toggle} style={[styles.button, { backgroundColor: bg }]} accessibilityLabel="Emoji">
      <Icon name="face.smiling" size={18} color={color} fallback="🙂" />
    </Tap>
  );
}

/** The emoji row (when open) and the bubbles: mine on the left, theirs on the right, `top` from the screen's top. */
export function EmoteLayer({ e, top }: { e: EmoteState; top: number }) {
  return (
    <>
      {e.open && (
        <View style={[styles.tray, { top }]}>
          {IDS.map((id) => (
            <Tap key={id} onPress={() => e.send(id)} style={styles.item} accessibilityLabel={id}>
              <Text style={styles.emoji}>{EMOTES[id]}</Text>
            </Tap>
          ))}
        </View>
      )}
      {e.mine && (
        <Animated.View key={e.mine.id} entering={ZoomIn.duration(180)} exiting={FadeOut.duration(200)} style={[styles.bubble, { top: top + 58, left: 20 }]} pointerEvents="none">
          <Text style={styles.bubbleEmoji}>{EMOTES[e.mine.emote]}</Text>
        </Animated.View>
      )}
      {e.theirs && (
        <Animated.View key={e.theirs.id} entering={ZoomIn.duration(180)} exiting={FadeOut.duration(200)} style={[styles.bubble, { top: top + 58, right: 20 }]} pointerEvents="none">
          <Text style={styles.bubbleEmoji}>{EMOTES[e.theirs.emote]}</Text>
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  button: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  tray: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "white",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  item: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 26 },
  bubble: {
    position: "absolute",
    zIndex: 40,
    backgroundColor: "white",
    borderRadius: 26,
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  bubbleEmoji: { fontSize: 32 },
});
