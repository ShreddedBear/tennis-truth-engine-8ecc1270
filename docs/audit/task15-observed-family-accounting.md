# Task 15 — Observed-Family Accounting Repair

Scope: source-availability vs software-failure accounting only.

- Runtime diagnostics now publish the evidence families actually observed for each metric/matchup.
- PBP_EXISTS_NOT_WIRED requires observed POINT_BY_POINT evidence.
- MARKET_EXISTS_NOT_WIRED requires observed MARKET evidence.
- Expected/allowed source-family policy alone cannot prove that evidence exists.
- Repository-evidence software loss requires explicit repository evidence signals rather than inference from RESULTS_SCHEDULE applicability.
- Existing 81-metric audit, four-tour sampling, coverage-credit, and false-green behavior are preserved.

Validation on the repair branch:
- focused evidence-availability accounting regression: PASS
- full Vitest suite: PASS
- production build: PASS
