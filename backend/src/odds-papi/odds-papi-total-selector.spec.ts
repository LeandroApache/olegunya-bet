import {
  buildTotalLineCandidate,
  distanceFromEvenMoney,
  selectMainTotalLine,
} from './odds-papi-total-selector';
import { OddsPapiHistoricalOddsResponse, OddsPapiMarketDefinition } from './odds-papi.types';

function market(line: number, marketId: number, overId: number, underId: number): OddsPapiMarketDefinition {
  return {
    marketId,
    marketLength: 2,
    marketName: 'Total',
    playerProp: false,
    sportId: 15,
    handicap: line,
    period: 'fulltime',
    marketType: 'totals',
    outcomes: [
      { outcomeId: overId, outcomeName: 'Over' },
      { outcomeId: underId, outcomeName: 'Under' },
    ],
  };
}

function hist(markets: Record<string, any>): OddsPapiHistoricalOddsResponse {
  return {
    fixtureId: 'test',
    bookmakers: {
      pinnacle: { markets },
    },
  };
}

function snaps(entries: Array<{ createdAt: string; price: number; active?: boolean }>) {
  return {
    players: {
      '0': entries.map((e) => ({
        createdAt: e.createdAt,
        price: e.price,
        active: e.active ?? true,
        limit: null,
        exchangeMeta: null,
      })),
    },
  };
}

describe('distanceFromEvenMoney / total selection', () => {
  const cutoff = '2026-09-30T15:43:06.345Z';

  it('Case A: selects 5.0 over 5.5 (closer to even)', () => {
    // 5.0 Over=1.877 Under=1.793 → closer to 50/50 than 5.5 Over=2.06 Under=1.714
    const d50 = distanceFromEvenMoney(1.877, 1.793)!;
    const d55 = distanceFromEvenMoney(2.06, 1.714)!;
    expect(d50).toBeLessThan(d55);

    const data = hist({
      '1524': {
        outcomes: {
          '1524': snaps([{ createdAt: '2026-09-30T15:40:00.000Z', price: 1.877 }]),
          '1525': snaps([{ createdAt: '2026-09-30T15:41:00.000Z', price: 1.793 }]),
        },
      },
      '1526': {
        outcomes: {
          '1526': snaps([{ createdAt: '2026-09-30T15:40:00.000Z', price: 2.06 }]),
          '1527': snaps([{ createdAt: '2026-09-30T15:40:00.000Z', price: 1.714 }]),
        },
      },
    });

    const selected = selectMainTotalLine(
      [
        market(5.0, 1524, 1524, 1525),
        market(5.5, 1526, 1526, 1527),
      ],
      data,
      cutoff,
    );
    expect(selected?.line).toBe(5.0);
  });

  it('Case B: ignores active=false', () => {
    const data = hist({
      '1524': {
        outcomes: {
          '1524': snaps([
            { createdAt: '2026-09-30T15:40:00.000Z', price: 1.05, active: false },
            { createdAt: '2026-09-30T15:39:00.000Z', price: 1.877, active: true },
          ]),
          '1525': snaps([{ createdAt: '2026-09-30T15:40:00.000Z', price: 1.793 }]),
        },
      },
    });
    const c = buildTotalLineCandidate(market(5.0, 1524, 1524, 1525), data, cutoff);
    expect(c?.overOdds).toBe(1.877);
  });

  it('Case C: ignores createdAt > closingCutoff', () => {
    const data = hist({
      '1524': {
        outcomes: {
          '1524': snaps([
            { createdAt: '2026-09-30T16:00:00.000Z', price: 1.2 }, // after kickoff
            { createdAt: '2026-09-30T15:40:00.000Z', price: 1.877 },
          ]),
          '1525': snaps([{ createdAt: '2026-09-30T15:40:00.000Z', price: 1.793 }]),
        },
      },
    });
    const c = buildTotalLineCandidate(market(5.0, 1524, 1524, 1525), data, cutoff);
    expect(c?.overOdds).toBe(1.877);
  });

  it('Case D: allows different Over/Under timestamps', () => {
    const data = hist({
      '1524': {
        outcomes: {
          '1524': snaps([{ createdAt: '2026-09-30T15:40:00.000Z', price: 1.877 }]),
          '1525': snaps([{ createdAt: '2026-09-30T15:42:50.000Z', price: 1.793 }]),
        },
      },
    });
    const c = buildTotalLineCandidate(market(5.0, 1524, 1524, 1525), data, cutoff);
    expect(c).not.toBeNull();
    expect(c!.overOdds).toBe(1.877);
    expect(c!.underOdds).toBe(1.793);
  });

  it('Case E: missing one side → invalid candidate', () => {
    const data = hist({
      '1524': {
        outcomes: {
          '1524': snaps([{ createdAt: '2026-09-30T15:40:00.000Z', price: 1.877 }]),
          // under missing
        },
      },
    });
    const c = buildTotalLineCandidate(market(5.0, 1524, 1524, 1525), data, cutoff);
    expect(c).toBeNull();
  });

  it('Case F: no valid totals → null selection', () => {
    const selected = selectMainTotalLine(
      [market(5.0, 1524, 1524, 1525)],
      hist({}),
      cutoff,
    );
    expect(selected).toBeNull();
  });
});
