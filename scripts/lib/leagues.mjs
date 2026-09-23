/**
 * Config for scripts/build-league-derbies.mjs: teams (Transfermarkt club id,
 * Turkish display name, matcher for the club name as printed on match sheets,
 * kit colours), derby pairs per league, and how to label competitions.
 *
 * `re` is tested against the match-sheet club name and is anchored where a
 * name is a substring of another ("FC Barcelona" vs "RCD Espanyol Barcelona",
 * "Inter Milan" vs "AC Milan").
 */

const kit = (body, sleeves, number) => ({ body, sleeves, number });

export const TEAMS = {
  // ── La Liga
  rma: { id: 418, name: "Real Madrid", re: /real madrid/i, kit: kit("#ffffff", "#ffffff", "#1a1a1a") },
  fcb: { id: 131, name: "Barcelona", re: /^(fc )?barcelona$/i, kit: kit("#004d98", "#a50044", "#f6eb61") },
  atm: { id: 13, name: "Atlético Madrid", re: /atl[eé]tico/i, kit: kit("#cb3524", "#272e61", "#ffffff") },
  sev: { id: 368, name: "Sevilla", re: /^sevilla/i, kit: kit("#ffffff", "#d4021d", "#d4021d") },
  bet: { id: 150, name: "Real Betis", re: /betis/i, kit: kit("#0bb363", "#ffffff", "#ffffff") },
  ath: { id: 621, name: "Athletic Bilbao", re: /athletic/i, kit: kit("#ee2523", "#ffffff", "#ffffff") },
  rso: { id: 681, name: "Real Sociedad", re: /real sociedad/i, kit: kit("#0067b1", "#ffffff", "#ffffff") },
  esp: { id: 714, name: "Espanyol", re: /espanyol/i, kit: kit("#1b6fc6", "#ffffff", "#ffffff") },
  // ── Premier League
  mun: { id: 985, name: "Manchester United", re: /manchester united/i, kit: kit("#da291c", "#da291c", "#ffffff") },
  mci: { id: 281, name: "Manchester City", re: /manchester city/i, kit: kit("#6cabdd", "#6cabdd", "#1c2c5b") },
  liv: { id: 31, name: "Liverpool", re: /^liverpool/i, kit: kit("#c8102e", "#c8102e", "#f6eb61") },
  eve: { id: 29, name: "Everton", re: /^everton/i, kit: kit("#003399", "#003399", "#ffffff") },
  ars: { id: 11, name: "Arsenal", re: /^arsenal/i, kit: kit("#ef0107", "#ffffff", "#ffffff") },
  tot: { id: 148, name: "Tottenham", re: /tottenham/i, kit: kit("#ffffff", "#132257", "#132257") },
  che: { id: 631, name: "Chelsea", re: /^chelsea/i, kit: kit("#034694", "#034694", "#ffffff") },
  new: { id: 762, name: "Newcastle United", re: /newcastle/i, kit: kit("#111111", "#ffffff", "#ffffff") },
  sun: { id: 289, name: "Sunderland", re: /sunderland/i, kit: kit("#eb172b", "#ffffff", "#ffffff") },
  // ── Serie A
  int: { id: 46, name: "Inter", re: /^inter/i, kit: kit("#0068a8", "#111111", "#ffffff") },
  mil: { id: 5, name: "AC Milan", re: /^(ac )?milan/i, kit: kit("#d50000", "#111111", "#ffffff") },
  juv: { id: 506, name: "Juventus", re: /juventus/i, kit: kit("#ffffff", "#111111", "#111111") },
  tor: { id: 416, name: "Torino", re: /^torino/i, kit: kit("#8b1c2c", "#8b1c2c", "#ffffff") },
  rom: { id: 12, name: "Roma", re: /^(as )?roma/i, kit: kit("#9b1c31", "#f0bc42", "#f0bc42") },
  laz: { id: 398, name: "Lazio", re: /lazio/i, kit: kit("#7fc6f0", "#ffffff", "#1a1a1a") },
  nap: { id: 6195, name: "Napoli", re: /napoli/i, kit: kit("#12a0d7", "#12a0d7", "#ffffff") },
  // ── Bundesliga
  bay: { id: 27, name: "Bayern Münih", re: /bayern/i, kit: kit("#dc052d", "#dc052d", "#ffffff") },
  bvb: { id: 16, name: "Borussia Dortmund", re: /dortmund/i, kit: kit("#fde100", "#fde100", "#1a1a1a") },
  s04: { id: 33, name: "Schalke 04", re: /schalke/i, kit: kit("#004d9d", "#004d9d", "#ffffff") },
  b04: { id: 15, name: "Bayer Leverkusen", re: /leverkusen/i, kit: kit("#e32221", "#111111", "#ffffff") },
  bmg: { id: 18, name: "Mönchengladbach", re: /gladbach|nchengladbach/i, kit: kit("#ffffff", "#00a651", "#111111") },
  kol: { id: 3, name: "Köln", re: /k[oö]ln|cologne/i, kit: kit("#ffffff", "#ed1c24", "#ed1c24") },
  ham: { id: 41, name: "Hamburg", re: /hamburg/i, kit: kit("#ffffff", "#0a3a82", "#0a3a82") },
  bre: { id: 86, name: "Werder Bremen", re: /werder|bremen/i, kit: kit("#1d9053", "#1d9053", "#ffffff") },
  // ── Süper Lig (beyond the big-three derbies already in matches-derbiler*)
  gs: { id: 141, name: "Galatasaray", re: /galatasaray/i, kit: kit("#a32638", "#fdb912", "#ffffff") },
  fb: { id: 36, name: "Fenerbahçe", re: /fenerbah/i, kit: kit("#163962", "#ffed00", "#ffffff") },
  bjk: { id: 114, name: "Beşiktaş", re: /be[sş]ikta[sş]/i, kit: kit("#000000", "#ffffff", "#ffffff") },
  ts: { id: 449, name: "Trabzonspor", re: /trabzon/i, kit: kit("#8d1b3d", "#0a5db8", "#ffffff") },
};

