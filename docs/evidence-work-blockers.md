# Evidence-Coverage Work — Open Blockers

Running log of blockers hit during the sequential metric-audit series
(docs/metric-audit-*.md) that could not be resolved from this sandbox, kept
so they can be picked up and actually fixed later rather than silently
skipped.

## 0. `docs/evidence-coverage/81-metric-recoverability-audit.md` used the wrong metric names for 68 of 81 rows (FOUND AND PARTIALLY FIXED 2026-08-29, OPEN)

Attempting to re-audit metric 004 ("Break-Point Performance" per the
recoverability audit and per this ticket's own Phase-1 priority list)
against BSD PBP found there is no such metric at code 004 in
`public/seed/metrics.txt` — real code 004 is **"Combined Efficiency"**.
Checking the rest of the Phase-1 list, then every row in the table, found
this is systemic: 68 of 81 rows named a metric that does not match its own
code number in the authoritative catalog. This is the exact same
code/name-mismatch defect class already found and fixed piecemeal elsewhere
in this project (036/040/069/079/060 in `pbp-score-state-recovery.ts` and
`newly-green-end-to-end-coverage-audit.test.ts`) — it turns out to be the
norm for this particular document, not an exception.

**Root cause:** `metric-classification.ts`'s own header comment already
documents that `public/seed/metrics.txt` has an embedded "120-Match
Empirical Overlay" sub-section whose internal Tier numbering once collided
with the real sequential section numbering in a naive parser pass,
corrupting codes 004-006 specifically. The 81-row recoverability audit
appears to have been produced independently of that later-corrected
registry (`metric-classification.ts`), and diverges far beyond just
004-006 — it does not track the real catalog for almost any code past 005.

**Fixed this pass:** every row's Metric name corrected against
`public/seed/metrics.txt` directly. For the 13 codes with an existing,
evidence-verified `docs/metric-audit-0XX-*.md` (001, 002, 003, 007, 008,
009, 010, 011, 012, 013, 019), that doc's real classification now populates
the row. The other 68 rows are marked `UNVERIFIED` rather than guessed at —
their old classification/evidence-basis text was written for a different
metric and is not valid evidence for the real one at that code. The
document's Scope/Accounting, Evidence Inventory, and Classification Totals
sections were rewritten to stop asserting coverage percentages and
"55/81 potentially usable" / "47 metric equivalents" figures computed
against the wrong names — those are explicitly retracted, not restated.

**Still open:** the 68 UNVERIFIED codes each need the same five-step audit
(exact definition → permitted raw inputs → sources inspected → treatment
classification → cross-wiring audit → regression test) the 13 already-done
codes got. `RECOVERY_PRIORITY_CODES` and any Phase 2 wiring plan drawn from
the old totals is not valid until re-derived from real classifications.
This is a large amount of remaining work, not a one-line fix — flagged here
so a future pass picks it up systematically rather than re-discovering the
mismatch from scratch.

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

**Update (next pass):** 072/073/074/076 confirmed moot as above (still
`PROTECTED_UNAVAILABLE`, still dead code in production). 075 checked: it has
its own dedicated, purpose-built provenance firewall
(`metric-wiring-072-076.server.ts`'s `enforceMetricWiring072076`, chained
into the live `finalMetricWiringResearcher`), which requires the research
text to carry explicit `PLAYER=`/`SOURCE=`/`SAMPLE=` tags and validates the
source is a genuine matching public URL -- a stricter, code-specific
mechanism than the generic keyword-based `certifyMetricFinding`, and it
already has four dedicated test files
(`metric-postfix-wiring-072-076.test.ts`,
`metric-postfix-wiring-072-076-mixed.test.ts`,
`metric-wiring-072-076-provenance.test.ts`,
`metric-certification-072-076.test.ts`). No gap found; left alone.

**Still genuinely open:** code 022 (Serve/Return Shot-Level Efficiency) has a
registered certification policy but **no deterministic engine anywhere** --
it isn't in any `deterministic-*-metrics.server.ts` `SUPPORTED`/`OWNED` set,
so it falls through entirely to the live AI web-search researcher with no
local warehouse evidence at all. That's not a wiring-gap bug the way 012/019
were (there's no incorrect local finding to catch) -- it's a missing engine,
a real feature to build (would need charted serve+1/return+1 shot-outcome
data, which per `metric-classification.ts` isn't confirmed anywhere in the
approved evidence universe anyway). Not attempted; flagged as a build item,
not a fix.

**Re-confirmed 2026-08-29** (Truth Engine metrics-recovery ticket, Phase 0):
identical `403` from the egress gateway's CONNECT tunnel to
`teblxzfqdqzwwooswncc.supabase.co:443`, both via direct `curl` and via
`$HTTPS_PROXY/__agentproxy/status`'s `recentRelayFailures` (`connect_rejected`,
"gateway answered 403 to CONNECT (policy denial or upstream failure)"). This
is the third session in which this exact host produces the same 403 with no
change in behavior — treat it as a standing, non-transient property of this
sandbox's network policy, not something to keep re-testing per session.

**Standing workflow (adopted this pass, per the ticket's Phase 0.2):** any
task step that requires confirming live-database state — row counts, date
ranges, whether `source_observations` actually has rows for a given
metric/tour cell, the 324-cell coverage recount — cannot be completed from
a Claude Code Remote/sandbox session against this project. Split such work
into two steps: (1) write/update the code and tests here, where full
static analysis, local file/test evidence, and the existing test suite are
available; (2) run the actual live-DB verification query from a session
with real network access to `*.supabase.co` — Replit's own Shell has been
confirmed to have this in prior sessions, or the user's own machine. Do not
re-attempt the Supabase connection from this sandbox on future passes;
check this file's timestamp instead and treat the constraint as still
current unless a session with real DB access has since confirmed otherwise.
Also note: `bun install`'s configured private registry (`*.pkg.dev`) is
separately blocked from this sandbox (403) — `npm install` against the
default `registry.npmjs.org` works and was used instead to run the test
suite this pass.

## 3. Metric 001 (Surface Strength) treatment needs an owner decision — RESOLVED 2026-08-29

`task18c-rank-form-workload.ts`'s live engine for code 001 unconditionally
returns `treatment: "RECONSTRUCTED"` while only ever delivering 2-3 of the
metric's 8 named submetrics (see
`docs/metric-audit-001-surface-strength.md` for the full breakdown -- Surface
Elo and, after this pass, a correctly-computed Elo Win Probability; missing
Effective Weighted Sample, Surface Elo Trend/Momentum, Peak Elo vs Current
Elo, and both Hard-Court Record bullets). This project's own stated rule
(`audit-research.server.ts`'s HOUSE_RULES: "RECONSTRUCTED is allowed only
when every required component of the exact definition/formula is sourced")
would suggest this should be PARTIAL, not RECONSTRUCTED.

**Resolved 2026-08-29:** changed to `PARTIAL` per that same house rule, after
confirming the treatment constant is scoped only to code 001
(`HISTORY_CODES` is locked to `["001"]`) and that no other consumer reads
the `treatment` field off this engine (`historical-twin-match-search.server.ts`
uses `replayElo` directly). `task18c-rank-form-workload.test.ts` updated;
full 534-test suite passes. See `docs/metric-audit-001-surface-strength.md`
§5 for the full blast-radius check. Historical context below, left as
originally written: an existing test (`task18c-rank-form-workload.test.ts`)
explicitly asserted RECONSTRUCTED, meaning a prior session already reviewed
and set this intentionally, and 001 is foundational enough (several other
engines build
on its Elo replay) that downgrading its treatment deserves a deliberate
decision by whoever owns that test's intent, not a unilateral change. Fixed
what was safe to fix unilaterally (the win-probability formula gap, purely
additive, no existing assertion touched) and logged the treatment question
here instead of guessing at it.

## 4. Metric 060's ENVIRONMENT family eligibility looks like a missed reconciliation case (OPEN, likely real, not fixed)

`deterministic-environment-metrics.server.ts` computes only raw ambient
weather (temperature/humidity/precipitation/wind/gust/pressure from
Open-Meteo) and applies the identical output uniformly to **four** codes:
021, 030, 060, 071 (`SUPPORTED = new Set(["021","030","060","071"])`, gated
by `ENVIRONMENT_METRICS` in `metric-source-family-policy.ts` and asserted as
"intentional" in `docs/NEWLY_GREEN_COVERAGE_AUDIT.md` and CI-tested in
`newly-green-end-to-end-coverage-audit.test.ts`'s `REQUIRED_FAMILIES`/
`PBP_METRICS`).

Checked all four against their real `public/seed/metrics.txt` definitions:
- **021** (Surface & Environmental Context) genuinely names weather
  sensitivity and altitude among its 15 bullets -- legitimate, and already
  correctly capped at PARTIAL/support-only (RESULTS_SCHEDULE is the only
  *sufficient* family; see the reconciliation comment already in
  `metric-source-family-policy.ts`).
- **030** (Tournament-Specific Strength) has one loosely-related bullet
  ("Performance in Comparable Environmental Conditions") among 12, but the
  other 11 are court-speed/altitude/ball-type-specific Elo variants and
  tournament-specific historical Elo -- not raw ambient weather. Marginal.
- **060** (Interaction / Matchup Residuals) -- Serve-Return Interaction
  Residual, Opponent-Adjusted Shot Tolerance, Neutral-Point Win Rate,
  First-Strike Dependency, Serve Dependency Index -- has **zero** bullets
  touching weather, altitude, or any environmental condition at all.
- **071** (Session/Environment) is Roof-Open-vs-Closed Split and
  Start-Time-Uncertainty -- about roof *state* and *scheduling*, not ambient
  outdoor conditions; raw outdoor weather is a poor and potentially
  misleading proxy for a match that may have been played indoors under a
  closed roof (no roof-state field is ever consulted by this engine).

This is the same class of "wrong code number" drift that Task 19/20
explicitly found and fixed for sibling codes 036, 040, 069, 079, and 081 --
see the reconciliation comment at the top of
`newly-green-end-to-end-coverage-audit.test.ts`, which documents removing
each of those after checking their real definitions directly. 060 (and to a
lesser extent 071) reads like the same kind of case that was simply missed
in that pass, not a considered decision -- there's no comment anywhere
explaining *why* 060 specifically should accept weather evidence, unlike the
021 case, which does have one.

**Not fixed this pass.** Reversing this touches a documented, CI-tested
contract across at least four files (`deterministic-environment-metrics.server.ts`,
`metric-source-family-policy.ts`, `newly-green-end-to-end-coverage-audit.test.ts`,
`docs/NEWLY_GREEN_COVERAGE_AUDIT.md`), and — learned directly from this
session's reverted `deterministic-pbp-metrics.server.ts` attempt — a
"looks like a bug" call on a case with existing test coverage deserves the
same Task-19/20-grade verification (confirm no downstream evidence-coverage
math or reliability scoring depends on 060/071 keeping ENVIRONMENT support)
before changing it, not a same-session unilateral edit. Flagged here with
the specific evidence needed to make that call quickly.

**Update — confidence lowered, still not fixed.** Went looking for the
multi-file fix and found `protected-metric-wiring.server.ts` has an
extensive, clearly deliberate `PROTECTED_COMPONENTS["060"]` list (11
correctly-named sub-items matching the real definition exactly: serve-return
interaction residual, neutral-point win rate, first-strike dependency,
etc.), a dedicated forbidden-proxy-input list for 060's AI-generated
FORMULA text, and a dedicated test file
(`metric-certification-060-065.test.ts`) that explicitly rejects generic
proxies like `hold_pct=81%` as evidence for 060. Whoever built that clearly
read metric 060's real definition carefully -- which weakens (doesn't
disprove) the "060 = ENVIRONMENT is a missed reconciliation case" theory,
since the same rigor that correctly listed 060's 11 real sub-items would be
expected to also have caught an unrelated ENVIRONMENT grant if it were
obviously wrong. Neither that test file nor `deterministic-environment-metrics.server.ts`
mentions weather/temperature as either accepted or rejected for 060 -- the
question was apparently never directly considered by whichever pass
reviewed each file, so this is still unresolved rather than debunked. Given
the genuine uncertainty and the multi-file blast radius, still not changed.
This needs someone to trace whether `deterministic-environment-metrics.server.ts`'s
ENVIRONMENT grant for 060 was a deliberate call or an oversight -- static
reading from this sandbox can't settle it further.

## 5. Root-level backup/export files are not in this git checkout at all (2026-08-29)

The metrics-recovery ticket's Phase 4 housekeeping item asked to reconcile
`bucket-database_export_28_08_26-files.zip` and
`tennis-truth-engine_260828.backup` at the repo root. Neither file exists in
this Claude Code Remote sandbox's checkout of the repository: `ls` finds
nothing at either path, `git log --all` finds no commit ever touching either
filename, `git ls-files` finds no tracked file matching `*.zip`/`*.backup`
at the root, and neither name appears in `.gitignore`. They must exist only
in the Replit filesystem (or another environment) outside what this
sandbox's git clone contains -- there is nothing here to move, label, or
diff against. This needs whoever has access to that Replit filesystem (or
wherever these files actually live) to do the reconciliation the ticket
asked for; it cannot be done from a plain git checkout.
