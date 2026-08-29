# Metrics 021 (Surface & Environmental Context) and 022 (Serve/Return Shot-Level Efficiency) — Sequential Audit Record

Status: 021 PARTIAL (thin, evidence-basis flagged) / SOURCE REQUIRED. 022
FIXED: reclassified PROTECTED_UNAVAILABLE.

**First audit for both codes.** `docs/evidence-coverage/81-metric-recoverability-audit.md`
previously labeled 021 "Elo Delta" and 022 "H2H Similar-Conditions" —
neither name exists in `public/seed/metrics.txt`. Real 021 is "Surface &
Environmental Context" (15 named bullets); real 022 is "Serve/Return
Shot-Level Efficiency" (~26 named bullets, spanning a page break in the
source document — verified this is one continuous section, not two,
since no numbered heading appears between "22. Serve/Return..." and "23.
Matchup-Adjusted Metrics").

## Metric 021 — Surface & Environmental Context

### 1. Exact master definition
Authoritative source: `public/seed/metrics.txt`, section 21. 15 bullets:
Surface-Transition Performance, Tournament-Round Performance,
Home-Country/Home-Continent Effects, Altitude Sensitivity,
Ball/Court-Speed Interaction, Weather Sensitivity, Age/Development Curve,
Inactivity Decay, Schedule Density (14/30 Days), Opponent
Retirement-Adjusted Records, Match-Quality-Adjusted Straight-Set Rate,
Expected-Games vs Actual-Games Dominance, Luck/Regression Indicators,
Bayesian Uncertainty/Confidence Intervals, Data-Source Agreement.

### 2. Permitted raw inputs
Chronological per-player match history (for the results/schedule-derived
bullets: surface transitions, round-by-round results, age/layoff timing,
schedule density, retirement-adjusted records, straight-set rate,
games-won expectation). Weather Sensitivity and Altitude Sensitivity
specifically need each player's own *historical* performance correlated
against the ambient conditions (temperature/humidity/wind/altitude) at
each of those past matches — not a single current-match reading.

### 3. Sources inspected
- `src/lib/deterministic-environment-metrics.server.ts` (`deterministicEnvironmentMetric`) — the only wired engine that ever produces a "021" finding. Queries Open-Meteo hourly weather (`source_id="open_meteo"`, `observation_type="ENVIRONMENT"`) for the tournament/date window only.
- `src/lib/metric-source-family-policy.ts` — confirms `RESULTS_SCHEDULE` is the only *sufficient* family for 021 (`sufficient.add("RESULTS_SCHEDULE")` when `code==="021"`); `ENVIRONMENT` is `allowed` but support-only, per the file's own header comment (added specifically for 021: "RESULTS_SCHEDULE remains the only sufficient family for 021... this only makes ENVIRONMENT support-only, so it can enrich but never single-handedly promote a 021 finding to DIRECT/RECONSTRUCTED").
- `src/lib/deterministic-results-schedule-metrics.server.ts` — checked its `SCHEDULE_SUPPORTED`/`HISTORICAL_SUPPORTED` sets; **021 is in neither.** No RESULTS_SCHEDULE-based engine for 021 exists anywhere in this repository.
- `src/lib/hybrid-audit-research.server.ts`'s `SUMMARY_KEYS["021"]` — lists only raw match-context fields (surface type, court speed, temperature, humidity, wind, altitude, roof state), none of which are any of 021's 15 named bullets themselves; they're inputs a real computation would need, not outputs matching the definition.

### 4. P1/P2 orientation
`deterministicEnvironmentMetric` returns the **identical value string for both `p1` and `p2`** (`p1_value: value, p2_value: value` — literally the same variable). This is honest for what it actually reports (ambient weather at a shared venue/date is not player-specific), but it means this engine has never produced player-specific evidence for 021 at all — only shared match context.

### 5. Treatment classification — real finding, not fixed this pass

