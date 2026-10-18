// Football Quiz online (qz:*; Bilgi Yarışı, up to 5 players). The creator's phone deals the
// questions (generated from the shared data by src/lib/quiz.ts, answers included). The server keeps
// the answers to itself until the reveal, runs the clock and the scoring, and keeps levels and
// standings per install id. Random rooms fill up with house players (nicknames, human-ish timing)
// when not enough people are searching. Not in server.js's GAMES (not a two-player room); server.js
// calls attach() for every socket and sweep() once a minute.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { recordResult } = require("../server-accounts");
const { refForSocket, shownNick } = require("../server-refs");
const { tellElo, codeFor, cleanNick, cleanTier, tierGap, seatRef, seatNick, qzNick } = require("../server-core");

const QZ_MAX = 5;
const QZ_INTRO_MS = 2000;
const QZ_REVEAL_MS = 3000;
/** the phones animate the old options out and the new ones in before the clock runs */
const QZ_GAP_MS = 900;
/** an open random room starts this long after it was opened */
const QZ_FILL_MS = 8_000;
/** code -> quiz room */
const qzRooms = new Map();
/** open random rooms, "difficulty:tier" -> code: players meet others on the same quiz level and rank */
const qzOpen = {};
const qzLevelOf = (d) => (d === "easy" || d === "hard" ? d : "normal");

/** Same rule as quizPoints in src/lib/quiz.ts: 10 when instant, 5 at the buzzer. */
function qzPoints(ms, limit) {
  const left = Math.max(0, Math.min(1, 1 - ms / limit));
  return Math.round(5 + 5 * left);
}

/** A {tr, en} pair of short strings: questions come from a phone and go to other phones. */
const qzText = (l, max) => l && typeof l.tr === "string" && typeof l.en === "string" && l.tr.length <= max && l.en.length <= max;

function qzValidQuestions(qs) {
  return (
    Array.isArray(qs) &&
    qs.length >= 1 &&
    qs.length <= 20 &&
    qs.every(
      (q) =>
        q &&
        qzText(q.text, 200) &&
        (q.context == null || qzText(q.context, 200)) &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        q.options.every((o) => qzText(o, 80)) &&
        // "who has more" questions carry each option's number, shown at the reveal
        (q.values == null || (Array.isArray(q.values) && q.values.length === 4 && q.values.every((v) => qzText(v, 24)))) &&
        Number.isInteger(q.answer) &&
        q.answer >= 0 &&
        q.answer < 4
    )
  );
}

function qzSettings(s) {
  const seconds = [10, 15, 20].includes(Number(s?.seconds)) ? Number(s.seconds) : 15;
  const maxPlayers = Math.max(2, Math.min(QZ_MAX, Number(s?.maxPlayers) || QZ_MAX));
  const category = ["mixed", "players", "matches"].includes(s?.category) ? s.category : "mixed";
  const difficulty = qzLevelOf(s?.difficulty);
  return { seconds, maxPlayers, category, difficulty };
}

/** `viewer`: once they've answered, they see what the others picked (like the answers landing live). */
function qzPublic(room, viewer) {
  const q = room.questions[room.index];
  const showQ = room.phase === "question" || room.phase === "reveal";
  const reveal = room.phase === "reveal" || room.phase === "done";
  return {
    code: room.code,
    random: room.random,
    hostId: room.hostId,
    settings: room.settings,
    phase: room.phase,
    index: room.index,
    total: room.questions.length,
    question: showQ ? { text: q.text, context: q.context ?? null, options: q.options } : null,
    answer: room.phase === "reveal" ? q.answer : null,
    // the numbers would give the answer away: only with it
    values: room.phase === "reveal" && q?.values ? q.values : null,
    remainingMs: room.deadline ? Math.max(0, room.deadline - Date.now()) : 0,
    // a random room still filling up: how long until it starts anyway (the search screen's countdown ring)
    startsInMs: room.random && room.phase === "lobby" && room.fillAt ? Math.max(0, room.fillAt - Date.now()) : null,
    players: room.players.map((p) => ({
      id: p.id,
      ref: seatRef(p),
      nick: seatNick(p),
      score: p.score,
      // 50/50 left for this player (the viewer reads its own)
      fifty: p.id === viewer ? (p.fifty ?? 1) : undefined,
      answered: room.answers.has(p.id),
      choice: reveal || (viewer && room.answers.has(viewer)) || p.id === viewer ? (room.answers.get(p.id)?.choice ?? null) : null,
      gained: reveal ? (p.gained ?? 0) : 0,
    })),
  };
}

