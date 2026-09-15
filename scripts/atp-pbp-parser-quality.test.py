#!/usr/bin/env python3
"""Unit tests for atp-pbp-parser-quality.py's pure classification logic (no network)."""
import importlib.util
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from lib.pbp_source_adapter import PBPRecord, VerificationStage

spec = importlib.util.spec_from_file_location("parser_quality", Path(__file__).parent / "atp-pbp-parser-quality.py")
parser_quality = importlib.util.module_from_spec(spec)
spec.loader.exec_module(parser_quality)
find_best_hist_match = parser_quality.find_best_hist_match


def make_record(**overrides) -> PBPRecord:
    defaults = dict(
        source="test", source_version=1, match_id="m1", tournament_id="t1",
        tournament_name="Australian Open", year=2012, tour="ATP_MAIN", level="G",
        surface="Hard", round="R32", date="2012-01-16",
        player_1="Novak Djokovic", player_2="Paul-Henri Mathieu",
        winner="Novak Djokovic", score="6-3 6-3 6-4", pbp_tape=None,
    )
    defaults.update(overrides)
    return PBPRecord(**defaults, stage=VerificationStage.RAW_SOURCE)


class TestFindBestHistMatch(unittest.TestCase):
    def test_clean_match_returns_no_reasons(self):
        p = make_record()
        hist = [make_record()]
        matched, reasons = find_best_hist_match(p, hist)
        self.assertIsNotNone(matched)
        self.assertIsNone(reasons)

    def test_score_mismatch_detected(self):
        p = make_record(score="6-3 6-3 6-4")
        hist = [make_record(score="7-5 6-3 6-4")]
        matched, reasons = find_best_hist_match(p, hist)
        self.assertIsNone(matched)
        self.assertIn("SCORE_MISMATCH", reasons)

    def test_tournament_mismatch_detected(self):
        p = make_record(tournament_name="Australian Open")
        hist = [make_record(tournament_name="Roland Garros")]
        matched, reasons = find_best_hist_match(p, hist)
        self.assertIsNone(matched)
        self.assertIn("TOURNAMENT_MISMATCH", reasons)

    def test_winner_mismatch_detected(self):
        p = make_record(winner="Novak Djokovic")
        hist = [make_record(winner="Paul-Henri Mathieu")]
        matched, reasons = find_best_hist_match(p, hist)
        self.assertIsNone(matched)
        self.assertIn("WINNER_MISMATCH", reasons)

    def test_multiple_mismatches_all_reported(self):
        p = make_record(score="6-3 6-3 6-4", winner="Novak Djokovic")
        hist = [make_record(score="7-5 6-3 6-4", winner="Paul-Henri Mathieu")]
        matched, reasons = find_best_hist_match(p, hist)
        self.assertIsNone(matched)
        self.assertIn("SCORE_MISMATCH", reasons)
        self.assertIn("WINNER_MISMATCH", reasons)

    def test_picks_closest_candidate_among_multiple_hist_rows(self):
        # Two hist candidates for the same pair (e.g. a real duplicate-tournament edge
        # case): one disagrees on everything, one disagrees on nothing -> must pick the clean one.
        p = make_record(score="6-3 6-3 6-4", tournament_name="Australian Open", winner="Novak Djokovic")
        bad_hist = make_record(score="1-6 1-6 1-6", tournament_name="Wimbledon", winner="Paul-Henri Mathieu")
        good_hist = make_record(score="6-3 6-3 6-4", tournament_name="Australian Open", winner="Novak Djokovic")
        matched, reasons = find_best_hist_match(p, [bad_hist, good_hist])
        self.assertIsNotNone(matched)
        self.assertIsNone(reasons)

    def test_reports_fewest_mismatches_when_no_clean_candidate_exists(self):
        p = make_record(score="6-3 6-3 6-4", tournament_name="Australian Open", winner="Novak Djokovic")
        worse = make_record(score="1-6 1-6 1-6", tournament_name="Wimbledon", winner="Paul-Henri Mathieu")
        closer = make_record(score="1-6 1-6 1-6", tournament_name="Australian Open", winner="Novak Djokovic")
        matched, reasons = find_best_hist_match(p, [worse, closer])
        self.assertIsNone(matched)
        self.assertEqual(reasons, ["SCORE_MISMATCH"])


if __name__ == "__main__":
    unittest.main()