**Current live behavior:** `deterministicEnvironmentMetric` unconditionally returns `treatment: "PARTIAL"` for 021 using only `ENVIRONMENT`-family data (today's temperature/humidity/precipitation/wind/gust/pressure at the tournament).

**Problem found:** this contradicts the project's own stated policy for this exact code. `metric-source-family-policy.ts` explicitly documents that `ENVIRONMENT` is *support-only* for 021 — meant to enrich a `RESULTS_SCHEDULE`-based finding, never to single-handedly produce one. But no `RESULTS_SCHEDULE` engine for 021 exists, so in practice `ENVIRONMENT` alone is the *entire* basis for every 021 finding this system has ever produced — the opposite of the documented intent. Separately, even judged on its own terms, raw ambient weather is not itself evidence for "Weather Sensitivity" or "Altitude Sensitivity" (both need the player's *own historical performance* correlated with those conditions across many matches, not a single current reading) — this is the same "generic context reported as if it satisfies a specific named bullet" pattern this project's own HOUSE_RULES exist to catch.

**This is the same class of issue already open at `docs/evidence-work-blockers.md` item 4**, which flagged codes 060/071 sharing this same `deterministicEnvironmentMetric` engine for a near-identical concern (ENVIRONMENT eligibility that may not match the real definition). Unlike 060 (where no comment defends the ENVIRONMENT grant), 021's grant *is* explicitly defended in `metric-source-family-policy.ts` — but as support-only, and the engine does not honor that distinction. Given the shared, four-code (021/030/060/071), CI-tested engine and the explicit precedent of leaving item 4 open pending a human decision rather than a unilateral same-session change, **this pass documents the finding but does not change `deterministic-environment-metrics.server.ts`'s behavior.** Treatment stays PARTIAL as currently emitted; this document flags it as evidence-thin rather than asserting it is wrong to leave as-is.

### 6-9. Reconstruction / provenance / cross-wiring / recovery status
Not attempted this pass beyond what's documented above — the real fix
(building a genuine `RESULTS_SCHEDULE`-based engine for the many
legitimately-reconstructable bullets: Surface-Transition Performance,
Tournament-Round Performance, Age/Development Curve, Inactivity Decay,
Schedule Density, Opponent Retirement-Adjusted Records,
Match-Quality-Adjusted Straight-Set Rate) is real, buildable engineering
work, not a same-pass audit fix, and is logged here as the concrete next
step rather than attempted partially.

### 10. Regression protection
None added for 021 this pass — no code changed. The existing
`deterministic-environment-metrics`-adjacent tests are unaffected.

---

## Metric 022 — Serve/Return Shot-Level Efficiency — FIXED this pass

### 1. Exact master definition
Authoritative source: `public/seed/metrics.txt`, section 22 (spans a page
break; confirmed one continuous section). ~26 bullets, all requiring
shot-by-shot outcome, direction, depth, or rally-position data: Serve +1
Effectiveness, Return +1 Effectiveness, Unreturned Serve Rate,
Return-in-Play Rate, Second-Serve Attack Rate, Second-Serve Punishment
Differential, First-Strike Win Rate, Neutral-Rally Win Rate, Defensive
Conversion Rate, Attack-to-Defense Transition Efficiency, Forced
Short-Ball Generation, Short-Ball Conversion Rate, Depth Consistency,
Baseline Error Tolerance, Backhand Tolerance Under Pressure, Forehand/
Backhand Damage Rate, Crosscourt vs Down-the-Line Efficiency, Inside-Out
Forehand Effectiveness, Slice Exposure Rate, High/Low-Ball Tolerance,
Wide-Ball Recovery Rate, Court Recovery Speed Proxy, Net-Approach
Quality, Passing-Shot Success Rate, Lob Effectiveness.

### 2. Permitted raw inputs
Charted serve+1/return+1 shot outcomes, rally-state labels, shot
direction/depth, and similar shot-level tracking data.

