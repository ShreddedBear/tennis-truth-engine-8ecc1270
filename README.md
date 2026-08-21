# Remix of Remix of Remix of Remix of Remix of Tennis Truth Engine

BUILD: TENNIS MATRIX INDEPENDENT VERIFICATION & AUDIT SYSTEM

============================================================

0. PURPOSE AND NON-NEGOTIABLE DESIGN PHILOSOPHY

============================================================

Build a production-grade Tennis Audit Verification System.

This system will:

1. Accept Tennis Matrix match-summary PDFs.

2. Parse every matchup contained in those PDFs.

3. Research Player 1 AND Player 2 independently using current web data.

4. Execute my complete Verification Metrics framework.

5. Execute my complete Verification Audit.

6. Execute my complete Disagreement / Trap Audit.

7. Execute my complete Dangerous Underdog Audit.

8. Execute all required stress/removal tests.

9. Reconstruct metrics when direct data does not exist and reconstruction

   is permitted.

10. Compare the independent audit to the Matrix only AFTER the independent

    conclusion is committed.

11. Apply my evolving 183 Final Record calibration.

12. Run the Final Combination Gate.

13. Assign DOUBLE GREEN / GREEN / YELLOW / RED-PASS / INCOMPLETE.

14. Produce one combined ranked board.

15. Generate a downloadable PDF matching my supplied Master Audit format.

16. Monitor match results.

17. Grade completed matches.

18. Automatically update the calibration ledger and Verified Win Rates.

19. Preserve every historical audit, source snapshot, calibration version,

    rule version, and generated report.

THIS IS AN AUDIT ENGINE.

IT IS NOT A CHATBOT THAT WRITES AN ANALYSIS AND THEN CLAIMS THAT THE

ANALYSIS WAS COMPLETED.

The application must prove execution through persisted state.

CORE RULE:

THE MATRIX MAY BE COMPARED TO THE AUDIT.

THE MATRIX MAY NOT DETERMINE THE AUDIT.

SECOND CORE RULE:

PLAYER 1 AND PLAYER 2 MUST ALWAYS BE EVALUATED SYMMETRICALLY.

THIRD CORE RULE:

NO EXECUTION RECORD = NO COMPLETION.

============================================================

1. REQUIRED MASTER WORKFLOW

============================================================

Every match must move through this pipeline:

SUMMARY PDF INGESTION

→ MATCH IDENTITY VERIFICATION

→ PRE-MATCH RESEARCH LOCK

→ CURRENT WEB DATA COLLECTION

→ P1 VS P2 FULL METRICS

→ RECONSTRUCTION OF PERMITTED MISSING METRICS

→ INDEPENDENT EVIDENCE CONCLUSION

→ VERIFICATION AUDIT

→ DISAGREEMENT / TRAP AUDIT

→ DANGEROUS UNDERDOG AUDIT

→ STRESS / COMPONENT-REMOVAL TESTS

→ MATRIX REVEAL AND COMPARISON

→ CURRENT CALIBRATION APPLICATION

→ FINAL COMBINATION GATE

→ DOUBLE GREEN / GREEN / YELLOW / RED-PASS / INCOMPLETE

→ MASTER RANKED BOARD

→ PDF REPORT

→ RESULT MONITORING

→ RESULT GRADING

→ CALIBRATION LEDGER UPDATE

→ NEW CALIBRATION VERSION

No required stage may be silently skipped.

============================================================

2. WORKFLOW EXECUTION STATES

============================================================

Every stage, rule, metric, pathway and test must have a persisted status:

NOT STARTED

RUNNING

COMPLETE

BLOCKED

UNAVAILABLE

FAILED

REQUIRES HUMAN REVIEW

Completion must be calculated by application logic.

The AI does NOT decide that an audit is complete.

============================================================

3. SUMMARY PDF INGESTION

============================================================

Create an upload area where I can upload:

- one match-summary PDF

- multiple PDFs

- one combined PDF containing many matches

- revised summary PDFs

- replacement summary PDFs

The system must read the ENTIRE PDF.

Automatically identify every distinct matchup.

Extract where available:

- Player 1

- Player 2

- tournament

- event level

- round

- date

- surface

- indoor/outdoor

- best-of

- Matrix predicted winner

- Matrix WP

- Monte Carlo result

- Monte Carlo probability/range

- DQ

- upset risk

- agreement

- matchup closeness

- Elo

- surface Elo

- recent form

- serve information

- return information

- market

- General Model

- Specialist Model

- H2H

- workload/fatigue

- style information

- every other field contained in the summary

Preserve:

- original PDF

- PDF version

- page number

- extracted text

- extracted value

- parser confidence

============================================================

4. PDF PARSING REVIEW

============================================================

Create a PDF Parsing Review screen.

Allow me to inspect and manually correct extracted values before the

official audit begins.

Never silently guess unreadable information.

Use:

DIRECT

RECONSTRUCTED

PARTIAL

UNAVAILABLE

EXCLUDED

============================================================

5. DUPLICATE MATCH DETECTION

============================================================

The same physical match may appear in multiple PDFs.

Detect duplicates using canonical match identity.

Do NOT create multiple physical matches.

Instead store:

MATCH

→ SUMMARY VERSION 1

→ SUMMARY VERSION 2

