/**
 * Shared pieces of the game server (server.js and the game modules): nicknames, rank matchmaking,
 * room codes, player refs for report / block, the house players' names and small validators.
 * Pure: no sockets of its own (a queued entry carries its socket), no timers.
 * Plan: docs/server-bolme-plani.md.
 */
const { shownNick } = require("./server-refs");

/** How long a dropped phone has to come back to a live online match. */
const REJOIN_MS = Number(process.env.REJOIN_MS) || 60_000;

// socket id → that player's ref (server-refs.js), so room views can carry it for report / block
const refById = new Map();
/** A seat as other phones see it: its ref (house players get a made-up one) and the nickname, hidden if reported enough. */
const seatRef = (p) => p.ref ?? refById.get(p.id) ?? null;
const seatNick = (p) => shownNick(seatRef(p), p.nick);
/** Either of two queued players blocked the other. */
const blockedPair = (a, b) => !!(a.socket.data.blocks?.has(b.socket.data.ref) || b.socket.data.blocks?.has(a.socket.data.ref));

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
/**
 * Nicknames are shown to strangers: strip control characters and swap anything
 * offensive (Turkish and English, matched after folding accents and leetspeak)
 * for a neutral name. App Store guideline 1.2 asks for this kind of filtering.
 */
const NICK_BLOCK = ["amk", "aq", "orospu", "orosbu", "pic", "piç", "sik", "sikis", "sikik", "yarak", "yarrak", "got", "göt", "ibne", "kahpe", "pezevenk", "amcik", "amcık", "siktir", "fuck", "shit", "bitch", "cunt", "dick", "pussy", "nigger", "nigga", "fag", "whore", "slut", "rape", "nazi", "hitler"];
function cleanNick(nick) {
  // control, zero-width and text-direction characters (a name could otherwise hide or flip text)
  const raw = String(nick || "").replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g, "").trim().slice(0, 20);
  const folded = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .replace(/0/g, "o").replace(/1/g, "i").replace(/3/g, "e").replace(/4/g, "a").replace(/5/g, "s").replace(/7/g, "t").replace(/@/g, "a").replace(/\$/g, "s")
    .replace(/[^a-z]/g, "");
  const words = raw.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i").split(/[^a-z]+/);
  // very short words only as whole words ("aq" in "aqua", "pic" in "picasso" are fine), the rest anywhere
  const bad = NICK_BLOCK.some((w) => {
    const f = w.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");
    return f.length <= 3 ? words.includes(f) : folded.includes(f);
  });
  return bad ? "player" + Math.floor(100 + Math.random() * 900) : raw;
}

/** A 5-character room code not already used in `map`. */
function codeFor(map) {
  let code = "";
  for (let i = 0; i < 5; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return map.has(code) ? codeFor(map) : code;
}

// Random opponents by rank (tier = rank index of the app's level, 0 = Amateur):
// same rank first, one rank either side after TIER_WIDEN_MS of waiting, anyone
// after twice that. The app's own house-player fallback kicks in after 3–6 s (mobile/src/lib/matchmaking.ts).
const TIER_WIDEN_MS = 1000;
const cleanTier = (t) => (Number.isInteger(t) && t >= 0 && t < 10 ? t : 0);
function tierGap(since) {
  const waited = Date.now() - since;
  return waited < TIER_WIDEN_MS ? 0 : waited < 2 * TIER_WIDEN_MS ? 1 : 99;
}

/** Pairs whoever in a queue can meet now, oldest first: { pairs: [older, newer][], rest }. */
function takePairs(queue, same = () => true) {
  const waiting = queue.filter((w) => w.socket.connected).sort((a, b) => a.since - b.since);
  const taken = new Set();
  const pairs = [];
  for (const a of waiting) {
    if (taken.has(a)) continue;
    let best = null;
    for (const b of waiting) {
      if (b === a || taken.has(b) || !same(a, b) || blockedPair(a, b)) continue;
      const gap = Math.abs(a.tier - b.tier);
      if (gap <= Math.max(tierGap(a.since), tierGap(b.since)) && (!best || gap < Math.abs(a.tier - best.tier))) best = b;
    }
    if (best) {
      taken.add(a).add(best);
      pairs.push([a, best]);
    }
  }
  return { pairs, rest: waiting.filter((w) => !taken.has(w)) };
}

/** A made-up nickname that reads like one a person picked ("lucas10", "Mateo.fc"): the house players. */
const QZ_NAMES = ["lucas", "mateo", "jonas", "luca", "liam", "noah", "oliver", "james", "jack", "harry", "ethan", "leo", "hugo", "louis", "jules", "theo", "enzo", "paul", "felix", "max", "finn", "lukas", "niklas", "matteo", "lorenzo", "marco", "giulia", "sofia", "alejandro", "diego", "pablo", "javi", "lucia", "carlos", "joao", "rafa", "tiago", "bruno", "pedro", "gabriel", "thiago", "nico", "santi", "martina", "valentina", "sven", "lars", "erik", "mats", "anders", "piotr", "kuba", "marek", "ivan", "luka", "nikola", "dmitri", "andrei", "yuki", "kenji", "minjun", "jisoo", "wei", "arjun", "rohan", "omar", "youssef", "karim", "amir", "kofi", "kwame", "chidi", "emma", "chloe", "mia", "ana", "nina", "sara", "eva"];
const QZ_TAILS = ["", "", "", "7", "9", "10", "11", "22", "23", "99", "88", "04", "12", "_fc", "_10", "_gol", "fc", "_99", "77", "14"];
function qzNick() {
  const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];
  const name = pick(QZ_NAMES);
  const cased = Math.random() < 0.4 ? name[0].toUpperCase() + name.slice(1) : name;
  const tail = pick(QZ_TAILS);
  const sep = tail && !tail.startsWith("_") && Math.random() < 0.25 ? "." : "";
  return cased + sep + tail;
}

const critId = (x) => typeof x === "string" && x.length > 0 && x.length <= 48;

/** a footballer's name as sent by a phone */
const nameOf = (v) => (typeof v === "string" ? v.trim().slice(0, 60) : "");

module.exports = { REJOIN_MS, refById, seatRef, seatNick, blockedPair, CODE_ALPHABET, codeFor, cleanNick, TIER_WIDEN_MS, cleanTier, tierGap, takePairs, qzNick, critId, nameOf };
