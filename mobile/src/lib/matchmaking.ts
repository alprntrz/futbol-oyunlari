/**
 * How long a random-opponent search waits for a real player before the house player steps in:
 * a few seconds, a bit different each time so it doesn't feel timed. A real player who is already
 * searching is paired at once (server.js matchQueues), so this only matters when nobody is.
 */
export const houseAfterMs = () => 3_000 + Math.floor(Math.random() * 3_000);