### 3. Sources inspected
- Approved BSD PBP adapters (all four tours) — confirmed, again, point winner and score state only; no shot-level outcome, direction, depth, or rally-position field anywhere in the schema (same conclusion already independently reached for codes 017, 054, 074).
- Four-tour historical results (`runtime-tennis-index`) — match-level only.
- `source_observations` table — no shot-tracking `observation_type` exists.
- `src/lib/metric-certification.ts`'s registered `"022"` policy — already correctly catalog-aligned (`permittedRawInputs`: charted serve+1/return+1 outcomes, rally-state labels, shot-level outcomes), confirming a prior pass already understood 022's real requirements but never formalized the conclusion.
- `src/lib/historical-results-recovery.ts`'s own Task 20 comment: "022... [has a] correctly real-catalog-aligned metric-certification.ts polic[y] requiring shot-level/serve-decay data this repository does not have; [its] best plausible real home... [is] non-existent."
- `docs/evidence-work-blockers.md` item 2 (pre-existing): "code 022... isn't in any `deterministic-*-metrics.server.ts` SUPPORTED/OWNED set... not confirmed anywhere in the approved evidence universe anyway. Not attempted; flagged as a build item, not a fix."
- Repo-wide search confirmed **zero** deterministic engines reference `"022"` anywhere.
- `protected-metric-wiring.server.ts`'s live web-search LLM researcher — checked and found not practically productive for this fact type, same as every sibling shot-level PROTECTED_UNAVAILABLE code.

### 4-5. Orientation / treatment
Not applicable — no engine exists to produce a finding, oriented or
otherwise.

### 6-9. Reconstruction / provenance / cross-wiring / recovery
No reconstruction possible; no raw fields exist anywhere in this
project's approved evidence universe.

### 10. Fix applied this pass

Three independent, converging pieces of evidence (a registered
certification policy nobody could ever satisfy, an explicit prior Task 20
comment reaching the same conclusion, and an already-open blocker-log
note) all agreed 022 has no legitimate evidence pathway — but nothing had
ever formalized that into the canonical `metric-classification.ts`
registry, meaning code 022 was silently sitting inside the 60-code
player-evidence denominator as permanently unfillable, forever dragging
down any coverage percentage without ever being honestly excluded the way
its shot-level siblings (017, 054, 074) already are.

**Fixed:**
- Added a full `PROTECTED_UNAVAILABLE` record for `"022"` to
  `src/lib/metric-classification.ts`, matching the format and rigor of
  its 14 siblings (all four required sources checked, explicit reason,
  `whether_future_ingestion_could_change_status: true` since a future
  charted-shot dataset could change this).
- Removed `"022"` from `RESULTS_SCHEDULE_METRICS` and `PBP_METRICS` in
  `src/lib/metric-source-family-policy.ts` — both had it listed despite
  neither family being able to satisfy any of its real bullets; per that
  file's own rule, `PROTECTED_UNAVAILABLE` codes must never receive any
  family eligibility.
- Updated `src/lib/audit-pipeline.test.ts`'s hardcoded
  `realProtectedUnavailableCodes` list (14 → 15 entries) — a real
  blast-radius hit, confirmed and fixed: the live pipeline correctly
  reads from the canonical registry and now excludes M22 from research
  the same way it excludes the other 14, which the test's stale hardcoded
  list didn't yet expect.

**Denominator effect:** the true legitimate player-metric denominator
drops from 60 to 59 (81 − 7 `META_OR_NON_PLAYER` − 15
`PROTECTED_UNAVAILABLE`); the metric-tour denominator from 240 to 236;
the 70% target from 168 to 166 cells. See
`docs/evidence-work-blockers.md` item 0 for the running total.

Certification: FIXED. Real denominator correction, not evidence
inflation or deflation of anything that was ever actually usable — 022
was never producing real evidence; it is now honestly excluded instead of
silently uncounted-for.