→ SUMMARY VERSION 3

Allow me to choose the active summary version.

Never grade the same physical match twice.

============================================================

6. MATCH IDENTITY LOCK

============================================================

Before calculations begin, verify:

- Player 1 canonical identity

- Player 2 canonical identity

- tournament

- tournament edition/year

- event level

- draw

- round

- scheduled date

- surface

- indoor/outdoor when available

- best-of

- match status

Create a canonical match key using fields such as:

event_id

+

draw_id

+

round

+

player_1_id

+

player_2_id

+

scheduled_date

Display:

MATCH IDENTITY VERIFIED

or:

MATCH IDENTITY CONFLICT

============================================================

7. PLAYER IDENTITY RESOLUTION

============================================================

Handle:

- accents

- transliterations

- initials

- abbreviated names

- alternate spellings

- duplicate surnames

Do not merge players merely because names look similar.

Use canonical player IDs.

============================================================

8. SURFACE VERIFICATION

============================================================

Surface is a critical input.

Verify:

- surface

- tournament edition

- indoor/outdoor

- venue where relevant

If the Matrix PDF and authoritative source disagree:

SURFACE CONFLICT

Do not use the disputed surface in dependent calculations until resolved.

============================================================

9. MATCH-LEVEL BLOCKING — NEVER GLOBAL

============================================================

THIS RULE IS CRITICAL.

A blocking condition applies ONLY to the affected match and ONLY to

calculations dependent upon the unresolved information.

NEVER stop, cancel or pause the entire slate because one match has a

problem.

Example:

If Match 17 of 60 has an unresolved surface conflict:

Matches 1–16 continue.

Matches 18–60 continue.

Match 17 continues all calculations that do not depend on surface.

Only its surface-dependent calculations remain blocked.

Its Final Combination Gate remains locked until the critical dependency

is resolved.

Use separate states:

BATCH STATUS:

RUNNING

COMPLETE

COMPLETE WITH UNRESOLVED MATCHES

MATCH STATUS:

RUNNING

PARTIALLY BLOCKED

READY FOR FINAL GATE

COMPLETE

INCOMPLETE

CALCULATION STATUS:

NOT STARTED

RUNNING

COMPLETE

BLOCKED

UNAVAILABLE

FAILED

CRITICAL LOGIC:

MATCH_BLOCKED != BATCH_BLOCKED

CALCULATION_BLOCKED != MATCH_PROCESSING_STOPPED

Block dependencies, not workflows.

============================================================

10. AUTOMATIC RECOVERY FROM BLOCKED DATA

============================================================

Continue researching blocked dependencies.

Once resolved:

1. update source record

2. recalculate dependent metrics

3. rerun affected Verification rules

4. rerun affected Disagreement rules

5. rerun affected underdog pathways

6. rerun affected stress tests

7. recalculate independent conclusion if necessary

8. compare Matrix if appropriate

9. reapply calibration

10. rerun Final Combination Gate

Do not restart the entire slate.

============================================================

11. RULE / KNOWLEDGE BASE

============================================================

Create a dedicated editable area containing four primary master

documents:

1. VERIFICATION AUDIT

2. DISAGREEMENT / TRAP AUDIT

3. VERIFICATION METRICS

4. FINAL RECORD / CALIBRATION

I must be able to:

- open the entire document

- inspect every rule

- edit it

- upload a replacement

- download it

- activate a new version

- restore an older version

- see version history

- see which audits used each version

============================================================

12. COMPLETE DOCUMENT PARSING

============================================================

When I replace an audit or metrics document, read the ENTIRE replacement.

Generate:

DOCUMENT PARSE COMPLETENESS REPORT

Include:

- pages detected

- sections detected

- headings detected

- expected rules

- parsed rules

- unmapped rules

- ambiguous rules

- unparsed text

- parser confidence

If a document contains 60 rules and only 59 are mapped:

DO NOT ACTIVATE IT.

Display:

DOCUMENT ACTIVATION BLOCKED

EXPECTED RULES: 60

PARSED RULES: 59

UNMAPPED: 1

============================================================

13. HUMAN RULE MAPPING

============================================================

If natural-language rules cannot safely become executable logic:

REQUIRES HUMAN RULE MAPPING

Never silently omit them.

Allow an administrator to specify:

- inputs

- conditions

- thresholds

- outputs

- severity

- blocking behavior

A document cannot be considered completely implemented while mandatory

rules remain unmapped.

============================================================

14. RULE REPLACEMENT AND INVALIDATION

============================================================

If I replace:

- Verification Audit

- Disagreement Audit

- Metrics

- underdog logic

- stress-test logic

- calibration logic

the system must:

1. parse the entire replacement

2. compare old vs new

3. show additions

4. show deletions

5. show modifications

6. activate only after validation

7. identify affected existing audits

8. mark affected current audits:

STALE — RULE VERSION CHANGED

or:

INVALIDATED — RERUN REQUIRED

Do NOT continue presenting an old audit as current.

Preserve the historical version.

============================================================

15. AUTOMATIC RERUN AFTER RULE CHANGES

============================================================

Allow:

- rerun current slate

- rerun selected matches

- rerun unfinished matches

- rerun all affected matches

Every rerun must execute the NEW document completely for Player 1 and

