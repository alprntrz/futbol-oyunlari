/** Nickname carried from the race lobby to the room screen (in memory). */
let nick = "";

export const setNick = (n: string) => {
  nick = n;
};
export const getNick = () => nick;
