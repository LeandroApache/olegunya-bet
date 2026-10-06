# OddsPapi Phase 1

Automates finished-fixture import into existing `Match` / `MatchComputed` using the **same** calculation path as manual match creation.

> **1X2 probabilities are intentionally not de-vigged** because OddsPapi import must preserve the application's existing calculation model (dirty implied `p = 1/k`, existing deltas, derby, WLS).

## Env

```bash
ODDSPAPI_API_KEY=...
```

Never expose the key to the frontend.

## Sport markets

Configured in `odds-papi.sport-config.ts`:

| Sport | OddsPapi sportId | Closing 1X2 market | Outcomes |
|-------|------------------|--------------------|----------|
| FOOTBALL | 10 | `101` Full Time Result | 101/102/103 Home/Draw/Away |
| HOCKEY | 15 | `153` Regular Time Result | 153/154/155 Home/Draw/Away |

Hockey uses **regulation time** only (not OT/shootout moneyline).

## Closing cutoff

```text
closingCutoff = trueStartTime ?? startTime
```

For Home / Draw / Away independently:

- `active === true`
- `createdAt <= closingCutoff`
- pick latest `createdAt`

Timestamp skew between outcomes is allowed.

## Totals (`Match.total`)

Only the **line** is stored (no Over/Under prices on Match).

1. Load OddsPapi `/markets` catalog once (process cache by TTL; filtered by `sportId`).
2. Keep markets where:
   - `period = fulltime`
   - `marketType = totals`
   - `playerProp = false`
   - outcomes include Over + Under
   - exclude 1st half / team totals / OT / BTTS / corners / etc.
3. For each candidate line, take closing Over & Under (same cutoff rules).
4. **Selection-only** normalize:

```text
pOverRaw = 1/over
pUnderRaw = 1/under
distanceFromEven = abs(pOverRaw/(pOverRaw+pUnderRaw) - 0.5)
```

Pick minimum distance. This normalize is **not** used for MatchComputed.

If no valid total: import match anyway with `total = null`.

## Pipeline

```text
fixtures (tournament + date range)
  → skip if Match already has (ODDSPAPI, externalFixtureId)  [no historical-odds call]
  → require ExternalTeamMapping (no name guessing)
  → historical-odds (Pinnacle)
  → closing 1X2 (sport-specific market)
  → select total line (optional)
  → MatchService.upsertImportedMatch → dirty/derby calc → MatchComputed
```

Strength remains manual via `createStrengthSnapshot`.

## GraphQL

| Op | Purpose |
|----|---------|
| `oddsPapiTournaments(sportKey)` | browse tournaments |
| `upsertExternalLeagueMapping` / `delete…` / `externalLeagueMappings` | league ↔ tournament |
| `upsertExternalTeamMapping` / `delete…` / `externalTeamMappings` | team ↔ participant |
| `previewOddsPapiFixtures` | dry-run mapping flags |
| `importOddsPapiFixtures` | import |

Result counts: `fixturesFound`, `imported`, `alreadyImported`, `unmapped`, `missingOdds`, `failed`, `importedWithoutTotal`, plus `skips[]` (`MISSING_PINNACLE_1X2`, `UNMAPPED_*`, …).

## API quota

- `/markets` cached in-memory (hours)
- Already-imported fixtures skip `/historical-odds`
- Historical-odds calls are rate-limited (~5.1s cooldown)

## Migration

`prisma/migrations/20261006220000_add_oddspapi_external_mappings`
