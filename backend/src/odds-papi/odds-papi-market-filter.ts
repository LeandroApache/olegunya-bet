import { OddsPapiMarketDefinition } from './odds-papi.types';

const EXCLUDED_NAME_RE =
  /\b(1st|first)\s*half\b|\bteam\s*total\b|\bcorners?\b|\bcards?\b|\bplayer\b|\bshots?\b|\bboth\s*teams\b|\bbtts\b|\bot\b|\bovertime\b|\bshootout\b|\bincluding\s*ot\b/i;

/**
 * Regulation / full-time match totals markets from OddsPapi catalog.
 * Line value comes from `handicap`. Over/Under outcome ids come from outcomes[].
 */
export function isMatchTotalsMarket(m: OddsPapiMarketDefinition): boolean {
  if (m.playerProp) return false;
  if (String(m.period).toLowerCase() !== 'fulltime') return false;
  if (String(m.marketType).toLowerCase() !== 'totals') return false;
  if (!isFinite(m.handicap)) return false;

  const name = m.marketName ?? '';
  if (EXCLUDED_NAME_RE.test(name)) return false;

  const over = m.outcomes?.find((o) => /^over$/i.test(o.outcomeName.trim()));
  const under = m.outcomes?.find((o) => /^under$/i.test(o.outcomeName.trim()));
  return Boolean(over && under);
}

export function listMatchTotalsMarkets(
  catalog: OddsPapiMarketDefinition[],
  sportId: number,
): OddsPapiMarketDefinition[] {
  return catalog.filter((m) => m.sportId === sportId && isMatchTotalsMarket(m));
}

export function getOverUnderOutcomeIds(m: OddsPapiMarketDefinition): {
  overOutcomeId: string;
  underOutcomeId: string;
} | null {
  const over = m.outcomes?.find((o) => /^over$/i.test(o.outcomeName.trim()));
  const under = m.outcomes?.find((o) => /^under$/i.test(o.outcomeName.trim()));
  if (!over || !under) return null;
  return {
    overOutcomeId: String(over.outcomeId),
    underOutcomeId: String(under.outcomeId),
  };
}