Player 2.

============================================================

16. SOURCE GOVERNANCE

============================================================

Create:

ADMIN → SOURCES → SOURCE GOVERNANCE

Every external source stores:

- source_id

- source_name

- domain

- category

- priority

- reliability score

- supported data

- refresh schedule

- error history

- last fetch

- last validation

- active/inactive

- approved status

- blacklist status

- blacklist reason

Allow me to:

- add

- remove

- disable

- blacklist

- prioritize

- change reliability

- assign metrics

- inspect history

============================================================

17. SOURCE PRIORITY

============================================================

Default hierarchy:

TIER 1 — OFFICIAL

Use for:

- tournament identity

- surface

- draw

- match status

- rankings

- official result

- retirement

- walkover

- withdrawal

TIER 2 — SPECIALIST TENNIS DATA

Use for:

- Elo

- surface Elo

- serve

- return

- form

- H2H

- opponent history

- workload

- strength of schedule

TIER 3 — MARKET

Use multiple sportsbooks/odds sources for:

- opening odds

- current odds

- consensus

- implied probability

- movement

TIER 4 — NEWS / AVAILABILITY

Use reliable reporting for:

- injury

- illness

- travel

- withdrawal

- physical limitation

- scheduling information

============================================================

18. MULTI-SOURCE REQUIREMENT

============================================================

For critical facts seek at least TWO independent sources whenever

practical.

Store:

SOURCE A

SOURCE B

SOURCE C when available

plus:

- agreement

- disagreement

- timestamps

- reliability

- selected normalized value

- selection reason

If only one credible source exists:

SINGLE-SOURCE DEPENDENCY

============================================================

19. SOURCE CONFLICT ENGINE

============================================================

When credible sources disagree:

DO NOT silently select one.

Create:

SOURCE CONFLICT

Possible resolutions:

RESOLVED — AUTHORITATIVE SOURCE

RESOLVED — SOURCE CONSENSUS

RESOLVED — FRESHEST RELIABLE SOURCE

UNRESOLVED

Store why the resolution was made.

============================================================

20. CONTINUOUS WEB DATA COLLECTION

============================================================

Continuously retrieve current tennis information from multiple approved

sources.

Support configurable source adapters for:

- official tennis data

- rankings

- tournament information

- results

- draws

- surfaces

- statistical databases

- Elo providers

- sportsbooks

- odds comparison

- injury/news

- weather/environment

- H2H

Never depend on a single provider when multiple reliable sources exist.

============================================================

21. DATA REFRESH

============================================================

Allow configurable freshness windows.

Examples:

rankings:

daily

event/draw/surface:

daily or change-driven

results:

frequent during active events

market:

frequent

injury/news:

frequent

weather:

frequent near match time

If critical evidence expires:

AUDIT STALE — REFRESH REQUIRED

============================================================

22. PRE-MATCH RESEARCH LOCK

============================================================

Every audit receives:

research_lock_at

Also store:

- scheduled start

- actual first serve when available

- every source retrieval timestamp

No evidence obtained after first serve may justify the original pre-match

prediction.

Exclude:

- live score

- in-play odds

- live match statistics

- first-set information

- live win probability

Mark:

POST-START DATA — EXCLUDED FROM PRE-MATCH AUDIT

============================================================

23. IMMUTABLE PRE-MATCH SNAPSHOT

============================================================

At research lock freeze:

- sources

- rankings

- Elo

- surface Elo

- form

- odds

- injury/news

- weather

- reconstructed metrics

- independent conclusion

- audit findings

- Matrix comparison

- calibration

- final color

Never rewrite that historical snapshot.

A later run becomes AUDIT RUN 2.

============================================================

24. FULL P1 VS P2 METRICS

============================================================

Import EVERY metric from the active Verification Metrics document.

For every applicable metric store:

- metric ID

- name

- category

- Player 1 value

- Player 2 value

- differential

- surface-adjusted differential

- recent differential

- opponent-adjusted differential

- sample

- freshness

- reliability

- sources

- independence/correlation

- direction

- treatment

Every applicable metric must evaluate BOTH players.

============================================================

25. NO ONE-SIDED ANALYSIS

============================================================

APPLICATION INVARIANT:

A MATCH CANNOT COMPLETE IF PLAYER 1 AND PLAYER 2 HAVE NOT BOTH BEEN

PROCESSED FOR EVERY APPLICABLE METRIC AND AUDIT RULE.

Never analyze only the Matrix prediction winner.

Never analyze only the favorite.

Never analyze only Player 1.

Never analyze only Player 2.

The two-player comparison is mandatory.

============================================================

26. RECONSTRUCTION ENGINE

============================================================

Some metrics require reconstruction.

Allow reconstruction when permitted by the active Metrics/Audit rules.

Every reconstructed metric stores:

- formula

- source inputs

- timestamps

- assumptions

- sample

- reliability

- output

- reconstruction version

Examples may include:

- opponent-adjusted form

- strength of schedule

- recent Elo movement

- hold/break estimates

- matchup hold/break

- dominance measures

- calibrated probability ranges

Reconstruct BOTH players where applicable.

Never mark reconstructed data DIRECT.

If source inputs do not support reconstruction:

UNAVAILABLE

Never invent a value.