/** Competition (as printed by Transfermarkt) → display names; first match wins. */
export const COMPETITIONS = [
  [/champions league/i, { tr: "Şampiyonlar Ligi", en: "Champions League" }],
  [/europa league|uefa cup/i, { tr: "Avrupa Ligi", en: "Europa League" }],
  [/^la ?liga/i, { tr: "La Liga", en: "La Liga" }],
  [/copa del rey/i, { tr: "Kral Kupası", en: "Copa del Rey" }],
  [/supercopa/i, { tr: "İspanya Süper Kupası", en: "Spanish Super Cup" }],
  [/^premier league$/i, { tr: "Premier Lig", en: "Premier League" }],
  [/^fa cup/i, { tr: "FA Cup", en: "FA Cup" }],
  [/efl cup|league cup|carabao/i, { tr: "Lig Kupası", en: "League Cup" }],
  [/community shield/i, { tr: "Community Shield", en: "Community Shield" }],
  [/^serie a$/i, { tr: "Serie A", en: "Serie A" }],
  [/coppa italia/i, { tr: "İtalya Kupası", en: "Coppa Italia" }],
  [/supercoppa/i, { tr: "İtalya Süper Kupası", en: "Italian Super Cup" }],
  [/^bundesliga$/i, { tr: "Bundesliga", en: "Bundesliga" }],
  [/dfb.?pokal/i, { tr: "Almanya Kupası", en: "DFB-Pokal" }],
  [/supercup/i, { tr: "Almanya Süper Kupası", en: "German Super Cup" }],
  [/s[uü]per lig/i, { tr: "Süper Lig", en: "Süper Lig" }],
  [/s[uü]per final/i, { tr: "Süper Final", en: "Süper Final" }],
  [/t[uü]rkiye kupasi|turkish cup/i, { tr: "Türkiye Kupası", en: "Turkish Cup" }],
  [/tff s[uü]per kupa|s[uü]per kupa/i, { tr: "TFF Süper Kupa", en: "Turkish Super Cup" }],
];

const lbl = (tr, en = tr) => ({ tr, en });

/**
 * take = max candidate matches per pair (newest first, competitions above only,
 * seasons ≥ YMIN). derby = display label; omit for plain "big match" pairs.
 */
