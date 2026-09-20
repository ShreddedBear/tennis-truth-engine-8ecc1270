/**
 * Market-evidence capture — pure, currently-uncalled scaffolding.
 *
 * See docs/design/market-evidence-capture-contract.md for the full design. This module is NOT
 * wired into any production call path: nothing in paperTrading.ts, builderScoringService.ts, or
 * any route imports it today. It exists so that a future, explicitly approved wiring change has a
 * reviewable, independently-tested implementation to call rather than writing the DB-write path
 * inline at the call site.
 *
 * ATTEMPT-aware, not just success-aware (design doc section A/B): `captureMarketSnapshot` shapes
 * one row per capture ATTEMPT, whether or not that attempt produced a usable quote. This lets the
 * capture layer answer both "what was the market?" (`status: "included"`) and "why did this
 * prediction have no market?" (the three no-quote statuses below) from the same table. A "no
 * market" row is a legitimate, expected shape — not a malformed or partial one.
 *
 * Two responsibilities, kept separate on purpose:
 *   - `isSnapshotEligible` — the eligibility invariant as one small pure predicate, safe to unit
 *     test with synthetic timestamps and safe to reuse from a read-time query helper too. Only
 *     ever called (and only ever meaningful) for a successful ("included") capture — see its own
 *     comment.
 *   - `captureMarketSnapshot` — shapes one insert-ready `market_snapshots` row from a
 *     `CaptureOutcome` (either a real observation, or a no-quote attempt) plus its parent
 *     prediction/leg's identity and cutoff. It does NOT call the DB itself — the actual insert is
 *     left to a thin caller that supplies its own `db`/pool, so this module compiles and is
 *     testable with zero DB dependency.
 *
 * Fail-loud philosophy: a late snapshot (captured_at > prediction_cutoff_at) is never silently
 * dropped or silently treated as eligible. It is always written, always flagged `isEligible:
 * false`. This applies only to "included" rows — see `isEligible`'s NULL-for-non-included
 * handling below.
 */

import { readCurrentCommit } from "../../lib/captureProvenance.js";
import { computeVigAdjustedImpliedProbability } from "../oddsData/impliedProbability.js";
import type { InsertMarketSnapshot } from "@workspace/db";

/**
 * The four-state capture outcome, reusing the exact vocabulary `OddsStatus` defines in
 * services/oddsData/index.ts (see that type's doc comment for the full naming-choice rationale).
 * Duplicated here as a plain string-literal union, not imported, so this module keeps zero
 * dependency on the oddsData provider machinery beyond the pure `computeVigAdjustedImpliedProbability`
 * helper (same reasoning as `RawMarketObservation` not importing `OddsQuote` below).
 */
export type CaptureStatus = "included" | "no_market_available" | "provider_not_configured" | "provider_error";

/** Player identity fields every capture outcome (successful or not) always carries. */
interface MatchupIdentity {
  player1Id: string;
  player1Name: string;
  player2Id: string;
  player2Name: string;
}

/**
 * A real market observation, provider-agnostic. Mirrors `OddsQuote` (see
 * services/oddsData/types.ts) plus the player identity fields market_snapshots also stores,
 * duplicated here rather than importing OddsQuote directly so this module has zero dependency on
 * the oddsData provider machinery beyond the pure `computeVigAdjustedImpliedProbability` helper.
 */
export interface RawMarketObservation extends MatchupIdentity {
  provider: string;
  oddsPlayer1Decimal: number;
  oddsPlayer2Decimal: number;
  /** When the observation was actually taken/fetched — never the match's scheduled start. */
  capturedAt: Date;
}

/**
 * A capture ATTEMPT that did NOT yield a quote — still identifies the matchup and when the
 * attempt was made, so a "why no market" row is fully inspectable on its own.
 */
export interface NoQuoteCaptureAttempt extends MatchupIdentity {
  /**
   * The provider that was queried, for "no_market_available"/"provider_error" (which provider
   * came back empty / threw). Must be null for "provider_not_configured" — no provider was even
   * constructed, so none can be named (enforced by the CHECK constraint in the migration file;
   * captureMarketSnapshot also validates this at write-shaping time, see below).
   */
  provider: string | null;
  /** When this capture ATTEMPT was made (the clock read at attempt time) — not an odds-quote
   *  timestamp, since no quote was captured. Never backdated. */
  capturedAt: Date;
}