// ── Quiz levels and standings ─────────────────────────────────────────────
// Each phone sends a random player id (no accounts). The server keeps XP and
// points per id in a JSON file, so the numbers can't be edited on the phone.
// House players never get a record: the standings are people only.
const QZ_STATS_FILE = process.env.QZ_STATS_FILE || path.join(__dirname, "..", "data", "quiz-stats.json");
/** pid -> { nick, xp, points, games, wins, week, weekXp } */
let qzStats = {};
try {
  qzStats = JSON.parse(fs.readFileSync(QZ_STATS_FILE, "utf8"));
} catch {}
let qzSaveTimer = null;
function qzSaveStats() {
  clearTimeout(qzSaveTimer);
  qzSaveTimer = setTimeout(() => {
    fs.mkdirSync(path.dirname(QZ_STATS_FILE), { recursive: true });
    fs.writeFile(QZ_STATS_FILE, JSON.stringify(qzStats), () => {});
  }, 1000);
}

/** Weeks start on Monday (UTC). */
const qzWeek = () => Math.floor((Date.now() / 86_400_000 + 3) / 7);

/** Level from total XP: level 2 at 100 XP, each next level needs 50 more than the last. */
function qzLevel(xp) {
  let level = 1;
  let need = 100;
  let into = xp;
  while (into >= need) {
    into -= need;
    level++;
    need = 100 + (level - 1) * 50;
  }
  return { level, into, need };
}

/** XP for one finished game: the points scored, a finishing bonus and a bonus for the podium. */
const QZ_PLACE_XP = [30, 20, 10, 5, 0];
function qzGameXp(points, place, players) {
  return points + 10 + (players > 1 ? QZ_PLACE_XP[place] ?? 0 : 0);
}

function qzProfile(pid) {
  const st = qzStats[pid];
  if (!st) return { level: 1, into: 0, need: 100, xp: 0, points: 0, games: 0, wins: 0 };
  return { ...qzLevel(st.xp), xp: st.xp, points: st.points, games: st.games, wins: st.wins };
}

const qzValidPid = (pid) => typeof pid === "string" && /^[a-z0-9]{8,40}$/i.test(pid);

/** Rooms nobody (but house players) is connected to any more are cleared, timers included. */
function sweep(alive) {
  for (const [code, room] of qzRooms) {
    if (room.players.some((p) => !p.bot && alive(p.id))) continue;
    clearTimeout(room.timer);
    room.botTimers.forEach(clearTimeout);
    qzRooms.delete(code);
    for (const d of Object.keys(qzOpen)) if (qzOpen[d] === code) qzOpen[d] = null;
  }
}

