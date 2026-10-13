import { HStack, Image, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import { font, foregroundStyle, frame, lineLimit, monospacedDigit, multilineTextAlignment, padding } from "@expo/ui/swift-ui/modifiers";
import { createLiveActivity, type LiveActivityEnvironment } from "expo-widgets";

/**
 * Everything the Live Activity shows, already in the player's language (the
 * widget runtime can't reach the app's strings). Times are ms since epoch.
 */
export type MatchActivityProps = {
  /** "Tic-Tac-Toe" / "Possession Play" */
  game: string;
  /** SF Symbol for the game, so it's recognisable even in the compact island */
  icon: string;
  /** "Your turn" / "Kartal34 is thinking" / "Looking for an opponent" / "You won!" */
  headline: string;
  /** what the headline means, for its colour: a mark's turn, a result, or searching */
  tone: "X" | "O" | "win" | "lose" | "draw" | "search";
  /** "Yukifc10 vs Kartal34", or a hint while searching */
  line: string;
  /** "X 1 – 2 O", empty while searching */
  score: string;
  /** this phone's mark ("X" / "O" / "" while searching) */
  mark: "X" | "O" | "";
  /** countdown to this moment (turn clock); 0 = no countdown */
  endsAt: number;
  /** when the countdown (or the search count-up) started */
  since: number;
  /** "search" counts up from `since`; "turn" counts down to `endsAt`; "pause" (between games) and "over" show `score` */
  phase: "search" | "turn" | "pause" | "over";
};

/**
 * Lock Screen banner + Dynamic Island for an online match. The clock is drawn
 * by iOS from `since` / `endsAt`, so it keeps running while the app is in the
 * background. The app sets the stale date 10 s before the clock runs out: iOS
 * redraws then (`isStale`) and the clock turns red, app running or not.
 */
const MatchActivity = (p: MatchActivityProps, env: LiveActivityEnvironment) => {
  "widget";
  // light tints read on the black island and a dark Lock Screen; deeper ones on a light Lock Screen
  const LIGHT = { X: "#9CCBFF", O: "#FFA3B5", win: "#7BE8A8", lose: "#FFA3B5", draw: "#FCD775", search: "#7BE8A8", red: "#FF6B6B", text: "#FFFFFF", sub: "#B9C2BD" };
  const DEEP = { X: "#1D4ED8", O: "#BE123C", win: "#15803D", lose: "#BE123C", draw: "#B45309", search: "#15803D", red: "#DC2626", text: "#0E1A14", sub: "#5F6C64" };
  const banner = env.colorScheme === "light" && !env.isLuminanceReduced ? DEEP : LIGHT;
  const island = LIGHT;
  const urgent = p.phase === "turn" && !!env.isStale;

  // a timer Text takes all the width it's offered: fixed frames keep it on the right
  const clock = (pal: typeof LIGHT, size: number, width: number) =>
    p.phase === "turn" && p.endsAt > p.since ? (
      <Text
        timerInterval={{ lower: new Date(p.since), upper: new Date(p.endsAt) }}
        countsDown
        modifiers={[
          monospacedDigit(),
          font({ weight: "heavy", size, design: "rounded" }),
          foregroundStyle(urgent ? pal.red : pal.text),
          multilineTextAlignment("trailing"),
          frame({ width, alignment: "trailing" }),
        ]}
      />
    ) : p.phase === "search" ? (
      <Text
        timerInterval={{ lower: new Date(p.since), upper: new Date(p.since + 3600000) }}
        countsDown={false}
        modifiers={[monospacedDigit(), font({ weight: "heavy", size, design: "rounded" }), foregroundStyle(pal.text), multilineTextAlignment("trailing"), frame({ width, alignment: "trailing" })]}
      />
    ) : (
      <Text modifiers={[font({ weight: "heavy", size: size - 4, design: "rounded" }), foregroundStyle(pal[p.tone])]}>{p.score}</Text>
    );

  // game icon in the mover's colour, plus this phone's mark
  const badge = (
    <HStack spacing={4}>
      <Image systemName={p.icon as never} color={island[p.tone]} size={15} />
      {p.mark ? <Text modifiers={[font({ weight: "black", size: 15, design: "rounded" }), foregroundStyle(island[p.mark])]}>{p.mark}</Text> : null}
    </HStack>
  );

  return {
    banner: (
      <HStack modifiers={[padding({ all: 16 })]}>
        <VStack alignment="leading" spacing={3}>
          <HStack spacing={5}>
            <Image systemName={p.icon as never} color={banner.sub} size={13} />
            <Text modifiers={[font({ weight: "semibold", size: 13 }), foregroundStyle(banner.sub)]}>{p.game}</Text>
          </HStack>
          <Text modifiers={[font({ weight: "heavy", size: 21 }), foregroundStyle(banner[p.tone]), lineLimit(1)]}>{p.headline}</Text>
          <Text modifiers={[font({ size: 14 }), foregroundStyle(banner.text), lineLimit(1)]}>{p.line}</Text>
        </VStack>
        <Spacer />
        <VStack alignment="trailing" spacing={2}>
          {clock(banner, 30, 96)}
          {p.phase === "turn" ? <Text modifiers={[font({ weight: "semibold", size: 14 }), foregroundStyle(banner.text)]}>{p.score}</Text> : null}
        </VStack>
      </HStack>
    ),
    compactLeading: badge,
    compactTrailing:
      p.phase === "turn" && p.endsAt > p.since ? (
        <Text
          timerInterval={{ lower: new Date(p.since), upper: new Date(p.endsAt) }}
          countsDown
          modifiers={[
            monospacedDigit(),
            font({ weight: "bold", size: 15 }),
            foregroundStyle(urgent ? island.red : island.text),
            multilineTextAlignment("trailing"),
            frame({ width: 46, alignment: "trailing" }),
          ]}
        />
      ) : p.phase === "search" ? (
        <Image systemName="magnifyingglass" color={island.search} />
      ) : (
        <Text modifiers={[font({ weight: "bold", size: 14 }), foregroundStyle(island[p.tone])]}>{p.score}</Text>
      ),
    minimal: <Image systemName={p.icon as never} color={island[p.tone]} />,
    expandedLeading: (
      <HStack spacing={6} modifiers={[padding({ leading: 6, top: 4 })]}>
        <Image systemName={p.icon as never} color={island[p.tone]} size={18} />
        <Text modifiers={[font({ weight: "bold", size: 15 }), foregroundStyle(island.text), lineLimit(1)]}>{p.game}</Text>
      </HStack>
    ),
    expandedTrailing: <VStack modifiers={[padding({ trailing: 6 })]}>{clock(island, 30, 96)}</VStack>,
    expandedBottom: (
      <VStack alignment="leading" spacing={2} modifiers={[padding({ horizontal: 8, bottom: 6 })]}>
        <Text modifiers={[font({ weight: "heavy", size: 19 }), foregroundStyle(island[p.tone]), lineLimit(1)]}>{p.headline}</Text>
        <HStack>
          <Text modifiers={[font({ size: 14 }), foregroundStyle(island.text), lineLimit(1)]}>{p.line}</Text>
          <Spacer />
          {p.phase === "turn" ? <Text modifiers={[font({ weight: "semibold", size: 14 }), foregroundStyle(island.text)]}>{p.score}</Text> : null}
        </HStack>
      </VStack>
    ),
  };
};

export default createLiveActivity("MatchActivity", MatchActivity);