/**
 * The full discriminated capture outcome passed to `captureMarketSnapshot`. Exactly one variant
 * per call: either a real observation (`status: "included"`) or a no-quote attempt tagged with
 * which of the three failure/non-coverage reasons occurred.
 */
export type CaptureOutcome =
  | ({ status: "included" } & RawMarketObservation)
  | ({ status: "no_market_available" | "provider_error" } & NoQuoteCaptureAttempt)
  | ({ status: "provider_not_configured" } & Omit<NoQuoteCaptureAttempt, "provider"> & { provider?: null });

/** Identifies exactly which parent row this snapshot belongs to. Exactly one field is set. */
export type SnapshotParent =
  | { kind: "prediction"; predictionId: number; predictionCutoffAt: Date }
  | { kind: "leg"; legId: number; predictionCutoffAt: Date };

export interface CaptureMarketSnapshotArgs {
  outcome: CaptureOutcome;
  parent: SnapshotParent;
  /** Free-form identifier grouping every snapshot written by one capture invocation. */
  captureRunId: string;
  /** Which internal pipeline performed the capture, e.g. "paperTradingCycle" | "builderValidate". */
  capturePipeline: string;
  /** Market type; defaults to "h2h_moneyline" (the only kind currently ever captured). */
  marketType?: string;
  /** Working directory to read git HEAD from. Defaults to process.cwd(). Passed through to
   *  readCurrentCommit for testability (a test worktree may not be the process cwd). */
  cwd?: string;
}

/**
 * The eligibility invariant, stated precisely (design doc section B):
 *
 *   A SUCCESSFUL market snapshot is eligible for a prediction-time experiment only when
 *   market_snapshot.captured_at <= prediction.cutoff_at.
 *
 * Pure, no I/O, reusable from both the write-time capture path (this file) and a read-time query
 * helper (the `market_snapshots_eligible` view defined in marketEvidenceMigrations.ts encodes the
 * same rule in SQL — this function is the source of truth both are meant to agree with).
 *
 * Only meaningful for `status: "included"` outcomes. Deliberately NOT called at all for the three
 * no-quote statuses (see `captureMarketSnapshot` below) — there is no odds-observation timestamp
 * to compare against the cutoff for a row that captured no odds, so "eligible"/"ineligible" simply
 * doesn't apply; `isEligible` is stored as NULL for those rows rather than computed as `false`
 * (see design doc section B, "attempt-aware eligibility").
 */
export function isSnapshotEligible(capturedAt: Date, predictionCutoffAt: Date): boolean {
  return capturedAt.getTime() <= predictionCutoffAt.getTime();
}

/**
 * Shapes one insert-ready `market_snapshots` row from a capture ATTEMPT — successful or not. Does
 * not touch the DB. Never silently discards a late observation — for `status: "included"`,
 * `isEligible` is always computed and stored, and the row is always returned, so the caller's
 * insert (and any later read-time filtering) is the single place the invariant is actually
 * enforced against real consumers. For the three no-quote statuses, the row is shaped with the
 * odds/derived-probability/`isEligible` columns all NULL — a legitimate, expected shape (see
 * schema file header), not a partially-failed insert.
 *
 * Throws (fail-loud, not fail-silent) only for structurally invalid inputs that would otherwise
 * produce a corrupt/misleading row:
 *   - `status: "included"` with non-finite or <=1 decimal odds (mirrors
 *     computeVigAdjustedImpliedProbability's own contract — a snapshot with an unusable price is
 *     not "evidence with probability null", it's an input bug, since captured raw odds must
 *     always be real provider prices by construction).
 *   - `status: "provider_not_configured"` with a non-null `provider` — this status means no
 *     provider was even constructed, so naming one is a caller bug, not a real observation.
 */
