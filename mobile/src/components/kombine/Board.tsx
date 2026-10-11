import { memo, useEffect, useRef, useState } from "react";
import { StyleSheet, View, type GestureResponderEvent } from "react-native";
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withSequence, withTiming, ZoomOut } from "react-native-reanimated";

import { Text } from "~/components/Text";
import { Icon } from "~/components/ui";
import { haptic } from "~/lib/haptics";
import { adjacent, swap, type Game, type Grid, type Phase, type Pos, type Tile } from "~/lib/kombine/engine";
import { TILE_LOOK } from "~/lib/kombine/look";
import { F } from "~/lib/theme";

const GAP = 3;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The Kombine board: draws the grid, takes swipes (or tap + tap) and plays a
 * turn's phases one after another. The engine has already decided the turn;
 * this only animates it.
 */
/** Give it a new `key` for a new game: the board keeps its own animation state. */
export function Board({ game, width, disabled, onTurn }: { game: Game; width: number; disabled: boolean; onTurn: () => void }) {
  const size = (width - GAP) / game.cols;
  const [grid, setGrid] = useState<Grid>(game.grid);
  const [spawn, setSpawn] = useState<Record<number, number>>({});
  const [mud, setMud] = useState(() => game.mud.map((r) => r.slice()));
  const [selected, setSelected] = useState<Pos | null>(null);
  const [busy, setBusy] = useState(false);
  const [flashes, setFlashes] = useState<{ id: number; pos: Pos }[]>([]);
  const [combo, setCombo] = useState<{ id: number; n: number } | null>(null);
  const flashId = useRef(0);

  const play = async (phases: Phase[]) => {
    setBusy(true);
    setSelected(null);
    let clears = 0;
    for (const ph of phases) {
      if (ph.kind === "fall") setSpawn(ph.spawned);
      setGrid(ph.grid);
      if (ph.kind === "swap" || ph.kind === "unswap") {
        if (ph.kind === "unswap") haptic.error();
        await wait(170);
      } else if (ph.kind === "clear") {
        clears++;
        haptic.press();
        setMud((m) => {
          const next = m.map((r) => r.slice());
          ph.cleared.forEach(({ pos }) => (next[pos.r][pos.c] = false));
          return next;
        });
        if (ph.blasts.length) setFlashes(ph.blasts.map((pos) => ({ id: flashId.current++, pos })));
        if (clears >= 2) setCombo({ id: flashId.current++, n: clears });
        await wait(190);
      } else if (ph.kind === "fall") {
        const drop = Math.max(1, ...Object.values(ph.spawned).map((r) => -r));
        await wait(Math.min(420, 140 + drop * 45));
      } else if (ph.kind === "goal") {
        haptic.success();
        await wait(320);
      } else await wait(450);
    }
    setFlashes([]);
    setBusy(false);
    onTurn();
  };

  const trySwap = (a: Pos, b: Pos) => {
    if (busy || disabled || !adjacent(a, b)) return;
    const phases = swap(game, a, b);
    if (phases.length) play(phases);
  };

  // Swipe from a tile, or tap one tile then a neighbour
  const start = useRef<Pos | null>(null);
  const fired = useRef(false);
  const cellAt = (x: number, y: number): Pos | null => {
    const c = Math.floor(x / size);
    const r = Math.floor(y / size);
    return r >= 0 && c >= 0 && r < game.rows && c < game.cols ? { r, c } : null;
  };
  const origin = useRef({ x: 0, y: 0 });
  const responder = {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderGrant: (e: GestureResponderEvent) => {
      start.current = cellAt(e.nativeEvent.locationX, e.nativeEvent.locationY);
      origin.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
      fired.current = false;
    },
    onResponderMove: (e: GestureResponderEvent) => {
      const from = start.current;
      if (!from || fired.current) return;
      const dx = e.nativeEvent.pageX - origin.current.x;
      const dy = e.nativeEvent.pageY - origin.current.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 14) return;
      fired.current = true;
      const to = Math.abs(dx) > Math.abs(dy) ? { r: from.r, c: from.c + Math.sign(dx) } : { r: from.r + Math.sign(dy), c: from.c };
      trySwap(from, to);
    },
    onResponderRelease: () => {
      const p = start.current;
      if (fired.current || !p) return;
      if (selected && adjacent(selected, p)) trySwap(selected, p);
      else if (selected && selected.r === p.r && selected.c === p.c) setSelected(null);
      else {
        haptic.tap();
        setSelected(p);
      }
    },
  };

  const tiles: { tile: Tile; r: number; c: number }[] = [];
  grid.forEach((row, r) => row.forEach((t, c) => t && tiles.push({ tile: t, r, c })));

  return (
    <View style={[styles.board, { width, height: size * game.rows + GAP }]} {...responder}>
      {/* pitch cells */}
      {mud.map((row, r) =>
        row.map((_, c) => (
          <View
            key={`${r}-${c}`}
            pointerEvents="none"
            style={[styles.cell, { left: c * size + GAP, top: r * size + GAP, width: size - GAP, height: size - GAP }, (r + c) % 2 === 0 && styles.cellAlt]}
          />
        ))
      )}
      {/* the goal line under the bottom row */}
      <View pointerEvents="none" style={[styles.goalLine, { top: size * game.rows - 1 }]} />
      {selected && (
        <View pointerEvents="none" style={[styles.selected, { left: selected.c * size + GAP - 2, top: selected.r * size + GAP - 2, width: size - GAP + 4, height: size - GAP + 4 }]} />
      )}
      {tiles.map(({ tile, r, c }) => (
        <TileView key={tile.id} tile={tile} r={r} c={c} size={size} from={spawn[tile.id]} />
      ))}
      {/* mud sits over its tiles as a frame, so you can see what still needs clearing */}
      {mud.map((row, r) =>
        row.map((m, c) =>
          m ? (
            <Animated.View
              key={`mud-${r}-${c}`}
              pointerEvents="none"
              exiting={FadeOut.duration(200)}
              style={[styles.mud, { left: c * size + GAP - 1, top: r * size + GAP - 1, width: size - GAP + 2, height: size - GAP + 2 }]}
            />
          ) : null
        )
      )}
      {flashes.map((f) => (
        <Animated.View
          key={f.id}
          pointerEvents="none"
          entering={FadeIn.duration(60)}
          exiting={FadeOut.duration(220)}
          style={[styles.flash, { left: f.pos.c * size - size * 0.5, top: f.pos.r * size - size * 0.5, width: size * 2, height: size * 2, borderRadius: size }]}
        />
      ))}
      {combo && <Combo key={combo.id} n={combo.n} />}
    </View>
  );
}