============================================================

27. MATRIX FIREWALL

============================================================

Architect two isolated branches.

BRANCH A — MATRIX

Contains:

- predicted winner

- WP

- MC

- Matrix Elo

- General Model

- Specialist Model

- agreement

- upset-risk interpretation

- Matrix market

- other Matrix-derived fields

BRANCH B — INDEPENDENT AUDIT

Contains only independently collected/reconstructed evidence.

Branch B must determine:

- independent winner

- independent probability range

- uncertainty

- evidence case for Player 1

- evidence case for Player 2

BEFORE Branch A is revealed.

Store:

independent_decision_committed_at

matrix_revealed_at

Require:

matrix_revealed_at >

independent_decision_committed_at

============================================================

28. MATRIX CANNOT QUALIFY GREEN

============================================================

HARD RULE:

Matrix-derived evidence cannot satisfy the independent evidence minimum

for GREEN or DOUBLE GREEN.

Do NOT count:

- Matrix WP

- Matrix MC

- Matrix Elo

- Matrix General Model

- Matrix Specialist Model

- Matrix agreement

- Matrix market

- derivatives of Matrix outputs

toward independent evidence count.

These are comparison/calibration inputs only.

============================================================

29. EFFECTIVE INDEPENDENT EVIDENCE

============================================================

Maintain:

RAW SIGNAL COUNT

and:

EFFECTIVE INDEPENDENT EVIDENCE COUNT

Collapse correlated evidence families.

Do not count multiple transformations of the same underlying information

as independent confirmations.

============================================================

30. VERIFICATION AUDIT

============================================================

Execute EVERY rule in the active Verification Audit against BOTH players.

Store:

- rule ID

- rule name

- Player 1 finding

- Player 2 finding

- PASS/WARN/FAIL

- severity

- sources

- reliability

- decision effect

Display:

VERIFICATION RULES EXECUTED:

X / TOTAL

If X != TOTAL:

VERIFICATION AUDIT INCOMPLETE

============================================================

31. DISAGREEMENT / TRAP AUDIT

============================================================

Execute the entire active Disagreement / Trap Audit.

Preserve its exact structure, including A–U or whatever structure a

future replacement uses.

For every rule/family store:

- Player 1 risk

- Player 2 risk

- supporting evidence

- opposing evidence

- contradiction severity

- reliability

- recency

- independence

- final effect

Display:

DISAGREEMENT RULES EXECUTED:

X / TOTAL

============================================================

32. DANGEROUS UNDERDOG AUDIT

============================================================

This stage is mandatory.

"Underdog" means the lower-confidence side from the INDEPENDENT AUDIT,

not automatically the Matrix underdog.

Build the strongest evidence-supported case for BOTH players.

Required pathways include all pathways in the active audit and at minimum:

- serve-through

- return-pressure

- second-serve exploitation

- short-rally

- long-rally

- movement/physical

- slow-start

- deciding-set

- tiebreak

- fatigue

- style mismatch

- market-information

- favorite-collapse

- surface-transition

- recent-improvement/ranking-lag

Classify each:

WEAK

REALISTIC

STRONG

UNRESOLVED

Explicitly answer:

HOW DOES PLAYER 1 WIN?

HOW DOES PLAYER 2 WIN?

WHICH PATHWAYS ARE REPEATABLE AND SUPPORTED?

No GREEN while this stage is incomplete.

============================================================

33. STRESS / COMPONENT-REMOVAL TESTS

============================================================

Execute every stress test defined by the active audits.

Baseline mandatory tests:

1. Remove Matrix headline

2. Remove all Matrix-derived outputs

3. Remove strongest independent favorite family

4. Remove market

5. Upweight recent form

6. Upweight same-surface evidence

7. Upweight opponent-specific evidence

8. Apply conservative probability floor

9. Apply dangerous-underdog ceiling

10. Apply physical/conditions shock

Store:

- winner before

- winner after

- range before

- range after

- STABLE

- MOSTLY STABLE

- UNSTABLE

- FAILS

If Matrix removal changes the independent winner:

GREEN LOCKED

============================================================

34. CALIBRATION STARTING RECORD

============================================================

Initialize calibration from my Final 183 Record:

ORANGE

Matrix WP <=55%

1/3

33.3%

TAN

56–64%

13/23

56.5%

PURPLE

65–69%

15/19

78.9%

BLUE

70–74%

20/27

74.1%

PINK

75–79%

19/26

73.1%

BROWN

80–84%

9/12

75.0%

INDIGO / DARK PURPLE

85–89%

6/8

75.0%

GOLD

90%+

2/2

100.0%

SMALL SAMPLE

============================================================

35. CALIBRATION COLOR LEGEND

============================================================

Maintain:

🟧 <=55% — ORANGE

🟫 56–64% — TAN

🟪 65–69% — PURPLE

🟦 70–74% — BLUE

🩷 75–79% — PINK

🟤 80–84% — BROWN

🟪 85–89% — INDIGO / DARK PURPLE

🟨 90%+ — GOLD

Verified Win Rates must update dynamically.

Do not permanently hard-code the starting percentages.

============================================================

36. CALIBRATION APPLICATION

============================================================

Calibration occurs AFTER the independent audit.

Calibration may adjust:

- confidence

- calibrated range

- uncertainty

Calibration must not independently determine evidence direction.

Verification/Trap vetoes remain active regardless of historical bucket

strength.

============================================================

37. AUTOMATIC RESULT MONITORING

============================================================

Monitor every audited match until an official result/status is available.

Retrieve from reliable sources:

- actual winner

- final score

- retirement status

- walkover

- cancellation

- withdrawal

- default

- match-start status

- completion timestamp

Verify canonical identity before grading.

============================================================

38. RESULT STATUS CATEGORIES

============================================================

Use:

COMPLETED NORMALLY

IN-MATCH RETIREMENT

PRE-MATCH RETIREMENT / WITHDRAWAL

WALKOVER

CANCELLATION

DEFAULT

ABANDONED

SUSPENDED

NO CONTEST

UNKNOWN / UNVERIFIED

============================================================

39. IN-MATCH RETIREMENT GRADING — IMPORTANT

============================================================

If the match STARTED and a player later retires:

GRADE IT AS A REGULAR COMPLETED MATCH.

The officially advancing/winning player is the match winner for grading.

The prediction is:

WIN

or

LOSS

exactly as a normally completed match.

It MUST:

- update the calibration ledger

- count in the appropriate calibration bucket numerator/denominator

- update Verified Win Rate

- create the next calibration version

Also preserve:

RESULT TYPE = IN-MATCH RETIREMENT

so retirement performance can be analyzed separately later.

But for the primary calibration:

IN-MATCH RETIREMENT = REGULAR GRADED MATCH.

============================================================

40. PRE-MATCH RETIREMENT / WALKOVER / CANCELLATION

============================================================

If a player retires/withdraws BEFORE the match begins, OR the match is a

walkover, OR the match is cancelled:

DO NOT grade it as a prediction WIN or LOSS.

However:

DO ADD IT TO THE MASTER CALIBRATION LIST.

Mark the calibration-ledger entry:

YELLOW — NON-GRADED RESULT

Examples:

YELLOW — PRE-MATCH WITHDRAWAL

YELLOW — WALKOVER

YELLOW — CANCELLATION

These entries must remain visible in the chronological calibration list.

============================================================

41. YELLOW NON-GRADED CALIBRATION ENTRIES

============================================================

A YELLOW non-graded result:

IS included in:

- calibration history

- master result ledger

- chronological record

- total processed-record sequence

- calibration version history

BUT IS NOT included in:

- calibration wins

- calibration losses

- calibration bucket numerator

- calibration bucket denominator

- Verified Win Rate calculation

Example:

Suppose the Blue bucket is:

20 wins / 27 graded matches = 74.1%

Then a Blue-bucket match is cancelled before play.

The master ledger receives the new YELLOW entry.

But Blue remains:

20 / 27 = 74.1%

NOT:

20 / 28.

The yellow non-graded entry does NOT alter the bucket's Verified Win Rate.

============================================================

42. CALIBRATION SEQUENCE VS GRADED SAMPLE

============================================================

Maintain TWO separate counts:

MASTER RECORD SEQUENCE COUNT

and:

GRADED CALIBRATION SAMPLE COUNT

The master sequence includes Yellow non-graded entries.

The graded calibration sample excludes them.

Example:

Original master record:

183 entries

Next match:

pre-match walkover

New master record:

184 entries

But graded calibration sample does NOT increase.

This distinction must be visible in the UI and reports.

============================================================

43. YELLOW IS A RESULT-LEDGER STATUS, NOT AUDIT YELLOW

============================================================

Do not confuse:

FINAL AUDIT COLOR = YELLOW

with:

RESULT LEDGER STATUS = YELLOW NON-GRADED

These are separate concepts.

Use separate database fields:

final_audit_color

and:

result_grading_status

For example:

final_audit_color = GREEN

result_grading_status = YELLOW_WALKOVER

is valid.

============================================================

44. AUTOMATIC CALIBRATION UPDATE

============================================================

When a result arrives:

1. verify match identity

2. verify original prediction existed pre-match

3. retrieve original Matrix WP

4. identify original calibration bucket

5. verify match-start status

6. verify result type

7. apply grading rules

8. check duplicate grading

9. create calibration ledger entry

IF NORMAL COMPLETION:

grade WIN/LOSS

update bucket

update Verified Win Rate

IF IN-MATCH RETIREMENT:

grade WIN/LOSS

update bucket

update Verified Win Rate

IF PRE-MATCH RETIREMENT/WITHDRAWAL:

create YELLOW NON-GRADED entry

do not alter bucket numerator/denominator

IF WALKOVER:

create YELLOW NON-GRADED entry

do not alter bucket numerator/denominator

IF CANCELLATION:

create YELLOW NON-GRADED entry

do not alter bucket numerator/denominator

10. increment master record sequence

11. create new calibration version

12. preserve previous calibration version

============================================================

45. DUPLICATE CALIBRATION PROTECTION

============================================================

ONE physical match may produce at most ONE calibration-ledger result entry

within a calibration lineage.

If duplicate:

DUPLICATE CALIBRATION ENTRY BLOCKED

============================================================

46. CALIBRATION HISTORY

============================================================

Create a Calibration History screen.

Show every chronological entry:

- master sequence #

- match