export function captureMarketSnapshot(args: CaptureMarketSnapshotArgs): InsertMarketSnapshot {
  const { outcome, parent, captureRunId, capturePipeline } = args;

  const predictionCutoffAt = parent.predictionCutoffAt;
  const shared = {
    captureRunId,
    capturedByCommit: readCurrentCommit(args.cwd),
    capturePipeline,
    predictionId: parent.kind === "prediction" ? parent.predictionId : null,
    legId: parent.kind === "leg" ? parent.legId : null,
    predictionCutoffAt,
    marketType: args.marketType ?? "h2h_moneyline",
    player1Id: outcome.player1Id,
    player1Name: outcome.player1Name,
    player2Id: outcome.player2Id,
    player2Name: outcome.player2Name,
  };

  if (outcome.status !== "included") {
    // `outcome.provider` is statically typed as `null | undefined` on the "provider_not_configured"
    // variant, which makes TS narrow `outcome.provider != null` to an unreachable (`never`) branch
    // and reject `outcome.provider` on the next line as a result. Read through an untyped view
    // instead -- this check exists precisely to catch a caller who bypasses that static guarantee
    // (a plain-JS caller, or one that force-cast the outcome), so it must not rely on the type
    // system it is defending against.
    const suppliedProvider = (outcome as { provider?: string | null }).provider;
    if (outcome.status === "provider_not_configured" && suppliedProvider != null) {
      throw new Error(
        `captureMarketSnapshot: status "provider_not_configured" must not name a provider ` +
          `(got "${suppliedProvider}") — this status means no provider was even constructed.`,
      );
    }
    return {
      ...shared,
      captureStatus: outcome.status,
      capturedAt: outcome.capturedAt,
      // No odds observation was captured -- no captured_at-vs-cutoff_at question to answer, so
      // eligibility is "not applicable" (null), never a computed false. See isSnapshotEligible's
      // own doc comment and design doc section B.
      isEligible: null,
      provider: outcome.provider ?? null,
      oddsPlayer1Decimal: null,
      oddsPlayer2Decimal: null,
      normalizedProbabilityPlayer1: null,
      devigProbabilityPlayer1: null,
    };
  }

  if (
    !Number.isFinite(outcome.oddsPlayer1Decimal) ||
    !Number.isFinite(outcome.oddsPlayer2Decimal) ||
    outcome.oddsPlayer1Decimal <= 1 ||
    outcome.oddsPlayer2Decimal <= 1
  ) {
    throw new Error(
      `captureMarketSnapshot: refusing to capture non-decimal-odds input ` +
        `(player1=${outcome.oddsPlayer1Decimal}, player2=${outcome.oddsPlayer2Decimal}). ` +
        `Raw odds must be real, usable decimal prices (>1) — a caller with no real quote should not ` +
        `pass status: "included" (see fetchMarketOddsWithStatus's null-quote contract).`,
    );
  }

  const raw1 = 1 / outcome.oddsPlayer1Decimal;
  const raw2 = 1 / outcome.oddsPlayer2Decimal;
  const overround = raw1 + raw2;

  // Naive renormalized probability (the Builder's `1 / marketOdds` convention, generalized to
  // two-sided renormalization so it's comparable on the same 0-1 scale as the de-vig figure).
  const normalizedProbabilityPlayer1 = raw1 / overround;

  // Vig-adjusted implied probability, same formula the Prediction Engine already uses (kept on
  // the SAME 0-100 -> re-scaled to 0-1 convention here for storage consistency with
  // normalizedProbabilityPlayer1; both are derived once, from the same raw odds, here).
  const devigPercent = computeVigAdjustedImpliedProbability(outcome.oddsPlayer1Decimal, outcome.oddsPlayer2Decimal);
  if (devigPercent === null) {
    // Cannot happen given the guard above (same validity conditions), but fail loudly rather than
    // writing a null into what would otherwise be a populated column if the two validity checks
    // ever drift apart.
    throw new Error("captureMarketSnapshot: computeVigAdjustedImpliedProbability returned null for odds that passed validation — formula drift, refusing to write an inconsistent row.");
  }
  const devigProbabilityPlayer1 = devigPercent / 100;

  const isEligible = isSnapshotEligible(outcome.capturedAt, predictionCutoffAt);

  return {
    ...shared,
    captureStatus: "included",
    capturedAt: outcome.capturedAt,
    isEligible,
    provider: outcome.provider,
    oddsPlayer1Decimal: outcome.oddsPlayer1Decimal,
    oddsPlayer2Decimal: outcome.oddsPlayer2Decimal,
    normalizedProbabilityPlayer1,
    devigProbabilityPlayer1,
  };
}
