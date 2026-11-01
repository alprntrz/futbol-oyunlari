const ROOM = /(?:^|\/)(hat-trick|possession|rondo|kimim|bilgi|duello)\/oda\/([A-Za-z0-9]+)\/?(?:[?#]|$)/;
const LOBBY = /(?:^|\/)taktik\/lobi\/?\?(?:[^#]*&)?code=([A-Za-z0-9]+)/;

/**
 * The online room (or Pitch Chess lobby) a link or path would join, e.g. "hat-trick/oda/AB12C";
 * null for anything else. Pure (no React Native) so tests/room-link.test.mts can load it.
 */
export function roomOfLink(url: string): string | null {
  const room = ROOM.exec(url);
  if (room) return `${room[1]}/oda/${room[2].toUpperCase()}`;
  const lobby = LOBBY.exec(url);
  return lobby ? `taktik/lobi/${lobby[1].toUpperCase()}` : null;
}
