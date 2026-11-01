import { router } from "expo-router";

/** Games a friend can invite into (server.js `fr:invite`). */
export type InviteGame = "ht" | "tt" | "rd" | "wm";
const GAMES = new Set<string>(["ht", "tt", "rd", "wm"]);
const ROOM = /^[A-Z0-9]{3,10}$/;

/** Checks a game + room pair that came from outside the app (a push's data). */
export function isInvite(game: unknown, room: unknown): game is InviteGame {
  return typeof game === "string" && GAMES.has(game) && typeof room === "string" && ROOM.test(room);
}

/** Open a friend's room: Tic-Tac-Toe, Rondo, Who Am I? or a Pitch Chess lobby (InviteBanner, push taps). */
export function openInvite(game: InviteGame, room: string) {
  if (game === "tt") router.push({ pathname: "/taktik/lobi", params: { code: room } });
  else if (game === "rd") router.push({ pathname: "/rondo/oda/[code]", params: { code: room } });
  else if (game === "wm") router.push({ pathname: "/kimim/oda/[code]", params: { code: room } });
  else router.push({ pathname: "/hat-trick/oda/[code]", params: { code: room } });
}
