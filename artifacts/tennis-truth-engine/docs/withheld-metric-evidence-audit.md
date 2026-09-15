# Withheld / Non-Denominator Metric Evidence Audit

## Scope and admission gates

This audit covers every implemented canonical metric code that is currently outside
`COMPARISON_SPECS`: **020, 026, 038, 040, 043, 044, 046, 047, 052, 061, and 062**.

Historical data availability does not make a metric eligible to vote. Promotion requires all
of these independent gates:

1. two-sided evidence for the current matchup;
2. a defined scalar for each player;
3. a defensible denominator and minimum sample;
4. a valid directional interpretation;
5. a declared evidence family that is sufficiently independent;
6. a reviewed comparison specification.

The approved 2012-current Sackmann warehouse is available through the explicit, server-only
historical lane adapter. It does not change metric definitions or comparison eligibility.

## Metric-by-metric result

| Code | Implemented metric | Exact data requirement | Approved-source result | Denominator / direction / independence result | Eligibility |
|---|---|---|---|---|---|
| 020 | Level / Tour Transition | Strictly prior results, tournament/tour level, opponent quality and pre-match Elo | Sackmann supplies results and levels; Elo is reconstructed chronologically | No approved player-v-player scalar, sample floor, direction, or family contract | **Withheld; persistence-only** |
| 026 | Early-Warning / Slow-Start | Game-by-game score state and opening-window serve/return sequence | Approved PBP can supply this where tapes exist; Sackmann match statistics cannot | Current implementation can validate available tapes, but population coverage and a comparison specification are absent | **Withheld** |
| 038 | Opponent-Adjusted Residual Performance | Strict prior outcomes, opponent quality, expected-vs-actual residuals; the current implementation also requires a suitable comparison population | Sackmann supplies result/Elo inputs; approved PBP population coverage remains incomplete for the implemented contract | No approved scalar comparison contract or independent-family assignment | **Withheld; persistence-only** |
| 040 | Hidden Decline Detector | Chronological recent-vs-earlier Elo-adjusted surplus and required PBP observations | Sackmann supplies chronology/Elo; approved PBP remains coverage-limited | Missing comparison specification and minimum-window/family contract | **Withheld** |
| 043 | Favorite Failure Mode | Favorite role, favorite losses, failure-mode statistics, and evidence that the current opponent can reproduce the mode | Sackmann may supply historical favorite/stat components; approved PBP may supply some mechanics, but the complete same-context contract is not established | No valid scalar, direction, sample floor, or independent-family contract | **Withheld; protected persistence-only** |
| 044 | Opponent Upset Compatibility | Opponent upset profile plus chronological serve/return and matchup-compatibility dimensions | Sackmann supplies outcomes; approved PBP is incomplete for required chronological mechanics | No complete two-sided scalar comparison contract | **Withheld; protected persistence-only** |
| 046 | Match-State Elo | Separate Elo tracks conditional on first-set state, requiring set-one outcome and prior history | Sackmann set scores and chronology legitimately supply the implemented tracks | Two co-equal quantities exist; no approved choice of scalar, persisted denominator, or direction | **Withheld** |
| 047 | Uncertainty-Adjusted Advantage | Two-sided base-027 numerators and denominators for confidence/z-test calculations | Approved sources help only when underlying 027 evidence has complete numerators and denominators | It remains unclear whether this is an independent player metric or a meta-comparison method; no family/direction contract | **Withheld** |
| 052 | Entropy & Lead Durability | Set/game sequences and an approved definition of entropy/lead durability | Sackmann set scores support observed scoreline entropy; approved PBP can add richer sequences | Implemented observed-distribution substitution does not match a forward-probability entropy definition; no approved scalar contract | **Withheld; persistence-only** |
| 061 | Historical Twin Match Search | Strict prior history with comparable Elo, surface, form, price, fatigue, age, rank, court speed, model, simulation, and data-quality dimensions | Sackmann supplies chronology, outcomes, surface, ranks/statistics, and reconstructed Elo; it does not supply all canonical twin dimensions in one compatible lane | Current partial implementation is valid for Elo/surface search only; no complete cohort denominator, direction, or family contract | **Withheld** |
| 062 | Motivation / Stakes | Ranking points defended, draw/seed/bye implications, and authoritative milestone context | Sackmann ranking history is partial support; draw implications and milestone context remain unavailable | Complete two-sided evidence and a defensible comparable scalar are absent | **Withheld** |

## Contract verification

- Existing replay, leakage, cutoff, and refusal behavior remains testable for all eleven codes.
- Warehouse-backed lanes are explicitly wired only into asynchronous historical producers whose
  existing contracts already accept a history lane (038, 046, 052, 061, and 062).
- Metrics 020, 043, and 044 remain persistence-only as an explicit protected requirement.
- No comparison specification, weight, evidence family, threshold, LOFO rule, or active voting
  denominator was changed by the warehouse work.

## Remaining evidence gaps

- **Approved PBP population coverage:** required for 026 and parts of 038, 040, 043, and 044.
- **Missing canonical context:** draw/seed/bye/milestone data for 062 and multiple twin dimensions
  for 061.
- **Missing comparison semantics:** reviewed scalar, denominator, minimum sample, direction, and
  independent-family assignment for every metric listed above.
- **Definition mismatch:** 052's implemented observed entropy is not automatically equivalent to
  the canonical forward-probability concept.

Until those gaps are resolved with source-proven evidence and reviewed comparison contracts, all
eleven metrics remain outside the voting denominator.