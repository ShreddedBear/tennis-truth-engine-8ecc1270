#!/usr/bin/env python3
"""Unit tests for atp-main-pbp-integrity-check.py's individual check functions,
against synthetic manifest-shaped records (no network, no dependency on the
real committed export)."""
import importlib.util
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

_spec = importlib.util.spec_from_file_location("integrity_check", Path(__file__).parent / "atp-main-pbp-integrity-check.py")
_ic = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_ic)


def rec(**overrides):
    base = {
        "provider": "sackmann", "externalId": "2012-891-1", "tour": "ATP",
        "tournamentId": "2012-891", "tournamentName": "Chennai", "date": "2012-01-02",
        "player1Name": "Alice", "player2Name": "Bob", "winner": "Alice", "score": "6-2 6-3",
        "pbpSha256": "sha-1", "pbpSourceRow": 1,
        "reconstructed": {"valid": True, "sets": [[6, 2], [6, 3]], "winner": 0, "points": 100, "games": 17},
    }
    base.update(overrides)
    return base


class TestDuplicateChecks(unittest.TestCase):
    def test_duplicate_pbp_hashes_detected(self):
        passed, detail = _ic.check_duplicate_pbp_hashes([rec(externalId="A", pbpSha256="x"), rec(externalId="B", pbpSha256="x")])
        self.assertFalse(passed)
        self.assertEqual(detail["duplicate_count"], 1)

    def test_no_duplicate_hashes_passes(self):
        passed, _ = _ic.check_duplicate_pbp_hashes([rec(externalId="A", pbpSha256="x"), rec(externalId="B", pbpSha256="y")])
        self.assertTrue(passed)

    def test_duplicate_canonical_match_detected(self):
        passed, detail = _ic.check_duplicate_canonical_matches([rec(externalId="A", pbpSourceRow=1), rec(externalId="A", pbpSourceRow=2)])
        self.assertFalse(passed)
        self.assertEqual(detail["duplicate_count"], 1)


class TestWinnerAndScoreChecks(unittest.TestCase):
    def test_winner_is_always_player1_passes_when_true(self):
        passed, _ = _ic.check_winner_is_always_player1([rec(winner="Alice", player1Name="Alice")])
        self.assertTrue(passed)

    def test_winner_is_always_player1_fails_when_violated(self):
        passed, detail = _ic.check_winner_is_always_player1([rec(winner="Bob", player1Name="Alice")])
        self.assertFalse(passed)
        self.assertEqual(detail["violation_count"], 1)

    def test_score_agrees_with_reconstruction_passes_when_orientation_correct(self):
        passed, _ = _ic.check_score_agrees_with_reconstruction([rec(score="6-2 6-3", reconstructed={"valid": True, "sets": [[6, 2], [6, 3]]})])
        self.assertTrue(passed)

    def test_score_agrees_with_reconstruction_fails_on_flipped_orientation(self):
        # This is exactly the real bug this check caught during this session: reconstructed.sets
        # left in the raw server1-perspective (here, flipped relative to `score`) instead of the
        # winner-first orientation `score`/`player1Name` use.
        passed, detail = _ic.check_score_agrees_with_reconstruction([rec(score="6-2 6-3", reconstructed={"valid": True, "sets": [[2, 6], [3, 6]]})])
        self.assertFalse(passed)
        self.assertEqual(detail["violation_count"], 1)

    def test_malformed_pbp_excluded_fails_if_an_invalid_reconstruction_was_exported(self):
        passed, detail = _ic.check_malformed_pbp_excluded([rec(reconstructed={"valid": False, "reason": "ILLEGAL_GAME"})])
        self.assertFalse(passed)
        self.assertEqual(detail["violation_count"], 1)


class TestIdentityAndDateChecks(unittest.TestCase):
    def test_missing_tournament_id_fails(self):
        passed, detail = _ic.check_no_tournament_identity_missing([rec(tournamentId=None)])
        self.assertFalse(passed)
        self.assertEqual(detail["violation_count"], 1)

    def test_missing_date_fails(self):
        passed, _ = _ic.check_no_date_missing([rec(date=None)])
        self.assertFalse(passed)

    def test_malformed_date_fails_iso_check(self):
        passed, _ = _ic.check_date_is_valid_iso([rec(date="01/02/2012")])
        self.assertFalse(passed)

    def test_valid_date_passes(self):
        passed, _ = _ic.check_date_is_valid_iso([rec(date="2012-01-02")])
        self.assertTrue(passed)

    def test_cross_tour_contamination_fails_on_non_atp_tour(self):
        passed, detail = _ic.check_cross_tour_contamination([rec(tour="WTA")])
        self.assertFalse(passed)
        self.assertEqual(detail["violation_count"], 1)

    def test_no_canonical_id_fabrication_passes_for_a_real_derivation(self):
        passed, _ = _ic.check_no_canonical_id_fabrication([rec(tournamentId="2012-891", externalId="2012-891-1")])
        self.assertTrue(passed)

    def test_no_canonical_id_fabrication_fails_for_an_unrelated_id(self):
        passed, detail = _ic.check_no_canonical_id_fabrication([rec(tournamentId="2012-891", externalId="synthetic-123")])
        self.assertFalse(passed)
        self.assertEqual(detail["violation_count"], 1)


if __name__ == "__main__":
    unittest.main()
