import { SportKey } from '../../generated/prisma';

/** Bookmaker slug used for closing lines. */
export const ODDSPAPI_BOOKMAKER_PINNACLE = 'pinnacle';

export const ODDSPAPI_STATUS_FINISHED = 2;

/** Cooldown between historical-odds calls (API docs: ~5s). */
export const ODDSPAPI_HISTORICAL_ODDS_COOLDOWN_MS = 5100;

export type OneXTwoMarketConfig = {
  marketId: string;
  homeOutcomeId: string;
  drawOutcomeId: string;
  awayOutcomeId: string;
};

export type SportOddsPapiConfig = {
  sportKey: SportKey;
  oddsPapiSportId: number;
  /** Regulation / full-time 1X2 (NOT OT moneyline). */
  oneXTwo: OneXTwoMarketConfig;
};

/**
 * Sport-specific OddsPapi market configuration.
 * Do not scatter sportId/marketId conditionals across the codebase.
 */
export const ODDSPAPI_SPORT_CONFIG: Record<SportKey, SportOddsPapiConfig> = {
  [SportKey.FOOTBALL]: {
    sportKey: SportKey.FOOTBALL,
    oddsPapiSportId: 10,
    oneXTwo: {
      marketId: '101',
      homeOutcomeId: '101',
      drawOutcomeId: '102',
      awayOutcomeId: '103',
    },
  },
  [SportKey.HOCKEY]: {
    sportKey: SportKey.HOCKEY,
    // OddsPapi ice hockey (Regular Time Result = 153).
    oddsPapiSportId: 15,
    oneXTwo: {
      marketId: '153',
      homeOutcomeId: '153',
      drawOutcomeId: '154',
      awayOutcomeId: '155',
    },
  },
};

export function getOddsPapiSportConfig(sportKey: SportKey): SportOddsPapiConfig {
  const cfg = ODDSPAPI_SPORT_CONFIG[sportKey];
  if (!cfg) {
    throw new Error(`No OddsPapi sport config for ${sportKey}`);
  }
  return cfg;
}