/** "Kombo ×3" over the board for chain reactions. */
function Combo({ n }: { n: number }) {
  const o = useSharedValue(0);
  useEffect(() => {
    o.set(withSequence(withTiming(1, { duration: 120 }), withTiming(1, { duration: 500 }), withTiming(0, { duration: 250 })));
  }, [o]);
  const style = useAnimatedStyle(() => ({ opacity: o.get(), transform: [{ scale: 0.9 + o.get() * 0.1 }] }));
  return (
    <Animated.View pointerEvents="none" style={[styles.combo, style]}>
      <Text style={styles.comboText}>KOMBO ×{n}</Text>
    </Animated.View>
  );
}

const TileView = memo(function TileView({ tile, r, c, size, from }: { tile: Tile; r: number; c: number; size: number; from?: number }) {
  const x = useSharedValue(c * size);
  const y = useSharedValue((from ?? r) * size);
  useEffect(() => {
    const rows = Math.abs(y.get() / size - r);
    x.set(withTiming(c * size, { duration: 150, easing: Easing.out(Easing.quad) }));
    y.set(withTiming(r * size, { duration: Math.min(380, 110 + rows * 45), easing: Easing.out(Easing.cubic) }));
  }, [r, c, size, x, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }, { translateY: y.get() }] }));

  const inner = size - GAP - 2;
  return (
    <Animated.View pointerEvents="none" exiting={ZoomOut.duration(170)} style={[styles.tileWrap, { width: size, height: size }, style]}>
      <TileFace tile={tile} size={inner} />
    </Animated.View>
  );
});

export function TileFace({ tile, size }: { tile: Tile; size: number }) {
  if (tile.ball)
    return (
      <View style={[styles.face, { width: size, height: size, borderRadius: size / 2, backgroundColor: "white", borderColor: "#1B2430", borderWidth: 2 }]}>
        <Icon name="soccerball" size={size * 0.78} color="#1B2430" fallback="⚽" />
      </View>
    );
  if (tile.special === "color")
    return (
      <View style={[styles.face, { width: size, height: size, borderRadius: size * 0.28, backgroundColor: "#1B2430" }]}>
        <Icon name="star.fill" size={size * 0.55} color="#FFD34D" fallback="★" />
      </View>
    );
  const look = TILE_LOOK[tile.color];
  return (
    <View style={[styles.face, { width: size, height: size, borderRadius: size * 0.28, backgroundColor: look.bottom }]}>
      <View style={[StyleSheet.absoluteFill, { margin: 2, marginBottom: 4, borderRadius: size * 0.24, backgroundColor: look.top }]} />
      <Icon name={look.icon} size={size * 0.5} color="white" fallback={look.fallback} />
      {(tile.special === "row" || tile.special === "col") && (
        <View style={[styles.stripe, tile.special === "row" ? { height: 4, left: 3, right: 3 } : { width: 4, top: 3, bottom: 3 }]} />
      )}
      {tile.special === "bomb" && <View style={[styles.ring, { borderRadius: size * 0.28 }]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  board: { borderRadius: 18, backgroundColor: "#0F6A33", overflow: "hidden", alignSelf: "center" },
  cell: { position: "absolute", borderRadius: 9, backgroundColor: "rgba(255,255,255,0.06)" },
  cellAlt: { backgroundColor: "rgba(255,255,255,0.11)" },
  mud: { position: "absolute", borderRadius: 11, borderWidth: 4, borderColor: "#7A4A1E", backgroundColor: "rgba(122,74,30,0.28)" },
  goalLine: { position: "absolute", left: 0, right: 0, height: 3, backgroundColor: "rgba(255,255,255,0.6)" },
  selected: { position: "absolute", borderRadius: 12, borderWidth: 3, borderColor: "white" },
  tileWrap: { position: "absolute", left: GAP / 2, top: GAP / 2, alignItems: "center", justifyContent: "center" },
  face: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  stripe: { position: "absolute", backgroundColor: "white", borderRadius: 2, opacity: 0.9 },
  ring: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderWidth: 3, borderColor: "white" },
  flash: { position: "absolute", backgroundColor: "rgba(255,255,255,0.55)" },
  combo: { position: "absolute", left: 0, right: 0, top: "40%", alignItems: "center" },
  comboText: { fontFamily: F.black, fontSize: 40, color: "white", textShadowColor: "rgba(0,0,0,0.35)", textShadowRadius: 8, textShadowOffset: { width: 0, height: 2 } },
});