- tournament

- date

- surface

- Matrix predicted winner

- Matrix WP

- bucket

- actual winner/status

- WIN

- LOSS

- YELLOW NON-GRADED

- result type

- counted in bucket? YES/NO

- calibration version before

- calibration version after

Allow manual correction with immutable change history.

============================================================

47. CONTEXTUAL CALIBRATION

============================================================

Preserve the GLOBAL calibration as primary.

Also store context:

- surface

- indoor/outdoor

- ATP/WTA

- tournament level

- Challenger/Tour/qualifying/main draw

- best-of

- ranking gap

- Elo gap

- Matrix bucket

- MC band

- closeness

- market structure

- DQ

Allow contextual performance analysis later.

Do not silently replace global calibration with contextual calibration.

============================================================

48. SAMPLE-SIZE DISCIPLINE

============================================================

Display:

wins

total graded

Verified Win Rate

sample warning

Do not treat:

2/2 = 100%

as equally reliable to a large sample.

Label small samples clearly.

============================================================

49. FINAL COMBINATION GATE

============================================================

Before issuing a final audit color verify:

- identity complete

- critical source conflicts resolved

- P1 metrics complete

- P2 metrics complete

- reconstruction complete/appropriately unavailable

- Verification Audit complete

- Disagreement Audit complete

- Dangerous Underdog complete

- stress/removal complete

- independent conclusion committed

- Matrix firewall respected

- Matrix comparison complete

- current calibration applied

- critical data fresh

Then classify:

DOUBLE GREEN

GREEN

YELLOW

RED / PASS

INCOMPLETE

============================================================

50. GREEN REQUIREMENTS

============================================================

GREEN requires at minimum:

- complete independent audit

- minimum independent evidence families from active rules

- Matrix removal survival

- reasonable component-removal survival

- complete underdog audit

- no multiple high-quality underdog pathways

- no unresolved CRITICAL contradiction

- sufficient critical data

Matrix evidence cannot satisfy the independent minimum.

============================================================

51. DOUBLE GREEN REQUIREMENTS

============================================================

DOUBLE GREEN requires every Green requirement plus stricter active-audit

requirements, including the required larger independent-family count and

stronger stress-test survival.

Calibration alone cannot create Double Green.

Market alone cannot create Double Green.

Matrix alone cannot create Double Green.

============================================================

52. YELLOW AUDIT CLASSIFICATION

============================================================

Use audit YELLOW for material uncertainty such as:

- meaningful conflict

- thin sample

- weak separation

- current/historical conflict

- meaningful underdog pathway

- removal instability

- incomplete noncritical evidence

Follow the active audit's exact Yellow rules.

============================================================

53. RED / PASS

============================================================

RED/PASS may result from:

- multiple independent contradictions

- near coin flip

- dangerous underdog surviving

- critical evidence problems

- Matrix favorite failing independent removal

- severe instability

- other active audit vetoes

RED does NOT require forcing a winner flip.

PASS is valid.

============================================================

54. COMPLETION PROOF

============================================================

Every match must show:

Metrics:

X / Total

Player 1 metric treatment:

X / Total

Player 2 metric treatment:

X / Total

Verification:

X / Total

Disagreement:

X / Total

Underdog pathways:

X / Total

Stress tests:

X / Total

Critical sources:

X / Total

Reconstructions:

X / Total

Calibration:

COMPLETE / INCOMPLETE

Matrix firewall:

VALID / VIOLATED

============================================================

55. DETERMINISTIC COMPLETION

============================================================

The AI may NEVER decide that the audit is complete.

Application logic calculates:

AUDIT_COMPLETE = TRUE/FALSE

Only if all mandatory requirements pass may the UI display:

AUDIT COMPLETE — NO REQUIRED STEPS MISSING

============================================================

56. "NO SHORTCUTS" PROOF

============================================================

The phrase:

NO SHORTCUTS

may ONLY be displayed when deterministic completion = TRUE.

The AI cannot generate this label from its own judgment.

Clicking the label must show the execution proof.

============================================================

57. MASTER RANKED BOARD

============================================================

Generate ONE combined ranking.

PRIMARY SORT:

1. DOUBLE GREEN

2. GREEN

3. YELLOW

4. RED / PASS

5. INCOMPLETE

SECONDARY SORT INSIDE EACH GROUP:

CURRENT CALIBRATION VERIFIED WIN RATE

highest to lowest.

Do NOT rank secondarily merely by Matrix WP.

============================================================

58. MASTER BOARD COLUMNS

============================================================

Include:

- Rank

- Final Selection

- Opponent / Match

- Tournament

- Surface

- Matrix Pick

- Matrix WP

- calibration version

- calibration bucket

- Verified Win Rate

- independent winner

- independent range

- calibrated range

- effective independent evidence count

- strongest underdog pathway

- Dangerous Underdog status

- Matrix-removal result

- strongest-family-removal result

- Verification status

- Disagreement status

- Final Audit Color

- Action

- Completion %

============================================================

59. MASTER BOARD COLORS

============================================================

Use calibration colors across the appropriate row portion:

Orange

Tan

Purple

Blue

Pink

Brown

Indigo

Gold

Use a separate Final Audit Color cell:

DOUBLE GREEN

GREEN

