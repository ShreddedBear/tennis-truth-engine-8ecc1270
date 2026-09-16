# ATP Challenger 2018-2024 PBP Availability Audit

Generated: 2026-09-16T13:55:17.104712+00:00

## Year-by-year

| Year | Historical Matches | PBP Candidates | Structurally Validated | Certified | Review | Ambiguous | Conflict | Rejected | Aggregate-only | Unresolved | BSD status |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 2018 | 4,684 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 4,641 | 43 | SPOT_PROBED_ONLY_NOT_EXHAUSTIVE |
| 2019 | 3,244 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3,190 | 54 | SPOT_PROBED_ONLY_NOT_EXHAUSTIVE |
| 2020 | 2,184 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2,162 | 22 | SPOT_PROBED_ONLY_NOT_EXHAUSTIVE |
| 2021 | 4,344 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 4,108 | 236 | SPOT_PROBED_ONLY_NOT_EXHAUSTIVE |
| 2022 | 5,391 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 5,285 | 106 | SPOT_PROBED_ONLY_NOT_EXHAUSTIVE |
| 2023 | 5,693 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 5,591 | 102 | SPOT_PROBED_ONLY_NOT_EXHAUSTIVE |
| 2024 | 6,063 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 5,861 | 202 | EXHAUSTIVELY_SCANNED_ZERO_MATCHES_LISTED |

## Headline answer

**Additional true chronological PBP recoverable from already-configured sources: 0**

Both PBP sources hardcoded in this codebase (ppaulojr GitHub archive/current, and the BSD/Bzzoiro API) were checked for 2018-2024. The ppaulojr source was exhaustively fetched and its date column counted row-by-row in this session: its real coverage is 2010-2015, confirmed zero rows for 2018-2024. The BSD source could not be called live in this session (no BSD_TENNIS_API_KEY here), but the repo's own already-committed evidence -- an exhaustive full-year scan for 2024 (0 ATP Challenger matches listed) and 3-sample boundary probes for 2010-2023 (0/3 listed every year) -- both point the same way: this provider's match catalog does not reach back into 2018-2024 for ATP Challenger, independent of PBP availability specifically.

**Caveat**: 2018-2023 BSD absence is corroborated by a spot probe (3 samples/year), not an exhaustive scan, because this session lacks the API credential to run one. If that credential becomes available, running scripts/bsd-atp-challenger-pbp-history.py --year 2023 (and 2022, 2021...) exhaustively is the one remaining already-configured, not-yet-fully-executed action before concluding a genuinely new provider is required. 2024 is exhaustively confirmed zero, no caveat.

**Aggregate-tier recoverable (not chronological PBP): 30,838 matches**