/** This socket's qz:* handlers; `ctx.io` is the Socket.IO server. */
function attach(socket, ctx) {
  const { io } = ctx;
  const qzEmit = (room) => {
    for (const p of room.players) if (!p.bot) io.sockets.sockets.get(p.id)?.emit("qz:update", qzPublic(room, p.id));
  };
  const qzClear = (room) => {
    clearTimeout(room.timer);
    room.botTimers.forEach(clearTimeout);
    room.botTimers = [];
  };
  const qzHumans = (room) => room.players.filter((p) => !p.bot);

  const qzReveal = (room) => {
    if (room.phase !== "question") return;
    qzClear(room);
    const q = room.questions[room.index];
    const limit = room.settings.seconds * 1000;
    for (const p of room.players) {
      const a = room.answers.get(p.id);
      p.gained = a && a.choice === q.answer ? qzPoints(a.ms, limit) : 0;
      p.score += p.gained;
    }
    room.phase = "reveal";
    room.deadline = Date.now() + QZ_REVEAL_MS;
    room.timer = setTimeout(() => qzNext(room), QZ_REVEAL_MS);
    qzEmit(room);
  };

  const qzNext = (room) => {
    qzClear(room);
    room.index++;
    room.answers = new Map();
    if (room.index >= room.questions.length) {
      room.phase = "done";
      room.deadline = null;
      qzAward(room);
      return qzEmit(room);
    }
    const limit = room.settings.seconds * 1000;
    room.phase = "question";
    room.qStart = Date.now() + QZ_GAP_MS;
    room.deadline = room.qStart + limit;
    room.timer = setTimeout(() => qzReveal(room), limit + QZ_GAP_MS);
    // house players answer like people: a few seconds in, right most of the time
    const q = room.questions[room.index];
    for (const p of room.players.filter((x) => x.bot)) {
      if (Math.random() < 0.05) continue; // now and then they run out of time
      const ms = QZ_GAP_MS + 2500 + Math.random() * (limit - 3500);
      room.botTimers.push(
        setTimeout(() => {
          const wrong = [0, 1, 2, 3].filter((i) => i !== q.answer);
          const choice = Math.random() < p.skill ? q.answer : wrong[Math.floor(Math.random() * 3)];
          qzAnswer(room, p.id, choice);
        }, ms)
      );
    }
    qzEmit(room);
  };

  const qzBegin = (room) => {
    qzClear(room);
    for (const d of Object.keys(qzOpen)) if (qzOpen[d] === room.code) qzOpen[d] = null;
    for (const p of room.players) {
      p.score = 0;
      p.gained = 0;
      // one 50/50 per player per match (house players don't use theirs)
      p.fifty = 1;
      p.fiftyAt = -1;
    }
    room.index = -1;
    room.answers = new Map();
    room.phase = "intro";
    room.deadline = Date.now() + QZ_INTRO_MS;
    room.timer = setTimeout(() => qzNext(room), QZ_INTRO_MS);
    qzEmit(room);
  };

  const qzAnswer = (room, id, choice) => {
    if (room.phase !== "question" || room.answers.has(id) || !room.players.some((p) => p.id === id)) return;
    if (!Number.isInteger(choice) || choice < 0 || choice > 3) return;
    room.answers.set(id, { choice, ms: Math.max(0, Date.now() - room.qStart) });
    if (room.players.every((p) => room.answers.has(p.id))) {
      clearTimeout(room.timer);
      room.timer = setTimeout(() => qzReveal(room), 500);
    }
    qzEmit(room);
  };

  const qzAddBot = (room) => {
    if (room.phase !== "lobby" || room.players.length >= room.settings.maxPlayers) return;
    room.players.push({ id: "p" + Math.random().toString(36).slice(2, 10), ref: crypto.randomBytes(8).toString("hex"), nick: qzNick(), score: 0, bot: true, skill: 0.45 + Math.random() * 0.3 });
    qzEmit(room);
  };

  const qzNewRoom = (socket, nick, settings, questions, random) => {
    const code = codeFor(qzRooms);
    const room = {
      code,
      random,
      hostId: socket.id,
      settings,
      questions,
      phase: "lobby",
      index: -1,
      answers: new Map(),
      deadline: null,
      timer: null,
      botTimers: [],
      players: [{ id: socket.id, uid: socket.data.uid, pid: socket.data.qzPid, nick: cleanNick(nick), score: 0 }],
    };
    qzRooms.set(code, room);
    socket.data.qzCode = code;
    socket.join("qz:" + code);
    return room;
  };

  const qzLeave = () => {
    const room = qzRooms.get(socket.data.qzCode);
    socket.leave("qz:" + socket.data.qzCode);
    socket.data.qzCode = null;
    if (!room) return;
    room.players = room.players.filter((p) => p.id !== socket.id);
    room.answers.delete(socket.id);
    if (!qzHumans(room).length) {
      qzClear(room);
      qzRooms.delete(room.code);
      for (const d of Object.keys(qzOpen)) if (qzOpen[d] === room.code) qzOpen[d] = null;
      return;
    }
    if (room.hostId === socket.id) room.hostId = qzHumans(room)[0].id;
    if (room.phase === "question" && room.players.every((p) => room.answers.has(p.id))) qzReveal(room);
    else qzEmit(room);
  };

  socket.on("qz:create", ({ pid, nick, settings, questions }, cb) => {
    if (qzValidPid(pid)) socket.data.qzPid = pid;
    if (!qzValidQuestions(questions)) return cb?.({ ok: false, error: "bad_questions" });
    if (socket.data.qzCode) qzLeave();
    const room = qzNewRoom(socket, nick, qzSettings(settings), questions, false);
    cb?.({ ok: true, room: qzPublic(room) });
  });

  socket.on("qz:join", ({ code, pid, nick }, cb) => {
    if (qzValidPid(pid)) socket.data.qzPid = pid;
    const room = qzRooms.get(String(code || "").toUpperCase());
    if (!room) return cb?.({ ok: false, error: "not_found" });
    if (room.players.some((p) => p.id === socket.id)) return cb?.({ ok: true, room: qzPublic(room) });
    if (room.phase !== "lobby") return cb?.({ ok: false, error: "started" });
    if (room.players.length >= room.settings.maxPlayers) return cb?.({ ok: false, error: "full" });
    if (socket.data.qzCode) qzLeave();
    room.players.push({ id: socket.id, uid: socket.data.uid, pid: socket.data.qzPid, nick: cleanNick(nick), score: 0 });
    socket.data.qzCode = room.code;
    socket.join("qz:" + room.code);
    cb?.({ ok: true, room: qzPublic(room) });
    qzEmit(room);
    if (room.random && room.players.length >= room.settings.maxPlayers) qzBegin(room);
  });

  // Random: join the open room, or open one that starts after QZ_FILL_MS
  socket.on("qz:queue", ({ pid, nick, questions, difficulty, tier }, cb) => {
    const level = qzLevelOf(difficulty);
    const myTier = cleanTier(tier);
    if (qzValidPid(pid)) socket.data.qzPid = pid;
    if (!qzValidQuestions(questions)) return cb?.({ ok: false, error: "bad_questions" });
    if (socket.data.qzCode) qzLeave();
    // the open room of this level whose rank is closest, if its age allows the gap
    let open = null;
    for (const [key, code] of Object.entries(qzOpen)) {
      const room = code && qzRooms.get(code);
      if (!room || !key.startsWith(level + ":") || room.phase !== "lobby" || room.players.length >= room.settings.maxPlayers) continue;
      if (room.players.some((p) => { const r = seatRef(p); return socket.data.blocks?.has(r) || io.sockets.sockets.get(p.id)?.data.blocks?.has(socket.data.ref); })) continue;
      const gap = Math.abs(room.tier - myTier);
      if (gap <= tierGap(room.fillAt - QZ_FILL_MS) && (!open || gap < Math.abs(open.tier - myTier))) open = room;
    }
    if (open) {
      open.players.push({ id: socket.id, uid: socket.data.uid, pid: socket.data.qzPid, nick: cleanNick(nick), score: 0 });
      socket.data.qzCode = open.code;
      socket.join("qz:" + open.code);
      cb?.({ ok: true, code: open.code });
      qzEmit(open);
      if (open.players.length >= open.settings.maxPlayers) qzBegin(open);
      return;
    }
    const room = qzNewRoom(socket, nick, qzSettings({ difficulty: level }), questions, true);
    room.tier = myTier;
    qzOpen[`${level}:${myTier}`] = room.code;
    // a few others "find" the room while it waits
    const joins = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < joins; i++) room.botTimers.push(setTimeout(() => qzAddBot(room), 1500 + Math.random() * (QZ_FILL_MS - 3000)));
    room.timer = setTimeout(() => {
      if (room.phase !== "lobby") return;
      while (room.players.length < 2) qzAddBot(room);
      qzBegin(room);
    }, QZ_FILL_MS);
    room.fillAt = Date.now() + QZ_FILL_MS;
    cb?.({ ok: true, code: room.code });
  });

  // Full time: XP and points for every person in the room, then each one hears how they did
  const qzAward = (room) => {
    const standings = [...room.players].sort((a, b) => b.score - a.score);
    const week = qzWeek();
    for (const p of room.players) {
      if (p.bot || !p.pid) continue;
      const place = standings.indexOf(p);
      const gained = qzGameXp(p.score, place, room.players.length);
      const before = qzProfile(p.pid);
      const st = (qzStats[p.pid] ??= { nick: "", xp: 0, points: 0, games: 0, wins: 0, week, weekXp: 0 });
      if (st.week !== week) {
        st.week = week;
        st.weekXp = 0;
      }
      st.nick = p.nick || st.nick;
      st.xp += gained;
      st.weekXp += gained;
      st.points += p.score;
      st.games++;
      if (place === 0 && room.players.length > 1) st.wins++;
      const after = qzProfile(p.pid);
      io.sockets.sockets.get(p.id)?.emit("qz:progress", { gained, before, after });
    }
    qzSaveStats();
    // rating: signed-in people only, ranked by score (house players don't count)
    const rated = standings.filter((p) => !p.bot && p.uid);
    const places = [];
    for (const p of rated) {
      const last = places[places.length - 1];
      if (last && last.score === p.score) last.ids.push(p.uid);
      else places.push({ score: p.score, ids: [p.uid] });
    }
    tellElo("qz", rated, recordResult("qz", places.map((x) => x.ids)));
  };

  // "Delete my data" in the app: drop this player's quiz record for good
  socket.on("qz:forget", ({ pid } = {}, cb) => {
    if (!qzValidPid(pid)) return cb?.({ ok: false });
    delete qzStats[pid];
    qzSaveStats();
    cb?.({ ok: true });
  });

  socket.on("qz:profile", ({ pid } = {}, cb) => {
    if (!qzValidPid(pid)) return cb?.({ ok: false });
    cb?.({ ok: true, profile: qzProfile(pid) });
  });

  // Standings: people only, all time (by XP) or this week (XP earned this week)
  socket.on("qz:standings", ({ pid, period } = {}, cb) => {
    const week = qzWeek();
    const weekly = period === "week";
    const rows = Object.entries(qzStats)
      .map(([id, st]) => ({ id, nick: st.nick || "?", level: qzLevel(st.xp).level, xp: weekly ? (st.week === week ? st.weekXp : 0) : st.xp, points: st.points, wins: st.wins }))
      .filter((r) => r.xp > 0)
      .sort((a, b) => b.xp - a.xp);
    const mine = rows.findIndex((r) => r.id === pid);
    // the install id never leaves the server: rows carry its ref (report / block) instead
    const strip = ({ id, ...r }, i) => {
      const ref = refForSocket(null, id);
      return { ...r, ref, nick: shownNick(ref, r.nick), rank: i + 1, me: id === pid };
    };
    cb?.({ ok: true, top: rows.slice(0, 50).map(strip), me: mine >= 0 ? strip(rows[mine], mine) : null, total: rows.length });
  });

  socket.on("qz:start", () => {
    const room = qzRooms.get(socket.data.qzCode);
    if (!room || room.hostId !== socket.id || room.phase !== "lobby" || room.players.length < 2) return;
    qzBegin(room);
  });

  // 50/50: two wrong options go, for this player only (the server alone knows the answer)
  socket.on("qz:joker", ({ kind }, cb) => {
    const room = qzRooms.get(socket.data.qzCode);
    const me = room?.players.find((p) => p.id === socket.id);
    if (!room || !me || kind !== "fifty" || room.phase !== "question" || room.answers.has(me.id) || !(me.fifty > 0)) return cb?.({ ok: false });
    const q = room.questions[room.index];
    const wrong = [0, 1, 2, 3].filter((i) => i !== q.answer);
    const keep = wrong[Math.floor(Math.random() * 3)];
    me.fifty--;
    me.fiftyAt = room.index;
    cb?.({ ok: true, index: room.index, remove: wrong.filter((i) => i !== keep) });
  });

  socket.on("qz:answer", ({ choice }) => {
    const room = qzRooms.get(socket.data.qzCode);
    if (room) qzAnswer(room, socket.id, Number(choice));
  });

  // Same people, new questions (from the host's phone)
  socket.on("qz:rematch", ({ questions }) => {
    const room = qzRooms.get(socket.data.qzCode);
    if (!room || room.hostId !== socket.id || room.phase !== "done" || !qzValidQuestions(questions)) return;
    room.questions = questions;
    qzBegin(room);
  });

  socket.on("qz:leave", qzLeave);
  socket.on("disconnect", qzLeave);
}

module.exports = { id: "qz", rooms: qzRooms, attach, sweep };