YELLOW

RED

Never confuse the two color systems.

============================================================

60. FINAL PDF GENERATOR

============================================================

Once the slate is ready, automatically generate a downloadable PDF.

Match the supplied Master Audit style:

- clean white background

- dark navy headers

- compact professional tables

- calibration legend

- color-coded calibration rows

- separate audit-color column

- one combined ranked board

- continuation pages when required

============================================================

61. PDF PAGE 1

============================================================

Include:

- title

- research-lock timestamp

- report timestamp

- summary version

- Verification Audit version

- Disagreement Audit version

- Metrics version

- calibration version

- completed match count

- unresolved match count

- Double Green count

- Green count

- Yellow count

- Red count

- calibration legend

- beginning of master ranked board

============================================================

62. PDF DECISION TRACE

============================================================

For every match include either in the table or appendix:

- independent winner

- independent range

- strongest evidence family #1

- strongest evidence family #2

- strongest evidence family #3

- strongest opposing/underdog pathway

- Dangerous Underdog result

- Matrix-removal result

- strongest-family-removal result

- unresolved contradictions

- calibration bucket

- Verified Win Rate

- final color

- action

============================================================

63. PDF WHILE MATCHES ARE BLOCKED

============================================================

A blocked match must NOT stop completed matches from appearing in a report.

If I request a report before every match resolves:

mark affected matches:

INCOMPLETE — [SPECIFIC REASON]

Never fabricate missing calculations.

If configured to require full completion for an official report, allow a

PROVISIONAL REPORT while continuing to process unresolved matches.

============================================================

64. AUDIT EXECUTION LOG

============================================================

Every match stores an immutable log containing:

- timestamp

- stage

- rule

- player

- input

- source

- output

- status

- missing data

- reconstruction

- whether Matrix was visible

- rule version

============================================================

65. AUDIT PROOF BUTTON

============================================================

Create:

AUDIT PROOF

Clicking it shows exactly:

- what ran

- what did not run

- what was unavailable

- what was reconstructed

- sources

- timestamps

- rule versions

- both-player coverage

- Matrix firewall proof

============================================================

66. REPRODUCIBILITY

============================================================

Every historical audit must be reproducible.

Store:

- source snapshots

- raw values

- normalized values

- reconstruction formulas

- rule versions

- document versions

- calibration version

- research lock

- execution state

- final result

============================================================

67. ERROR DISCLOSURE

============================================================

If the system later discovers:

- skipped metric

- skipped rule

- wrong player

- wrong surface

- Matrix leakage

- source corruption

- duplicate grading

- bad reconstruction

mark affected audit:

COMPROMISED

Do NOT silently overwrite it.

Create a corrected audit version.

============================================================

68. DATABASE ENTITIES

============================================================

Include at minimum:

users

players

tournaments

matches

match_identity_records

summary_uploads

summary_versions

summary_pages

parsed_summary_fields

metric_definitions

metric_versions

metric_results

source_definitions

source_snapshots

source_conflicts

reconstruction_definitions

reconstruction_results

verification_documents

verification_rule_versions

verification_results

disagreement_documents

disagreement_rule_versions

disagreement_results

underdog_pathways

underdog_results

stress_test_definitions

stress_results

calibration_versions

calibration_buckets

calibration_ledger

calibration_result_entries

final_decisions

audit_runs

execution_logs

generated_reports

============================================================

69. ADMIN / USER SCREENS

============================================================

Build:

Dashboard

Upload Summaries

PDF Parse Review

Active Slate

Match Audit Workspace

P1 vs P2 Metrics

Verification Audit

Disagreement / Trap Audit

Dangerous Underdog

Stress / Removal Tests

Sources

Source Conflicts

Reconstructions

Calibration

Calibration History

Rules / Knowledge Base

Document Version History

Audit Execution Logs

Master Ranked Board

PDF Reports

============================================================

70. AUTOMATED TESTS

============================================================

Create automated tests proving:

TEST:

one match has unresolved surface.

EXPECTED:

only affected surface calculations and that match's final gate are

blocked; entire slate continues.

TEST:

Matrix prediction exposed before independent commitment.

EXPECTED:

HARD FAILURE for that match.

TEST:

Player 1 complete but one Player 2 metric missing.

EXPECTED:

AUDIT INCOMPLETE.

TEST:

Verification document contains 60 rules but only 59 parse.

EXPECTED:

DOCUMENT ACTIVATION BLOCKED.

TEST:

same physical match uploaded twice.

EXPECTED:

one match, multiple summary versions.

TEST:

same result graded twice.

EXPECTED:

duplicate calibration entry blocked.

TEST:

Matrix says Grass; authoritative event data says Hard.

EXPECTED:

surface conflict; dependent calculations blocked.

TEST:

post-first-serve information enters pre-match research.

EXPECTED:

excluded.

TEST:

Matrix-derived signals appear sufficient for Green.

EXPECTED:

they do NOT increase independent evidence count.

TEST:

candidate fails Matrix-removal.

EXPECTED:

GREEN LOCKED.

TEST:

audit document replaced.

EXPECTED:

affected current audits become stale/invalidated.

TEST:

match begins and Player 2 retires.

EXPECTED:

grade match normally as WIN/LOSS and update calibration bucket.

