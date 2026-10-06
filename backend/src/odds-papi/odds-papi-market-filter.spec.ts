import { isMatchTotalsMarket, listMatchTotalsMarkets } from './odds-papi-market-filter';
import { OddsPapiMarketDefinition } from './odds-papi.types';

function def(partial: Partial<OddsPapiMarketDefinition>): OddsPapiMarketDefinition {
  return {
    marketId: 1010,
    marketLength: 2,
    marketName: 'Over Under Full Time',
    playerProp: false,
    sportId: 10,
    handicap: 2.5,
    period: 'fulltime',
    marketType: 'totals',
    outcomes: [
      { outcomeId: 1010, outcomeName: 'Over' },
      { outcomeId: 1011, outcomeName: 'Under' },
    ],
    ...partial,
  };
}

describe('match totals market filter', () => {
  it('accepts football fulltime Over/Under totals', () => {
    expect(isMatchTotalsMarket(def({}))).toBe(true);
  });

  it('rejects BTTS (Yes/No) even if marketType=totals', () => {
    expect(
      isMatchTotalsMarket(
        def({
          marketId: 104,
          marketName: 'Both Teams To Score',
          handicap: 0,
          outcomes: [
            { outcomeId: 104, outcomeName: 'Yes' },
            { outcomeId: 105, outcomeName: 'No' },
          ],
        }),
      ),
    ).toBe(false);
  });

  it('rejects first-half / team totals / OT markets', () => {
    expect(isMatchTotalsMarket(def({ period: '1sthalf' }))).toBe(false);
    expect(isMatchTotalsMarket(def({ marketName: 'Team Total Home' }))).toBe(false);
    expect(isMatchTotalsMarket(def({ marketName: 'Total Including OT' }))).toBe(false);
  });

  it('filters by sportId', () => {
    const catalog = [
      def({ sportId: 10, marketId: 1010, handicap: 2.5 }),
      def({
        sportId: 15,
        marketId: 1524,
        marketName: 'Total',
        handicap: 5.0,
        outcomes: [
          { outcomeId: 1524, outcomeName: 'Over' },
          { outcomeId: 1525, outcomeName: 'Under' },
        ],
      }),
    ];
    expect(listMatchTotalsMarkets(catalog, 15).map((m) => m.marketId)).toEqual([1524]);
  });
});
