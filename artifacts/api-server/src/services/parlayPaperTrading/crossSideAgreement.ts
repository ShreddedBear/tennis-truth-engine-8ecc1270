/**
 * Cross-side integrity check for double-sided evaluation.
 *
 * `builderPickedPlayerId` derives from the SAME underlying, symmetric evidence in both
 * directional passes (validationScore(A) + validationScore(B) ~= 100, propagated through a
 * shared monotonic calibration curve), so the two calls' independent picks should physically
 * agree in the overwhelming majority of cases. The one structural exception is the exact tie
 * boundary: `builderPickedPlayerId = calibratedProbability >= 50 ? selectedPlayerId : opponentId`
 * always resolves a 50-50 tie in favor of whichever player that specific call happened to be
 * evaluating -- so if EITHER side's calibrated probability lands exactly on 50, the two calls
 * can "disagree" purely as an artifact of that tie-break rule, not genuine model disagreement.
 *
 * Per the explicit project rule: disagreement of ANY kind (tie-boundary or not) fails closed --
 * never silently resolved by picking one side, never counted as a normal accuracy observation.
 * The two reason codes exist only so a human reviewing DATA_ERROR fixtures later can tell a
 * (harmless, expected) tie-boundary artifact apart from a (concerning, investigate-worthy)
 * genuine cross-side disagreement.
 */

export interface CrossSideEvaluationResult {
  builderPickedPlayerId: string;
  builderCalibratedProbability: number;
}

export type CrossSideAgreement =
  | { agreement: true; reason: null }
  | { agreement: false; reason: "TIE_BOUNDARY" | "MODEL_DISAGREEMENT"; detail: string };

export function deriveCrossSideAgreement(
  resultPlayer1: CrossSideEvaluationResult,
  resultPlayer2: CrossSideEvaluationResult,
): CrossSideAgreement {
  if (resultPlayer1.builderPickedPlayerId === resultPlayer2.builderPickedPlayerId) {
    return { agreement: true, reason: null };
  }

  const atTieBoundary =
    resultPlayer1.builderCalibratedProbability === 50 || resultPlayer2.builderCalibratedProbability === 50;

  if (atTieBoundary) {
    return {
      agreement: false,
      reason: "TIE_BOUNDARY",
      detail: `Player-1 evaluation calibrated probability ${resultPlayer1.builderCalibratedProbability}, ` +
        `Player-2 evaluation calibrated probability ${resultPlayer2.builderCalibratedProbability} -- one side is ` +
        `exactly at the 50/50 tie boundary, where the >=50-favors-selected rule can pick differently per side.`,
    };
  }

  return {
    agreement: false,
    reason: "MODEL_DISAGREEMENT",
    detail: `Player-1 evaluation picked ${resultPlayer1.builderPickedPlayerId} (probability ` +
      `${resultPlayer1.builderCalibratedProbability}); Player-2 evaluation picked ` +
      `${resultPlayer2.builderPickedPlayerId} (probability ${resultPlayer2.builderCalibratedProbability}) -- ` +
      `neither side is at the tie boundary, so this is NOT expected from symmetric evidence and warrants investigation.`,
  };
}