TEST:

player withdraws before match begins.

EXPECTED:

create YELLOW NON-GRADED calibration-ledger entry; advance master sequence;

do NOT alter calibration bucket denominator.

TEST:

walkover.

EXPECTED:

YELLOW NON-GRADED; visible in calibration history; excluded from Verified

Win Rate.

TEST:

cancellation.

EXPECTED:

YELLOW NON-GRADED; visible in calibration history; excluded from Verified

Win Rate.

TEST:

90%+ bucket remains 2/2.

EXPECTED:

100% displayed with SMALL SAMPLE warning.

TEST:

final board generated.

EXPECTED:

primary sort = audit color;

secondary sort = current Verified Win Rate.

============================================================

71. SYSTEM INVARIANTS

============================================================

RULE 1:

THE MATRIX MAY BE COMPARED TO THE AUDIT.

THE MATRIX MAY NOT DETERMINE THE AUDIT.

RULE 2:

NO PLAYER 1 ANALYSIS WITHOUT PLAYER 2 ANALYSIS.

RULE 3:

NO PLAYER 2 ANALYSIS WITHOUT PLAYER 1 ANALYSIS.

RULE 4:

NO MISSING METRIC MAY BE INVENTED.

RULE 5:

NO REQUIRED AUDIT RULE MAY BE SILENTLY OMITTED.

RULE 6:

NO DOCUMENT VERSION MAY BECOME ACTIVE UNTIL COMPLETE PARSING IS VERIFIED.

RULE 7:

NO GREEN OR DOUBLE GREEN MAY USE MATRIX-DERIVED SIGNALS TO SATISFY

INDEPENDENT-EVIDENCE REQUIREMENTS.

RULE 8:

NO GREEN IF MATRIX-REMOVAL TEST FAILS.

RULE 9:

NO GREEN IF DANGEROUS UNDERDOG AUDIT IS INCOMPLETE.

RULE 10:

NO FINALIZATION WITH AN UNRESOLVED CRITICAL DEPENDENCY.

RULE 11:

A CRITICAL DEPENDENCY BLOCKS THE AFFECTED MATCH/CALCULATION — NEVER THE

ENTIRE SLATE.

RULE 12:

NO POST-START DATA MAY CONTAMINATE A PRE-MATCH AUDIT.

RULE 13:

NO PHYSICAL MATCH MAY BE GRADED TWICE.

RULE 14:

AN IN-MATCH RETIREMENT IS GRADED AS A NORMAL COMPLETED MATCH.

RULE 15:

A PRE-MATCH WITHDRAWAL/RETIREMENT, WALKOVER OR CANCELLATION CREATES A

YELLOW NON-GRADED CALIBRATION-LEDGER ENTRY.

RULE 16:

YELLOW NON-GRADED ENTRIES ADVANCE THE MASTER RECORD SEQUENCE BUT DO NOT

ENTER CALIBRATION WIN/LOSS NUMERATORS OR DENOMINATORS.

RULE 17:

NO RULE CHANGE MAY LEAVE AFFECTED OLD AUDITS DISPLAYED AS CURRENT.

RULE 18:

NO "COMPLETE" OR "NO SHORTCUTS" LABEL MAY COME FROM AI-GENERATED TEXT.

RULE 19:

EVERY FINAL DECISION MUST BE REPRODUCIBLE.

RULE 20:

NO EXECUTION RECORD = NO COMPLETION.

============================================================

72. FINAL PRODUCT PRINCIPLE

============================================================

The AI may:

- read PDFs

- parse documents

- research

- extract information

- reconstruct permitted metrics

- summarize evidence

- explain decisions

DETERMINISTIC APPLICATION LOGIC MUST CONTROL:

- match identity

- both-player completeness

- rule counts

- metric counts

- source conflicts

- document completeness

- Matrix isolation

- Green eligibility

- result grading

- calibration updates

- duplicate prevention

- ranking

- report completion status

The system must make it technically impossible, wherever practical, for

an AI agent to skip required work and then claim that it completed it.

NO EXECUTION RECORD = NO COMPLETION.

NO VERIFIED PLAYER 1 AND PLAYER 2 = NO COMPLETION.

NO COMPLETE METRIC SWEEP = NO COMPLETION.

NO COMPLETE VERIFICATION AUDIT = NO COMPLETION.

NO COMPLETE DISAGREEMENT / TRAP AUDIT = NO COMPLETION.

NO COMPLETE DANGEROUS UNDERDOG AUDIT = NO GREEN.

NO MATRIX-REMOVAL SURVIVAL = NO GREEN.

NO VERIFIED SOURCE SNAPSHOT = NO FINALIZATION.

NO VALID RESULT STATUS = NO CALIBRATION GRADING.

NO COMPLETE DOCUMENT PARSE = NO NEW ACTIVE RULE VERSION.

BLOCK DEPENDENCIES, NOT THE ENTIRE SLATE.

THE MATRIX MAY BE COMPARED TO THE AUDIT.

THE MATRIX MAY NOT DETERMINE THE AUDIT.

THE SYSTEM MUST PROVE THE WORK WAS DONE.

IT MUST NEVER MERELY SAY THAT IT WAS DONE.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e217cec6-8cf9-40d2-9443-14b4f8716490).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
