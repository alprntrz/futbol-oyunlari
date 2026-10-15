/**
 * Generated brand images (docs/design/ikon-brief.md), processed by
 * scripts/brand-assets.py into mobile/assets/brand/.
 */
/** Reward art (docs/design/oyun-hissi-brief.md) via scripts/reward-assets.py. */
export const REWARD = {
  laurelGold: require("../../assets/brand/odul/laurel-gold.png"),
  laurelSilver: require("../../assets/brand/odul/laurel-silver.png"),
  medal: require("../../assets/brand/odul/medal-gold.png"),
  trophy: require("../../assets/brand/odul/trophy-cup.png"),
  ribbon: require("../../assets/brand/odul/ribbon-banner.png"),
  panel: require("../../assets/brand/odul/panel-frame.png"),
  xp: require("../../assets/brand/odul/reward-xp.png"),
  series: require("../../assets/brand/odul/reward-series.png"),
  games: require("../../assets/brand/odul/reward-games.png"),
  chest: require("../../assets/brand/odul/chest-football.png"),
  chestOpen: require("../../assets/brand/odul/chest-football-open.png"),
  levelBadge: require("../../assets/brand/odul/level-badge.png"),
  stars: require("../../assets/brand/odul/bg-stars.png"),
};

/** Taktik Tahtası art (docs/design/taktik-tahtasi.md §17). */
export const TAKTIK = {
  hero: require("../../assets/brand/taktik/hero.png"),
  scout: require("../../assets/brand/taktik/card-scout.png"),
  coach: {
    pass: require("../../assets/brand/taktik/coach-pass-master.png"),
    bus: require("../../assets/brand/taktik/coach-defensive.png"),
    press: require("../../assets/brand/taktik/coach-pressing.png"),
  },
  item: {
    boot: require("../../assets/brand/taktik/item-golden-boot.png"),
    gloves: require("../../assets/brand/taktik/item-gloves.png"),
    shin: require("../../assets/brand/taktik/item-shin-guard.png"),
    band: require("../../assets/brand/taktik/item-captain-band.png"),
    energy: require("../../assets/brand/taktik/item-energy-drink.png"),
    board: require("../../assets/brand/taktik/item-tactics-board.png"),
  },
};

/** Badge medallions (docs/design/rozet-brief.md → scripts/badge-assets.py) and the Card Duel icon */
export const ROZET = {
  badge: {
    firstGame: require("../../assets/brand/rozet/badge-firstGame.png"),
    allGames: require("../../assets/brand/rozet/badge-allGames.png"),
    streak7: require("../../assets/brand/rozet/badge-streak7.png"),
    streak30: require("../../assets/brand/rozet/badge-streak30.png"),
    level10: require("../../assets/brand/rozet/badge-level10.png"),
    level20: require("../../assets/brand/rozet/badge-level20.png"),
    level40: require("../../assets/brand/rozet/badge-level40.png"),
    wins10: require("../../assets/brand/rozet/badge-wins10.png"),
    wins50: require("../../assets/brand/rozet/badge-wins50.png"),
    trophies5: require("../../assets/brand/rozet/badge-trophies5.png"),
    perfectDuel: require("../../assets/brand/rozet/badge-perfectDuel.png"),
    dailyDuel7: require("../../assets/brand/rozet/badge-dailyDuel7.png"),
  },
  duel: require("../../assets/brand/rozet/icon-duel.png"),
} as const;

export const BRAND = {
  /** the app's ball mark (same art as the splash) */
  logo: require("../../assets/brand/splash-logo.png"),
  icon: {
    daily: require("../../assets/brand/icon-daily.png"),
    practice: require("../../assets/brand/icon-practice.png"),
    team: require("../../assets/brand/icon-team.png"),
    race: require("../../assets/brand/icon-race.png"),
    tiki: require("../../assets/brand/icon-tiki.png"),
    quiz: require("../../assets/brand/icon-quiz.png"),
    mystery: require("../../assets/brand/icon-mystery.png"),
    bingo: require("../../assets/brand/icon-bingo.png"),
    possession: require("../../assets/brand/icon-possession.png"),
  },
  /** ways to play (docs/design/ikon-brief-2.md) */
  mode: {
    friend: require("../../assets/brand/mode-friend.png"),
    random: require("../../assets/brand/mode-random.png"),
    same: require("../../assets/brand/mode-same.png"),
    solo: require("../../assets/brand/mode-solo.png"),
  },
  cat: {
    all: require("../../assets/brand/cat-all.png"),
    europe: require("../../assets/brand/cat-europe.png"),
    national: require("../../assets/brand/cat-national.png"),
  },
  settings: {
    privacy: require("../../assets/brand/set-privacy.png"),
    support: require("../../assets/brand/set-support.png"),
    delete: require("../../assets/brand/set-delete.png"),
  },
  /** how-to-play steps (docs/design/ikon-brief-3.md) */
  how: {
    tapShirt: require("../../assets/brand/how-tap-shirt.png"),
    typeSurname: require("../../assets/brand/how-type-surname.png"),
    grid: require("../../assets/brand/how-grid.png"),
    namePlayer: require("../../assets/brand/how-name-player.png"),
    threeRow: require("../../assets/brand/how-three-row.png"),
    clock: require("../../assets/brand/how-clock.png"),
    hexes: require("../../assets/brand/how-hexes.png"),
    questions: require("../../assets/brand/how-questions.png"),
    speed: require("../../assets/brand/how-speed.png"),
    players: require("../../assets/brand/how-players.png"),
  },
  illus: {
    emptyStats: require("../../assets/brand/illus-empty-stats.png"),
    waitingRoom: require("../../assets/brand/illus-waiting-room.png"),
    waitingBall: require("../../assets/brand/illus-waiting-ball.png"),
    win: require("../../assets/brand/illus-win.png"),
    finish: require("../../assets/brand/illus-finish.png"),
    howto: require("../../assets/brand/illus-howto.png"),
  },
  tab: {
    games: { default: require("../../assets/brand/tab-games-line.png"), selected: require("../../assets/brand/tab-games-fill.png") },
    stats: { default: require("../../assets/brand/tab-stats-line.png"), selected: require("../../assets/brand/tab-stats-fill.png") },
    settings: { default: require("../../assets/brand/tab-settings-line.png"), selected: require("../../assets/brand/tab-settings-fill.png") },
  },
  jersey: {
    vneck: {
      body: require("../../assets/brand/jersey-vneck-body.png"),
      sleeves: require("../../assets/brand/jersey-vneck-sleeves.png"),
      shade: require("../../assets/brand/jersey-vneck-shade.png"),
    },
    crew: {
      body: require("../../assets/brand/jersey-crew-body.png"),
      sleeves: require("../../assets/brand/jersey-crew-sleeves.png"),
      shade: require("../../assets/brand/jersey-crew-shade.png"),
    },
    polo: {
      body: require("../../assets/brand/jersey-polo-body.png"),
      sleeves: require("../../assets/brand/jersey-polo-sleeves.png"),
      shade: require("../../assets/brand/jersey-polo-shade.png"),
    },
    keeper: {
      body: require("../../assets/brand/jersey-keeper-body.png"),
      sleeves: require("../../assets/brand/jersey-keeper-sleeves.png"),
      shade: require("../../assets/brand/jersey-keeper-shade.png"),
    },
  },
} as const;

export type JerseyStyle = keyof typeof BRAND.jersey;
