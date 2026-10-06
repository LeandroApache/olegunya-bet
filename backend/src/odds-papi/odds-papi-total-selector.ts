import { closingPrice, parseUtc } from './odds-papi-closing';
import { getOverUnderOutcomeIds } from './odds-papi-market-filter';
import { ODDSPAPI_BOOKMAKER_PINNACLE } from './odds-papi.sport-config';
import {
  OddsPapiHistoricalOddsResponse,
  OddsPapiMarketDefinition,
  OddsPapiOddsSnapshot,
  TotalLineCandidate,
} from './odds-papi.types';

function snapshotsFor(
  data: OddsPapiHistoricalOddsResponse,
  marketId: string,
  outcomeId: string,
): OddsPapiOddsSnapshot[] {
  const book = data.bookmakers?.[ODDSPAPI_BOOKMAKER_PINNACLE];
  const market = book?.markets?.[String(marketId)];
  const outcome = market?.outcomes?.[String(outcomeId)];
  return outcome?.players?.['0'] ?? [];
}

/**
 * Normalization ONLY for choosing the main total line.
 * Must never feed into MatchComputed / dirty 1X2 math.
 */
export function distanceFromEvenMoney(overOdds: number, underOdds: number): number | null {
  if (!isFinite(overOdds) || !isFinite(underOdds) || overOdds <= 1 || underOdds <= 1) {
    return null;
  }
  const pOverRaw = 1 / overOdds;
  const pUnderRaw = 1 / underOdds;
  const sum = pOverRaw + pUnderRaw;
  if (!(sum > 0)) return null;
  const pOverNormalized = pOverRaw / sum;
  return Math.abs(pOverNormalized - 0.5);
}

export function buildTotalLineCandidate(
  market: OddsPapiMarketDefinition,
  data: OddsPapiHistoricalOddsResponse,
  closingCutoffIso: string,
): TotalLineCandidate | null {
  const ids = getOverUnderOutcomeIds(market);
  if (!ids) return null;

  const cutoff = parseUtc(closingCutoffIso);
  if (!isFinite(cutoff.getTime())) return null;

  const overOdds = closingPrice(
    snapshotsFor(data, String(market.marketId), ids.overOutcomeId),
    cutoff,
  );
  const underOdds = closingPrice(
    snapshotsFor(data, String(market.marketId), ids.underOutcomeId),
    cutoff,
  );
  if (overOdds == null || underOdds == null) return null;

  const distance = distanceFromEvenMoney(overOdds, underOdds);
  if (distance == null) return null;

  return {
    marketId: String(market.marketId),
    line: market.handicap,
    overOdds,
    underOdds,
    distanceFromEven: distance,
  };
}

/**
 * Select the total line closest to even Over/Under implied (after OU-only normalize).
 */
export function selectMainTotalLine(
  totalsMarkets: OddsPapiMarketDefinition[],
  data: OddsPapiHistoricalOddsResponse,
  closingCutoffIso: string,
): TotalLineCandidate | null {
  let best: TotalLineCandidate | null = null;
  for (const market of totalsMarkets) {
    const candidate = buildTotalLineCandidate(market, data, closingCutoffIso);
    if (!candidate) continue;
    if (!best || candidate.distanceFromEven < best.distanceFromEven) {
      best = candidate;
    }
  }
  return best;
}
