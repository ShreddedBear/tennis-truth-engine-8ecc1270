/**
 * Eligibility gate for autonomous Parlay Builder paper trading.
 *
 * Pure, DB-free by design: every input the gate needs (does this fixture already have a paper
 * trade, is the provider reachable, is player identity resolvable) is resolved by the caller
 * and passed in, so this module is fully unit-testable without a database or network access,
 * and so the actual eligibility RULES live in exactly one place rather than being scattered
 * across the job that calls it.
 *
 * "Never fabricate a decision" (project requirement): every fixture that fails a check here
 * gets a specific, machine-readable reason code -- never a silent skip. The caller is expected
 * to persist a NO_DECISION/INELIGIBLE row with this reason whenever `eligible` is false.
 */

export type PaperTradeEligibilityReason =
  | "MATCH_ALREADY_STARTED"
  | "SCHEDULED_TIME_MISSING"
  | "PLAYER_IDENTITY_UNRESOLVED"
  | "DUPLICATE_FIXTURE"
  | "UNSUPPORTED_EVENT_TYPE"
  | "INSUFFICIENT_PIT_EVIDENCE"
  | "BUILDER_DATA_UNAVAILABLE"
  | "PROVIDER_UNAVAILABLE";

/**
 * How long before a fixture's scheduled start the job is willing to freeze a paper-trade
 * decision. Modeled directly on the Prediction Engine's own `paperTradeLeadMinutes` default
 * (`services/evaluation/paperTrading.ts`, settings-configurable there at 30) -- reused as a
 * conservative documented default here rather than invented fresh, but deliberately NOT wired
 * to that table's settings row: the Parlay Builder must not take a runtime dependency on
 * Prediction Engine configuration (see `checkParlayBoundary.ts`'s import-boundary rule, which
 * this constant respects in spirit even though it isn't itself an import). If this needs to
 * become configurable later, it should be its own Parlay-Builder-scoped setting, not a read of
 * `prediction_settings`.
 */
export const PAPER_TRADE_DECISION_LEAD_MINUTES = 30;

export interface EligibilityFixtureInput {
  externalFixtureId: string;
  player1Id: string | null;
  player1Name: string | null;
  player2Id: string | null;
  player2Name: string | null;
  /** Only "singles" fixtures are supported; doubles/mixed are UNSUPPORTED_EVENT_TYPE. */
  drawType: string | null;
  scheduledStart: Date | null;
  /** False when the provider hasn't confirmed a real per-fixture time yet (see paperTrading.ts's identical guard). */
  timeConfirmed: boolean;
}

export interface EligibilityCheckInput {
  fixture: EligibilityFixtureInput;
  now: Date;
  /** True when a paper-trade row (any evaluated_side) already exists for this fixture+lineage. Caller resolves this via a DB lookup. */
  duplicateExists: boolean;
  /** False when fixture/player-history discovery itself failed (provider outage), distinct from "player simply has no history" (that's a Builder-time DATA_UNAVAILABLE, not a pre-flight rejection). */
  providerReachable: boolean;
  decisionLeadMinutes?: number;
}

export type EligibilityResult =
  | { eligible: true; decisionCutoffAt: Date }
  | { eligible: false; reason: PaperTradeEligibilityReason; detail: string };

/**
 * Evaluates the checks in a fixed, deliberate order: cheapest / most decisive rejections first
 * (provider outage, missing time) before the ones that require the caller to have already done
 * real work (duplicate lookup, identity resolution). This keeps the common "provider just
 * doesn't have this fixture's time yet" case cheap to reject without needing a DB round-trip
 * first.
 *
 * `duplicateExists` is checked immediately after the time-confirmed gate, BEFORE
 * `MATCH_ALREADY_STARTED` -- deliberately, not incidentally. A fixture already decided in an
 * earlier cycle keeps its own real scheduled_start_at, so by the time a later cycle re-discovers
 * it, that start time has very plausibly already passed; checking MATCH_ALREADY_STARTED first
 * (the original order) would misclassify an already-persisted fixture as a *new* started fixture
 * every single subsequent cycle -- and the caller's downstream handling for every non-duplicate
 * rejection reason attempts a fresh INSERT, which then collides with the row that already exists
 * (parlay_paper_trades_fixture_side_lineage_idx, confirmed live in production: fixtures 35880,
 * 35816, 36169, 36206 hit this exact 23505 on every recurring cycle). DUPLICATE_FIXTURE's own
 * caller-side handling never attempts an insert at all, so checking it first is strictly safer,
 * not just differently ordered. A genuinely new (never-before-seen) fixture that has already
 * started is unaffected: duplicateExists is false for it, so it falls through to the unchanged
 * MATCH_ALREADY_STARTED check exactly as before.
 */
export function checkPaperTradeEligibility(input: EligibilityCheckInput): EligibilityResult {
  const { fixture, now } = input;
  const decisionLeadMinutes = input.decisionLeadMinutes ?? PAPER_TRADE_DECISION_LEAD_MINUTES;

  if (!input.providerReachable) {
    return { eligible: false, reason: "PROVIDER_UNAVAILABLE", detail: "Fixture/player-history provider could not be reached." };
  }

  if (fixture.drawType != null && fixture.drawType.toLowerCase() !== "singles") {
    return { eligible: false, reason: "UNSUPPORTED_EVENT_TYPE", detail: `Draw type '${fixture.drawType}' is not singles.` };
  }

  if (!fixture.timeConfirmed || fixture.scheduledStart == null || Number.isNaN(fixture.scheduledStart.getTime())) {
    return { eligible: false, reason: "SCHEDULED_TIME_MISSING", detail: "Provider has not confirmed a real per-fixture start time yet." };
  }

  if (input.duplicateExists) {
    return { eligible: false, reason: "DUPLICATE_FIXTURE", detail: "A paper trade already exists for this fixture under the current Builder lineage." };
  }

  if (now.getTime() >= fixture.scheduledStart.getTime()) {
    return { eligible: false, reason: "MATCH_ALREADY_STARTED", detail: "Scheduled start is at or before the current time; no new decision may be generated for a started match." };
  }

  if (fixture.player1Id == null || fixture.player2Id == null || fixture.player1Name == null || fixture.player2Name == null) {
    return { eligible: false, reason: "PLAYER_IDENTITY_UNRESOLVED", detail: "Fixture is missing a resolved player id/name for one or both players." };
  }

  if (fixture.player1Id === fixture.player2Id) {
    return { eligible: false, reason: "PLAYER_IDENTITY_UNRESOLVED", detail: "Fixture lists the same player id for both sides -- corrupt fixture data." };
  }

  const decisionCutoffAt = new Date(fixture.scheduledStart.getTime() - decisionLeadMinutes * 60_000);

  if (decisionCutoffAt.getTime() <= now.getTime()) {
    // The lead window has already elapsed for this fixture (e.g. it was only just discovered
    // close to its start). This is not MATCH_ALREADY_STARTED (the match itself hasn't started),
    // but the intended pre-match decision window has -- treated as insufficient PIT evidence
    // lead time rather than fabricating a late decision.
    return { eligible: false, reason: "INSUFFICIENT_PIT_EVIDENCE", detail: `Decision window (${decisionLeadMinutes}m before start) has already elapsed for this fixture.` };
  }

  return { eligible: true, decisionCutoffAt };
}
