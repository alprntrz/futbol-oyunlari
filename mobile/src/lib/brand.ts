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

/** Game-look art (docs/design/showdown-ui-brief.md): Play-tab heroes, tab icons, background pattern. */
export const OYUN = {
  hero: {
    ht: require("../../assets/brand/oyun/hero-tictactoe.png"),
    qz: require("../../assets/brand/oyun/hero-quiz.png"),
    pp: require("../../assets/brand/oyun/hero-possession.png"),
  },
  tab: {
    games: require("../../assets/brand/oyun/tab-games.png"),
    daily: require("../../assets/brand/oyun/tab-daily.png"),
    play: require("../../assets/brand/oyun/tab-play.png"),
    friends: require("../../assets/brand/oyun/tab-friends.png"),
    profile: require("../../assets/brand/oyun/tab-profile.png"),
  },
  pattern: require("../../assets/brand/oyun/bg-pattern.png"),
};

export const BRAND = {
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
