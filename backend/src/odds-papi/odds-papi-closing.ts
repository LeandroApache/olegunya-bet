import {
  ClosingOneXTwo,
  OddsPapiHistoricalOddsResponse,
  OddsPapiOddsSnapshot,
} from './odds-papi.types';
import { ODDSPAPI_BOOKMAKER_PINNACLE } from './odds-papi.sport-config';
import { OneXTwoMarketConfig } from './odds-papi.sport-config';

export function parseUtc(iso: string): Date {
  return new Date(iso.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`);
}

export function closingCutoffIso(trueStartTime?: string | null, startTime?: string | null): string {
  const v = trueStartTime || startTime;
  if (!v) throw new Error('Fixture has no trueStartTime/startTime');
  return v;
}

/**
 * Latest snapshot with active===true and createdAt <= closingCutoff.
 * Home/Draw/Away may use different timestamps — that is intentional.
 */
export function closingPrice(
  snapshots: OddsPapiOddsSnapshot[],
  closingCutoff: Date,
): number | null {
  const valid = snapshots
    .filter((s) => {
      if (s.active !== true) return false;
      if (!isFinite(s.price) || s.price <= 1) return false;
      const created = parseUtc(s.createdAt);
      return created.getTime() <= closingCutoff.getTime();
    })
    .sort((a, b) => parseUtc(b.createdAt).getTime() - parseUtc(a.createdAt).getTime());

  return valid.length ? valid[0].price : null;
}

function snapshotsForOutcome(
  data: OddsPapiHistoricalOddsResponse,
  marketId: string,
  outcomeId: string,
): OddsPapiOddsSnapshot[] {
  const book = data.bookmakers?.[ODDSPAPI_BOOKMAKER_PINNACLE];
  const market = book?.markets?.[String(marketId)];
  const outcome = market?.outcomes?.[String(outcomeId)];
  const players = outcome?.players ?? {};
  // Match totals / 1X2 main line typically under player "0".
  return players['0'] ?? [];
}

/**
 * Extract Pinnacle regulation/full-time closing 1X2 using sport-specific market ids.
 * Intentionally returns RAW prices for the existing dirty-implied pipeline (no de-vig).
 */
export function extractPinnacleClosingOneXTwo(
  data: OddsPapiHistoricalOddsResponse,
  closingCutoffIsoStr: string,
  oneXTwo: OneXTwoMarketConfig,
): ClosingOneXTwo | null {
  const cutoff = parseUtc(closingCutoffIsoStr);
  if (!isFinite(cutoff.getTime())) return null;

  const kHome = closingPrice(
    snapshotsForOutcome(data, oneXTwo.marketId, oneXTwo.homeOutcomeId),
    cutoff,
  );
  const kDraw = closingPrice(
    snapshotsForOutcome(data, oneXTwo.marketId, oneXTwo.drawOutcomeId),
    cutoff,
  );
  const kAway = closingPrice(
    snapshotsForOutcome(data, oneXTwo.marketId, oneXTwo.awayOutcomeId),
    cutoff,
  );

  if (kHome == null || kDraw == null || kAway == null) return null;
  return { kHome, kDraw, kAway };
}
