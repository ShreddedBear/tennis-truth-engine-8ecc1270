# Evidence Wiring Inventory — which metrics have a real live engine

Static, code-level inventory (not a live coverage percentage — that needs
database access this sandbox doesn't have, see
`docs/evidence-work-blockers.md` item 1). This counts **wiring**, not data
population: a code counted as "has an engine" can still return UNAVAILABLE
for a specific match if the underlying source has no rows for those
players/that date.

Of the 60 legitimate (non-`META_OR_NON_PLAYER`, non-`PROTECTED_UNAVAILABLE`)
metric codes:

## 34 codes already had a live DB-backed deterministic engine
`001`, `002`, `003`, `005`, `007`, `008`, `009`, `010`, `011`, `012`, `013`,
`014`, `015`, `016`, `017`(via TASK18A—kept out of `PROTECTED` on purpose,
see `historical-results-recovery.ts`), `018`, `019`, `020`, `021`, `024`,
`025`, `028`, `030`, `032`, `033`, `042`, `043`, `044`, `060`, `064`, `068`,
`071`, `075`, `076`(moot, `PROTECTED`), `077`, `080`, `081`(moot,
`PROTECTED`) — via `deterministic-ranking-metrics.server.ts`,
`deterministic-market-metrics.server.ts`,
`deterministic-environment-metrics.server.ts`,
`deterministic-results-schedule-metrics.server.ts` (including its
`historical-results-recovery.ts`/TASK18A delegate),
`deterministic-rules-context-metric.server.ts`, and the BSD-PBP-packet
recovery (`pbp-score-state-recovery.ts`/TASK18B + legacy PBP codes).

## 5 more codes now reachable for the first time via today's reconnection
`004` (Combined Efficiency), `006` (Opponent Quality), `023` (would need
checking against `SUMMARY_KEYS`'s exact code-to-definition match — flagged
for a future audit, not verified this pass), `035`, `055` — these have a
`SUMMARY_KEYS` entry in `hybrid-audit-research.server.ts` and/or WTA
official coverage, but no DB-backed deterministic engine. Before today's
fix (`docs/ARCHITECTURE-FINDING-disconnected-hybrid-researcher.md`) they
had **zero** local evidence source in production and relied entirely on
live AI search. They also act as a same-day fallback for the 34 DB-backed
codes above whenever Supabase genuinely lacks rows for a given
match/player, not just for these 5.

## 21 codes still have no local engine anywhere (live AI search only)
`022`, `026`, `027`, `029`, `031`, `034`, `036`, `037`, `038`, `039`, `040`,
`041`, `045`, `046`, `047`, `051`, `052`, `053`, `061`, `062`, `070`.

Each of these needs its own investigation before claiming it's a gap worth
closing — some may be correctly AI-only (e.g. genuinely requiring
web-searchable public-record facts), others may be a real missing engine
the way 022 (Serve/Return Shot-Level Efficiency — no charted serve+1/
return+1 dataset exists anywhere, confirmed in
`docs/evidence-work-blockers.md` item 2) turned out to be a missing-data
problem, not a missing-code problem. **Not audited individually this
pass** — this list is a map for the next pass, not a verdict on each code.

## How this list was built

Purely static: cross-referenced `metric-classification.ts`'s
`META_OR_NON_PLAYER`/`PROTECTED_UNAVAILABLE` exclusions against every
`SUPPORTED`/`OWNED`/`TASK18A_HISTORICAL_RESULTS_CODES`/`TASK18B_METRIC_CODES`
set actually imported by `warehouse-first-researcher.server.ts`'s live
chain, plus `hybrid-audit-research.server.ts`'s `SUMMARY_KEYS` and
`wta-official-match-evidence.server.ts`'s `SUPPORTED` set (both now
reachable per today's reconnection). No live data was queried or assumed;
this is "is there code that would run," not "does it return real evidence
for real matches today."