export const LEAGUES = {
  laliga: {
    tags: ["derbi", "la-liga"],
    pairs: [
      { a: "rma", b: "fcb", take: 30, derby: lbl("El Clásico") },
      { a: "rma", b: "atm", take: 20, derby: lbl("Madrid Derbisi", "Madrid Derby") },
      { a: "fcb", b: "atm", take: 14, derby: lbl("Barcelona – Atlético") },
      { a: "sev", b: "bet", take: 16, derby: lbl("Sevilla Derbisi", "Seville Derby") },
      { a: "ath", b: "rso", take: 12, derby: lbl("Bask Derbisi", "Basque Derby") },
      { a: "fcb", b: "esp", take: 10, derby: lbl("Katalan Derbisi", "Catalan Derby") },
    ],
  },
  premier: {
    tags: ["derbi", "premier-lig"],
    pairs: [
      { a: "mun", b: "liv", take: 20, derby: lbl("Kuzeybatı Derbisi", "North West Derby") },
      { a: "mun", b: "mci", take: 22, derby: lbl("Manchester Derbisi", "Manchester Derby") },
      { a: "ars", b: "tot", take: 20, derby: lbl("Kuzey Londra Derbisi", "North London Derby") },
      { a: "liv", b: "eve", take: 18, derby: lbl("Merseyside Derbisi", "Merseyside Derby") },
      { a: "che", b: "ars", take: 14, derby: lbl("Londra Derbisi", "London Derby") },
      { a: "che", b: "tot", take: 10, derby: lbl("Londra Derbisi", "London Derby") },
      { a: "liv", b: "mci", take: 14, derby: lbl("Liverpool – Manchester City") },
      { a: "mun", b: "ars", take: 14, derby: lbl("Manchester United – Arsenal") },
      { a: "mun", b: "che", take: 12, derby: lbl("Manchester United – Chelsea") },
      { a: "new", b: "sun", take: 6, derby: lbl("Tyne–Wear Derbisi", "Tyne–Wear Derby") },
    ],
  },
  seriea: {
    tags: ["derbi", "serie-a"],
    pairs: [
      { a: "int", b: "mil", take: 24, derby: lbl("Milano Derbisi", "Milan Derby") },
      { a: "juv", b: "int", take: 18, derby: lbl("Derby d'Italia") },
      { a: "juv", b: "mil", take: 16, derby: lbl("Juventus – Milan") },
      { a: "rom", b: "laz", take: 18, derby: lbl("Roma Derbisi", "Rome Derby") },
      { a: "juv", b: "tor", take: 12, derby: lbl("Torino Derbisi", "Turin Derby") },
      { a: "nap", b: "rom", take: 10, derby: lbl("Derby del Sole") },
      { a: "nap", b: "juv", take: 10, derby: lbl("Napoli – Juventus") },
    ],
  },
  bundesliga: {
    tags: ["derbi", "bundesliga"],
    pairs: [
      { a: "bay", b: "bvb", take: 24, derby: lbl("Der Klassiker") },
      { a: "bvb", b: "s04", take: 16, derby: lbl("Revierderby") },
      { a: "bay", b: "b04", take: 12, derby: lbl("Bayern – Leverkusen") },
      { a: "bay", b: "bmg", take: 10, derby: lbl("Bayern – Mönchengladbach") },
      { a: "ham", b: "bre", take: 10, derby: lbl("Kuzey Derbisi", "Nordderby") },
      { a: "kol", b: "bmg", take: 10, derby: lbl("Ren Derbisi", "Rhine Derby") },
    ],
  },
  // The big-three derbies (re-generated with real pitch positions, replacing the
  // earlier label-based matches-derbiler*.ts). `plain` → "Süper Lig Derbisi".
  derbiler: {
    tags: ["turkiye", "derbi"],
    pairs: [
      { a: "gs", b: "fb", take: 80, plain: true },
      { a: "gs", b: "bjk", take: 80, plain: true },
      { a: "fb", b: "bjk", take: 80, plain: true },
    ],
  },
  superlig: {
    tags: ["turkiye", "derbi", "super-lig"],
    pairs: [
      { a: "ts", b: "gs", take: 20, derby: lbl("Trabzonspor – Galatasaray") },
      { a: "ts", b: "fb", take: 20, derby: lbl("Trabzonspor – Fenerbahçe") },
      { a: "ts", b: "bjk", take: 20, derby: lbl("Trabzonspor – Beşiktaş") },
    ],
  },
};
