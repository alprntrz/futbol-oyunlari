import { OnlineLobby } from "~/components/OnlineLobby";

/** Rondo with a friend: open a room (the server deals the clubs) or join by code. */
export default function RondoLobby() {
  return <OnlineLobby game="rd" title="Rondo" createPayload={() => ({})} roomHref={(code) => ({ pathname: "/rondo/oda/[code]", params: { code } })} />;
}
