#!/usr/bin/env python3
"""Unit tests for pbp_normalization.py (no network access -- synthetic
alternate-encoding fixtures only; see module docstring for why)."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from lib.pbp_normalization import (
    normalize_ppaulojr_encoding, normalize_generic_ws_l_encoding,
    compare_point_sequences, PointSequenceComparison, PointWinner,
)


class TestNormalizePpaulojrEncoding(unittest.TestCase):
    def test_basic_set_structure(self):
        canonical = normalize_ppaulojr_encoding("SSSS;RRRR")
        self.assertEqual(len(canonical), 1)  # one set
        self.assertEqual(len(canonical[0]), 2)  # two games
        self.assertEqual(len(canonical[0][0]), 4)  # four points
        self.assertTrue(all(p.winner == PointWinner.SERVER for p in canonical[0][0]))
        self.assertTrue(all(p.winner == PointWinner.RETURNER for p in canonical[0][1]))

    def test_ace_and_double_fault_map_to_correct_winner(self):
        canonical = normalize_ppaulojr_encoding("A;D")
        self.assertEqual(canonical[0][0][0].winner, PointWinner.SERVER)   # ace = server point
        self.assertTrue(canonical[0][0][0].is_terminal_shot)
        self.assertEqual(canonical[0][1][0].winner, PointWinner.RETURNER)  # double fault = returner point
        self.assertTrue(canonical[0][1][0].is_terminal_shot)

    def test_tiebreak_slash_marker_is_not_a_point(self):
        canonical = normalize_ppaulojr_encoding("SSSSSSS/RS")
        # 9 real points (7 S + / + R + S -> the '/' itself contributes nothing)
        self.assertEqual(len(canonical[0][0]), 9)

    def test_multiple_sets(self):
        canonical = normalize_ppaulojr_encoding("SSSS;RRRR.SSSS;RRRR")
        self.assertEqual(len(canonical), 2)


class TestCrossEncodingComparison(unittest.TestCase):
    """Proves the SAME match, described in two structurally different
    (synthetic) encodings, normalizes to an identical canonical form."""

    def test_identical_match_different_encodings_compares_identical(self):
        ppaulojr = normalize_ppaulojr_encoding("SSSS;RRRR")
        synthetic_alt = normalize_generic_ws_l_encoding("WWWW,LLLL")
        result = compare_point_sequences(ppaulojr, synthetic_alt)
        self.assertEqual(result.result, PointSequenceComparison.IDENTICAL)

    def test_different_set_separators_still_compare_correctly(self):
        ppaulojr = normalize_ppaulojr_encoding("SSSS;RRRR.SSSS;SSSS")
        synthetic_alt = normalize_generic_ws_l_encoding("WWWW,LLLL|WWWW,WWWW")
        result = compare_point_sequences(ppaulojr, synthetic_alt)
        self.assertEqual(result.result, PointSequenceComparison.IDENTICAL)

    def test_genuine_point_disagreement_is_detected_with_location(self):
        ppaulojr = normalize_ppaulojr_encoding("SSSS")
        synthetic_alt = normalize_generic_ws_l_encoding("WWWL")  # last point flipped
        result = compare_point_sequences(ppaulojr, synthetic_alt)
        self.assertEqual(result.result, PointSequenceComparison.POINT_DISAGREEMENT)
        self.assertEqual(result.first_disagreement, (0, 0, 3))

    def test_retirement_truncation_shows_as_different_length_not_a_false_point_disagreement(self):
        # One source has a complete match, the other truncates early (e.g. a
        # retirement recorded differently) -- must be reported as
        # DIFFERENT_LENGTH, a distinct signal from POINT_DISAGREEMENT, since
        # the cause (incomplete data) is different from a genuine factual
        # conflict.
        full = normalize_ppaulojr_encoding("SSSS;RRRR")
        truncated = normalize_ppaulojr_encoding("SSSS")
        result = compare_point_sequences(full, truncated)
        self.assertEqual(result.result, PointSequenceComparison.DIFFERENT_LENGTH)

    def test_ace_vs_regular_server_point_are_structurally_equivalent(self):
        # is_terminal_shot (A/D) is informational only -- an ace and a
        # regular server-won point must compare as agreeing.
        with_ace = normalize_ppaulojr_encoding("A")
        without_ace = normalize_ppaulojr_encoding("S")
        result = compare_point_sequences(with_ace, without_ace)
        self.assertEqual(result.result, PointSequenceComparison.IDENTICAL)


if __name__ == "__main__":
    unittest.main()
