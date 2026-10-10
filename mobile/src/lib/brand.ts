/**
 * Generated brand images (docs/design/ikon-brief.md), processed by
 * scripts/brand-assets.py into mobile/assets/brand/.
 */
export const BRAND = {
  icon: {
    daily: require("../../assets/brand/icon-daily.png"),
    practice: require("../../assets/brand/icon-practice.png"),
    team: require("../../assets/brand/icon-team.png"),
    race: require("../../assets/brand/icon-race.png"),
    tiki: require("../../assets/brand/icon-tiki.png"),
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
