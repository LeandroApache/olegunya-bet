import { closingSnapshot, parseUtc } from './odds-papi-closing';
import { getOverUnderOutcomeIds } from './odds-papi-market-filter';
import { distanceFromEvenMoney, selectMainTotalLine } from './odds-papi-total-selector';
import { ODDSPAPI_BOOKMAKER_PINNACLE } from './odds-papi.sport-config';
import {
  OddsPapiHistoricalOddsResponse,
  OddsPapiMarketDefinition,
  OddsPapiOddsSnapshot,
  TotalLineCandidate,
} from './odds-papi.types';

export type TotalLineDiagnosticRow = {
  line: number;
  marketId: string;
  overOdds: number | null;
  underOdds: number | null;
  overCreatedAt: string | null;
  underCreatedAt: string | null;
  /** Fair Over probability after OU-only de-vig (0..1), or null if ineligible. */
  pOverFair: number | null;
  distance: number | null;
  eligible: boolean;
  selected: boolean;
  skipReason?: string;
};

export type MainTotalSelectionDiagnostic = {
  closingCutoff: string;
  selected: TotalLineCandidate | null;
  rows: TotalLineDiagnosticRow[];
  /** Human-readable table for tests / manual inspection. */
  table: string;
};

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

function formatPct(n: number | null): string {
  if (n == null || !isFinite(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function formatOdds(n: number | null): string {
  if (n == null || !isFinite(n)) return '—';
  return String(n);
}

/**
 * Debug/test helper: explain why a main total line was (or was not) selected.
 * Does not change production selection — uses the same selectMainTotalLine path.
 */
export function explainMainTotalSelection(
  totalsMarkets: OddsPapiMarketDefinition[],
  data: OddsPapiHistoricalOddsResponse,
  closingCutoffIso: string,
): MainTotalSelectionDiagnostic {
  const cutoff = parseUtc(closingCutoffIso);
  const selected = selectMainTotalLine(totalsMarkets, data, closingCutoffIso);

  const rows: TotalLineDiagnosticRow[] = [];

  for (const market of totalsMarkets) {
    const ids = getOverUnderOutcomeIds(market);
    if (!ids) {
      rows.push({
        line: market.handicap,
        marketId: String(market.marketId),
        overOdds: null,
        underOdds: null,
        overCreatedAt: null,
        underCreatedAt: null,
        pOverFair: null,
        distance: null,
        eligible: false,
        selected: false,
        skipReason: 'NO_OVER_UNDER_OUTCOMES',
      });
      continue;
    }

    if (!isFinite(cutoff.getTime())) {
      rows.push({
        line: market.handicap,
        marketId: String(market.marketId),
        overOdds: null,
        underOdds: null,
        overCreatedAt: null,
        underCreatedAt: null,
        pOverFair: null,
        distance: null,
        eligible: false,
        selected: false,
        skipReason: 'INVALID_CUTOFF',
      });
      continue;
    }

    const overSnap = closingSnapshot(
      snapshotsFor(data, String(market.marketId), ids.overOutcomeId),
      cutoff,
    );
    const underSnap = closingSnapshot(
      snapshotsFor(data, String(market.marketId), ids.underOutcomeId),
      cutoff,
    );

    if (!overSnap || !underSnap) {
      rows.push({
        line: market.handicap,
        marketId: String(market.marketId),
        overOdds: overSnap?.price ?? null,
        underOdds: underSnap?.price ?? null,
        overCreatedAt: overSnap?.createdAt ?? null,
        underCreatedAt: underSnap?.createdAt ?? null,
        pOverFair: null,
        distance: null,
        eligible: false,
        selected: false,
        skipReason: !overSnap && !underSnap
          ? 'MISSING_OVER_AND_UNDER'
          : !overSnap
            ? 'MISSING_OVER'
            : 'MISSING_UNDER',
      });
      continue;
    }

    const distance = distanceFromEvenMoney(overSnap.price, underSnap.price);
    if (distance == null) {
      rows.push({
        line: market.handicap,
        marketId: String(market.marketId),
        overOdds: overSnap.price,
        underOdds: underSnap.price,
        overCreatedAt: overSnap.createdAt,
        underCreatedAt: underSnap.createdAt,
        pOverFair: null,
        distance: null,
        eligible: false,
        selected: false,
        skipReason: 'INVALID_ODDS',
      });
      continue;
    }

    const pOverRaw = 1 / overSnap.price;
    const pUnderRaw = 1 / underSnap.price;
    const pOverFair = pOverRaw / (pOverRaw + pUnderRaw);
    const isSelected =
      selected != null &&
      String(selected.marketId) === String(market.marketId) &&
      selected.line === market.handicap;

    rows.push({
      line: market.handicap,
      marketId: String(market.marketId),
      overOdds: overSnap.price,
      underOdds: underSnap.price,
      overCreatedAt: overSnap.createdAt,
      underCreatedAt: underSnap.createdAt,
      pOverFair,
      distance,
      eligible: true,
      selected: isSelected,
    });
  }

  rows.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    if (a.distance == null && b.distance == null) return a.line - b.line;
    if (a.distance == null) return 1;
    if (b.distance == null) return -1;
    return a.distance - b.distance;
  });

  const header =
    'line | overOdds | underOdds | overCreatedAt | underCreatedAt | pOverFair | distance | selected';
  const body = rows.map((r) => {
    const sel = r.selected ? 'YES' : r.eligible ? 'no' : `skip:${r.skipReason ?? '?'}`;
    return [
      r.line,
      formatOdds(r.overOdds),
      formatOdds(r.underOdds),
      r.overCreatedAt ?? '—',
      r.underCreatedAt ?? '—',
      formatPct(r.pOverFair),
      formatPct(r.distance),
      sel,
    ].join(' | ');
  });

  return {
    closingCutoff: closingCutoffIso,
    selected,
    rows,
    table: [header, ...body].join('\n'),
  };
}
