-- Stress-veto fix (docs/audit-32-insufficient-evidence.md): the Stress stage used to
-- evaluate only the pre-Stress leader and use that single-sided result as a global veto.
-- It now evaluates BOTH players independently (truth-engine-audit.ts: evaluateSideStress,
-- runStressTest) and a genuine comparative-robustness reading decides whether a selection
-- is withdrawn. stress_results previously had no way to persist a per-player result at
-- all -- these columns are the minimum additive change needed to answer "what happened to
-- P1 under Stress?" and "what happened to P2?" per test row, and to persist the
-- comparative reading that actually drives the (now corrected) refusal decision.
--
-- Purely additive: every new column is nullable, no existing column is touched, no
-- existing row is modified or backfilled.
alter table public.stress_results
  add column if not exists p1_outcome_when_stressed text,
  add column if not exists p2_outcome_when_stressed text,
  add column if not exists p1_support_percent_before numeric,
  add column if not exists p1_support_percent_after numeric,
  add column if not exists p2_support_percent_before numeric,
  add column if not exists p2_support_percent_after numeric,
  add column if not exists comparative_robustness text;

comment on column public.stress_results.p1_outcome_when_stressed is
  'Full re-derived selection (P1/P2/INSUFFICIENT_EVIDENCE) when ONLY P1''s own currently-favouring evidence is eroded by one noise floor per metric.';
comment on column public.stress_results.p2_outcome_when_stressed is
  'Full re-derived selection when ONLY P2''s own currently-favouring evidence is eroded by one noise floor per metric.';
comment on column public.stress_results.p1_support_percent_before is
  'P1''s share of the directional evidence before any erosion.';
comment on column public.stress_results.p1_support_percent_after is
  'P1''s share of the directional evidence after P1''s own favouring edges are eroded.';
comment on column public.stress_results.p2_support_percent_before is
  'P2''s share of the directional evidence before any erosion.';
comment on column public.stress_results.p2_support_percent_after is
  'P2''s share of the directional evidence after P2''s own favouring edges are eroded.';
comment on column public.stress_results.comparative_robustness is
  'NOT_APPLICABLE | BOTH_SURVIVE | LEADER_MORE_ROBUST | CHALLENGER_MORE_ROBUST | NON_DISCRIMINATING -- the one reading that can legitimately withdraw a selection (CHALLENGER_MORE_ROBUST only). See truth-engine-audit.ts:robustnessVerdict.';
