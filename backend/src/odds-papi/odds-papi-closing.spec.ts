import { extractPinnacleClosingOneXTwo, closingPrice } from './odds-papi-closing';
import { getOddsPapiSportConfig } from './odds-papi.sport-config';
import { SportKey } from '../../generated/prisma';
import { OddsPapiHistoricalOddsResponse } from './odds-papi.types';

function hist(marketId: string, outcomes: Record<string, any>): OddsPapiHistoricalOddsResponse {
  return {
    fixtureId: 'x',
    bookmakers: {
      pinnacle: {
        markets: {
          [marketId]: { outcomes },
        },
      },
    },
  };
}

describe('extractPinnacleClosingOneXTwo', () => {
  const cutoff = '2026-09-20T17:03:29.467Z';

  it('uses football market 101 outcomes', () => {
    const cfg = getOddsPapiSportConfig(SportKey.FOOTBALL);
    const data = hist('101', {
      '101': {
        players: {
          '0': [{ createdAt: '2026-09-20T17:00:00.000Z', price: 1.104, active: true }],
        },
      },
      '102': {
        players: {
          '0': [{ createdAt: '2026-09-20T17:00:00.000Z', price: 8.88, active: true }],
        },
      },
      '103': {
        players: {
          '0': [{ createdAt: '2026-09-20T17:00:00.000Z', price: 19.9, active: true }],
        },
      },
    });
    const c = extractPinnacleClosingOneXTwo(data, cutoff, cfg.oneXTwo);
    expect(c).toEqual({ kHome: 1.104, kDraw: 8.88, kAway: 19.9 });
  });

  it('uses hockey Regular Time Result market 153 (not 101)', () => {
    const cfg = getOddsPapiSportConfig(SportKey.HOCKEY);
    expect(cfg.oddsPapiSportId).toBe(15);
    expect(cfg.oneXTwo.marketId).toBe('153');

    const data = hist('153', {
      '153': {
        players: {
          '0': [{ createdAt: '2026-09-30T15:40:00.000Z', price: 1.25, active: true }],
        },
      },
      '154': {
        players: {
          '0': [{ createdAt: '2026-09-30T15:40:00.000Z', price: 5.44, active: true }],
        },
      },
      '155': {
        players: {
          '0': [{ createdAt: '2026-09-30T15:40:00.000Z', price: 8.36, active: true }],
        },
      },
    });
    // Football market present but must be ignored for hockey config
    (data.bookmakers.pinnacle.markets as any)['101'] = {
      outcomes: {
        '101': { players: { '0': [{ createdAt: '2026-09-30T15:40:00.000Z', price: 9.99, active: true }] } },
        '102': { players: { '0': [{ createdAt: '2026-09-30T15:40:00.000Z', price: 9.99, active: true }] } },
        '103': { players: { '0': [{ createdAt: '2026-09-30T15:40:00.000Z', price: 9.99, active: true }] } },
      },
    };

    const c = extractPinnacleClosingOneXTwo(data, '2026-09-30T15:43:06.345Z', cfg.oneXTwo);
    expect(c).toEqual({ kHome: 1.25, kDraw: 5.44, kAway: 8.36 });
  });

  it('closingPrice allows createdAt == cutoff', () => {
    const price = closingPrice(
      [{ createdAt: '2026-09-20T17:03:29.467Z', price: 1.5, active: true }],
      new Date('2026-09-20T17:03:29.467Z'),
    );
    expect(price).toBe(1.5);
  });
});
