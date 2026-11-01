/**
 * Morning PostHog report (scripts/posthog-report.mjs): the HogQL queries for one Istanbul day and the
 * Turkish Markdown they become. Pure, no network: the CLI runs the queries and passes the rows in.
 * PostHog stores UTC; Istanbul is UTC+3 all year, so a day is 21:00 → 21:00 UTC.
 */
const TZ_HOURS = 3;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const WEEK_DAYS = 7;
const TOP_SCREENS = 12;

const GAME_NAMES = {
  xi: "Eksik 11",
  ht: "Tic-Tac-Toe",
  qz: "Bilgi Yarışı",
  mystery: "Gizli Oyuncu",
  bingo: "Bingo",
  pp: "Possession",
  tt: "Taktik Tahtası",
  dz: "Kart Düellosu",
  rd: "Rondo",
  wm: "Ben Kimim?",
  kosu: "Dribbling Rush",
  // builds 25 and older sent Dribbling Rush runs as the XP source
  bonus: "Dribbling Rush",
};

const sqlTime = (ms) => new Date(ms).toISOString().slice(0, 19).replace("T", " ");

/** The Istanbul day that ended most recently before `now`, as UTC bounds for HogQL. */
export function reportDay(now = new Date()) {
  const localMidnight = Math.floor((now.getTime() + TZ_HOURS * HOUR_MS) / DAY_MS) * DAY_MS;
  const start = localMidnight - DAY_MS - TZ_HOURS * HOUR_MS;
  return {
    day: new Date(localMidnight - DAY_MS).toISOString().slice(0, 10),
    from: sqlTime(start),
    to: sqlTime(start + DAY_MS),
    weekFrom: sqlTime(start - (WEEK_DAYS - 1) * DAY_MS),
  };
}

/** HogQL per report section; each returns plain rows (arrays). */
export function reportQueries({ day, from, to, weekFrom }) {
  const localDay = `toDate(timestamp + interval ${TZ_HOURS} hour)`;
  const yesterday = `timestamp >= toDateTime('${from}') and timestamp < toDateTime('${to}')`;
  const firstDays = `select distinct_id, min(${localDay}) as first_day, groupUniqArray(${localDay}) as days from events group by distinct_id`;
  return {
    daily: `select ${localDay} as d, count(distinct distinct_id), countIf(event = 'Application Installed'),
      count(distinct properties.$session_id), countIf(event = 'game_finished')
      from events where timestamp >= toDateTime('${weekFrom}') and timestamp < toDateTime('${to}') group by d order by d`,
    games: `select properties.game as g, properties.practice as p, count() as c from events
      where event = 'game_finished' and ${yesterday} group by g, p order by c desc`,
    screens: `select properties.$screen_name as s, count(distinct distinct_id) as n, count() as c from events
      where event = '$screen' and ${yesterday} group by s order by n desc, c desc limit ${TOP_SCREENS}`,
    events: `select event, toString(coalesce(properties.provider, properties.granted, properties.game, '')) as v, count()
      from events where event in ('onboarding_done', 'signed_in', 'share_tapped', 'push_permission') and ${yesterday}
      group by event, v order by event, v`,
    versions: `select properties.$app_version as v, properties.$app_build as b, properties.$os as os, count(distinct distinct_id) as n
      from events where ${yesterday} group by v, b, os order by n desc`,
    retention: `select first_day, count(), countIf(has(days, addDays(first_day, 1))) from (${firstDays})
      where first_day >= toDate('${weekFrom.slice(0, 10)}') and first_day < toDate('${day}') group by first_day order by first_day`,
    newScreens: `select properties.$screen_name as s, count(distinct distinct_id) as n from events
      where event = '$screen' and ${yesterday}
      and distinct_id in (select distinct_id from (${firstDays}) where first_day = toDate('${day}'))
      group by s order by n desc limit ${TOP_SCREENS}`,
  };
}

const table = (head, rows) =>
  [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");
const pct = (part, whole) => (whole ? `%${Math.round((100 * part) / whole)}` : "–");
const isPractice = (p) => p === true || p === "true";

/** [game name, normal, practice] per game, most played first */
function gameRows(games) {
  const totals = games.reduce((acc, [g, practice, c]) => {
    const name = GAME_NAMES[g] ?? String(g);
    const [normal, prac] = acc.get(name) ?? [0, 0];
    return new Map(acc).set(name, isPractice(practice) ? [normal, prac + Number(c)] : [normal + Number(c), prac]);
  }, new Map());
  return [...totals].map(([n, [normal, prac]]) => [n, normal, prac]).sort((a, b) => b[1] + b[2] - (a[1] + a[2]));
}

const EVENT_LABELS = {
  onboarding_done: () => "İlk açılış ekranını bitiren",
  signed_in: (v) => `Giriş yapan (${v})`,
  share_tapped: (v) => `Paylaş'a dokunan (${GAME_NAMES[v] ?? v})`,
  push_permission: (v) => `Bildirim izni: ${v === "true" ? "verdi" : "vermedi"}`,
};

function daySections(rows, [, devices, installs, sessions, games]) {
  const out = [`- **${devices}** cihaz, **${installs}** yeni kurulum, **${sessions}** oturum, **${games}** biten oyun`, ""];
  const played = gameRows(rows.games);
  if (played.length) out.push("## Biten oyunlar", "", table(["Oyun", "Normal", "Pratik"], played), "");
  if (rows.screens.length) out.push("## En çok açılan ekranlar", "", table(["Ekran", "Cihaz", "Açılış"], rows.screens), "");
  if (rows.newScreens.length) out.push("## Yeni gelenler nereye gitti", "", table(["Ekran", "Yeni cihaz"], rows.newScreens), "");
  if (rows.events.length)
    out.push("## Diğer", "", ...rows.events.map(([e, v, c]) => `- ${EVENT_LABELS[e]?.(v) ?? `${e} ${v}`}: ${c}`), "");
  if (rows.versions.length)
    out.push("## Sürümler", "", ...rows.versions.map(([v, b, os, n]) => `- ${v} (${b}) ${os}: ${n} cihaz`), "");
  return out;
}

/** The report for `day` from the query rows (same keys as reportQueries). */
export function renderReport(day, rows) {
  const today = rows.daily.find((r) => String(r[0]) === day);
  const out = [
    `# Tiktako günlük rapor: ${day}`,
    "",
    ...(today ? daySections(rows, today) : ["Dün hiç kayıt yok (PostHog yalnızca 1.2 ve sonrası sürümlerden veri alır).", ""]),
  ];
  if (rows.daily.length) out.push("## Son 7 gün", "", table(["Gün", "Cihaz", "Kurulum", "Oturum", "Oyun"], rows.daily), "");
  if (rows.retention.length) {
    const back = rows.retention.map(([d, n, came]) => [d, n, came, pct(came, n)]);
    out.push("## Ertesi gün dönenler", "", table(["İlk gün", "Yeni cihaz", "Ertesi gün döndü", "Oran"], back), "");
  }
  return out.join("\n");
}
