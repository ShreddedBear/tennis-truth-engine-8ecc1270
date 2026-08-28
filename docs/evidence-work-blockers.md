# Evidence-Coverage Work — Open Blockers

Running log of blockers hit during the sequential metric-audit series
(docs/metric-audit-*.md) that could not be resolved from this sandbox, kept
so they can be picked up and actually fixed later rather than silently
skipped.

## 1. No network path to Supabase from this sandbox (OPEN)

**Blocks:** verifying any metric wired through the live `source_observations`
table -- i.e. everything owned by `deterministic-ranking-metrics.server.ts`,
`deterministic-market-metrics.server.ts`, `deterministic-pbp-metrics.server.ts`,
`deterministic-environment-metrics.server.ts`,
`deterministic-results-schedule-metrics.server.ts`,
`deterministic-rules-context-metric.server.ts`,
`deterministic-historical-results-metrics.server.ts`, and
`source-observation-metric-bridge.server.ts`. Together these own codes 001,
012, 014, 015, 016, 019, 021, 024, 025, 028, 030, 033, 042, 043, 044, 060,
064, 071, 076, 077, 081, plus the TASK18A/18B/18C historical-results and PBP
code sets -- a large fraction of the 60 legitimate metric codes.

**What's blocked, specifically:** these files' code reads correctly (they
query `source_observations` with proper tour-circuit classification,
future-leakage guards, and alias matching), but whether that table actually
*has* rows for a given metric/tour/date range in production can only be
confirmed by querying the live database. Auditing them the way metrics
011-013 were audited (read the code, then prove the claim against real data)
is not possible here -- writing an audit doc for them right now would be
unverified guessing, exactly what this audit series exists to prevent.

**Root cause (confirmed twice, this session and the prior one):** this
Claude Code Remote sandbox's network policy allows outbound HTTP CONNECT to
port 443 in general, but the gateway returns a hard `403` (organization
policy denial, not a transient failure) specifically for the project's
Supabase host (`db.<ref>.supabase.co` on port 5432 is also unreachable --
no IPv6 route -- but that's a separate, secondary issue; the REST API over
HTTPS on port 443 is the one that matters here and it is a straight 403).
Per this environment's own operating rules, a 403 from the egress gateway is
an organization policy denial and must be reported rather than retried --
retried here anyway on this pass to confirm it wasn't a stale/transient
state, got the identical 403, and stopped.

**How to actually unblock this:** either (a) run this specific verification
work from an environment whose network policy allow-lists `*.supabase.co`
(a different Claude Code Remote environment configuration, or the user's own
machine/Replit shell), or (b) if there's a read-only reporting proxy/URL for
this database that isn't itself on `*.supabase.co`, point future audit work
at that instead. I don't have enough information about the account's
environment options to pick between these myself -- that's a decision for
whoever configures the environment.

**Workaround used instead:** kept auditing the *other* evidence layer --
static CSV files under `data/public/` read directly by
`hybrid-audit-research.server.ts` and its per-family modules
(`predixsport-recent.server.ts`, `availability-layoff.server.ts`,
`travel-burden.server.ts`, `datahub-atp-score-profile.server.ts`, etc.) --
since those I can open, read, and test against directly without any network
access. That's the actual coverage of the metric-audit-0XX.md series so far.

**Update (this pass):** this blocker turned out to be narrower than first
written above. *Data-population* verification for the `source_observations`-
backed engines is still genuinely blocked (whether the table has real rows
for a given metric/tour/date), but *pure logic/treatment-assignment* defects
in those same engines do not require live data to find or fix -- they're
provable by reading the code's own hardcoded output text against the
already-registered, already-tested certification policies in
`metric-certification.ts`. Two real bugs were found and fixed this way with
zero database access: metric 019 (`docs/metric-audit-019-market-calibration.md`)
and metric 012's second wiring path
(`docs/metric-audit-012-fatigue-workload-schedule-engine.md`). So: treat "no
DB access" as blocking *data-coverage* audits of these files, not as
blocking *all* work on them.

## 2. `certifyMetricFinding` is a blunt instrument -- don't apply it blindly (METHODOLOGY NOTE, not a blocker)

While closing the 012/019 gaps, the same defensive wrap (call
`certifyMetricFinding` on a live engine's return value) was tried on
`deterministic-pbp-metrics.server.ts` (codes 024/025, also
`CERTIFIED_METRIC_POLICIES` entries, also live-wired) on the theory that the
wrap is a safe no-op when the current treatment is already correct. It
wasn't safe there: it broke two tests in `deterministic-pbp-metrics.test.ts`
that deliberately keep aggregate-only BSD PBP data (real point/game totals
from an already tour-guarded, certified adapter, just missing per-metric
field derivation) at PARTIAL even though its summary text doesn't contain
024/025's expected keyword markers either. `certifyMetricFinding`'s
`exactInputMarkers` matching is keyword-based and can't tell "generic proxy
with zero real specificity" (the 012/019 bugs) apart from "genuine partial
evidence that just doesn't use the expected wording" (the PBP aggregate
case) -- both fail the same regex checks. That edit was reverted.

**Still open:** codes 022, 072, 073, 074, 075, 076 have registered
certification policies too. 072/073/074/076 are `PROTECTED_UNAVAILABLE` in
`metric-classification.ts`, so they're short-circuited to `NO_SOURCE` at
`instantiate()` before any research call happens -- auditing their
certification wiring is moot (dead code path in production) unless that
classification changes. 022 and 075 are not protected and are worth a real
look, but only with the same evidence-first method used for 012/019: find
the live engine, find its actual output text, check it against the policy's
markers, and -- critically -- check whether an *existing test already
approves the current behavior on purpose* before assuming a gap is a bug.
Not done yet this pass; noted here rather than guessed at.
