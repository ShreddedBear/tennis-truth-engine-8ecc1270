# Historical Hard Pull source inventory

This document locks the exact original tennis sources before further repair work. It is intentionally source-specific and is not a broad revert plan.

## Original ATP / WTA / ATP Challenger results + schedule sources

Introduced by commit `0d34dd100b15478824cbd04a07d1636a5aff7805` (`Add ATP WTA Challenger results and schedule ingestion`).

Implementation file: `src/lib/ingestion/tour-results-schedule.server.ts`.

Original source identities and URLs:

- ATP Main — `ATP Tour Official` — `https://www.atptour.com/en/scores/current`
- WTA Main — `WTA Official` — `https://www.wtatennis.com/tournaments`
- ATP Challenger — `ATP Challenger Tour Official` — `https://www.atptour.com/en/scores/current`

The original adapter was designed to permit year/archive URLs to be supplied later without changing the source identity. ATP Main and ATP Challenger must remain isolated by competition level.

## Original ATP / WTA rankings sources

Introduced by commit `e06a55dbfffc49a4730cf18c640b1e43ceaf4c52` (`Add ATP WTA ranking history ingestion and calculators`).

Implementation file: `src/lib/ingestion/tour-rankings.server.ts`.

Original source identities and URLs:

- ATP rankings — `ATP Rankings Official` — `https://www.atptour.com/en/rankings/singles`
- WTA rankings — `WTA Rankings Official` — `https://www.wtatennis.com/rankings/singles`

## Later intermediate sources that are NOT the original source definition

- ProTennisLive API/feed logic was added later. It is not required by the original `0d34dd1` source definition and must not require `PROTENNISLIVE_API_KEY`.
- Jeff Sackmann ATP CSV ingestion was introduced later by `889aa04ebfba743874ebc9f488f46b1991dc62fa`. It remains fallback-only/on hold and must not silently replace the original official sources.

## Repairs that must be preserved

Do not undo these later safeguards while repairing the source adapters:

- WTA observation conflict-index/upsert repair merged in `4d2ad4756603837a1ebefe2170e0719d74401e7b`.
- Historical Hard Pull false-green/persistence-proof behavior from `75d9fc9494fa5beb718ced8e75d49ff78430a1a3c2` and later persistence-confirmation work.
- Active-repository OIDC transfer repair from `c0d8070079849d0a84cb39329d8e7b78f18b67bc`.
- ATP Main / ATP Challenger / WTA Main source-family isolation and no-fabrication guards.

## Validation rule

The repair is not validated until database queries confirm persisted records for each intended source identity:

- `atp`
- `wta`
- `atp_challenger`
- `atp_rankings`
- `wta_rankings`

A green workflow alone is insufficient.
