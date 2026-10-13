import { HStack, Image, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import { font, foregroundStyle, frame, lineLimit, monospacedDigit, padding } from "@expo/ui/swift-ui/modifiers";
import { createLiveActivity, type LiveActivityEnvironment } from "expo-widgets";

/**
 * Everything the Live Activity shows, already in the player's language (the
 * widget runtime can't reach the app's strings). Times are ms since epoch.
 */
export type MatchActivityProps = {
  /** "Tic-Tac-Toe" / "Possession Play" */
  game: string;
  /** "Your turn" / "Kartal34 is thinking" / "Looking for an opponent" / "You won!" */
  headline: string;
  /** colour of the headline (the mover's colour) */
  color: string;
  /** "Yukifc10 vs Kartal34", or a hint while searching */
  line: string;
  /** "X 1 – 2 O", empty while searching */
  score: string;
  /** this phone's mark, shown in the compact island ("X" / "O" / "") */
  mark: string;
  markColor: string;
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
 * background; anything else changes only when the app sends an update.
 */
const MatchActivity = (p: MatchActivityProps, env: LiveActivityEnvironment) => {
  "widget";
  const dim = env.isLuminanceReduced;
  const accent = dim ? "#FFFFFF" : p.color;
  const clock =
    p.phase === "turn" && p.endsAt > p.since ? (
      <Text timerInterval={{ lower: new Date(p.since), upper: new Date(p.endsAt) }} countsDown modifiers={[monospacedDigit(), font({ weight: "heavy", size: 30, design: "rounded" })]} />
    ) : p.phase === "search" ? (
      <Text timerInterval={{ lower: new Date(p.since), upper: new Date(p.since + 3600000) }} countsDown={false} modifiers={[monospacedDigit(), font({ weight: "heavy", size: 30, design: "rounded" })]} />
    ) : (
      <Text modifiers={[font({ weight: "heavy", size: 26, design: "rounded" })]}>{p.score}</Text>
    );
  const smallClock =
    p.phase === "turn" && p.endsAt > p.since ? (
      <Text timerInterval={{ lower: new Date(p.since), upper: new Date(p.endsAt) }} countsDown modifiers={[monospacedDigit(), font({ weight: "bold", size: 15 }), foregroundStyle(accent), frame({ maxWidth: 46 })]} />
    ) : p.phase === "search" ? (
      <Image systemName="magnifyingglass" color={accent} />
    ) : (
      <Text modifiers={[font({ weight: "bold", size: 14 }), foregroundStyle(accent)]}>{p.score}</Text>
    );
  const markView = p.mark ? (
    <Text modifiers={[font({ weight: "black", size: 16, design: "rounded" }), foregroundStyle(dim ? "#FFFFFF" : p.markColor)]}>{p.mark}</Text>
  ) : (
    <Image systemName="soccerball" color={accent} />
  );

  return {
    banner: (
      <HStack modifiers={[padding({ all: 16 })]}>
        <VStack alignment="leading" spacing={3}>
          <Text modifiers={[font({ weight: "semibold", size: 13 }), foregroundStyle("#8A948E")]}>{p.game}</Text>
          <Text modifiers={[font({ weight: "heavy", size: 21 }), foregroundStyle(accent), lineLimit(1)]}>{p.headline}</Text>
          <Text modifiers={[font({ size: 14 }), lineLimit(1)]}>{p.line}</Text>
        </VStack>
        <Spacer />
        <VStack alignment="trailing" spacing={2}>
          {clock}
          {p.phase === "turn" ? <Text modifiers={[font({ weight: "semibold", size: 14 })]}>{p.score}</Text> : null}
        </VStack>
      </HStack>
    ),
    compactLeading: markView,
    compactTrailing: smallClock,
    minimal: markView,
    expandedLeading: (
      <VStack alignment="leading" spacing={2} modifiers={[padding({ leading: 6 })]}>
        <Image systemName="soccerball" color={accent} />
        <Text modifiers={[font({ weight: "semibold", size: 12 }), foregroundStyle("#A7B0AA")]}>{p.game}</Text>
      </VStack>
    ),
    expandedTrailing: <VStack modifiers={[padding({ trailing: 6 })]}>{clock}</VStack>,
    expandedBottom: (
      <VStack alignment="leading" spacing={2} modifiers={[padding({ horizontal: 8, bottom: 6 })]}>
        <Text modifiers={[font({ weight: "heavy", size: 19 }), foregroundStyle(accent), lineLimit(1)]}>{p.headline}</Text>
        <HStack>
          <Text modifiers={[font({ size: 14 }), lineLimit(1)]}>{p.line}</Text>
          <Spacer />
          {p.phase === "turn" ? <Text modifiers={[font({ weight: "semibold", size: 14 })]}>{p.score}</Text> : null}
        </HStack>
      </VStack>
    ),
  };
};

export default createLiveActivity("MatchActivity", MatchActivity);
