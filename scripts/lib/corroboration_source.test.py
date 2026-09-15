#!/usr/bin/env python3
"""Unit tests for corroboration_source.py (no network access)."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from lib.pbp_source_adapter import LicenseStatus
from lib.corroboration_source import (
    SourceFamily, is_independent, CorroborationRecord, CorroborationSource,
    CorroborationOutcome, corroborate_match, CommercialEligibility,
    PBP_CANDIDATE_SOURCE_FAMILY, HIST_IDENTITY_SOURCE_FAMILY,
)


class FakeSource(CorroborationSource):
    def __init__(self, family, records):
        self.source_name = "fake"
        self.source_family = family
        self.license_status = LicenseStatus.APPROVED_COMMERCIAL
        self.commercial_eligibility = CommercialEligibility.ELIGIBLE
        self._records = records

    def lookup(self, player1, player2, year, tournament_hint=None):
        return self._records


class FailingSource(CorroborationSource):
    source_name = "failing"
    source_family = SourceFamily.OFFICIAL_TOUR
    license_status = LicenseStatus.APPROVED_COMMERCIAL
    commercial_eligibility = CommercialEligibility.ELIGIBLE

    def lookup(self, player1, player2, year, tournament_hint=None):
        raise ConnectionError("simulated network failure")


def make_record(**overrides) -> CorroborationRecord:
    defaults = dict(
        source="fake", source_family=SourceFamily.OFFICIAL_TOUR, source_record_id="r1",
        tournament="Miami Masters", date="2012-03-21", round="R32", surface="Hard",
        player1="Novak Djokovic", player2="Rafael Nadal", winner="Novak Djokovic", score="6-3 6-4",
    )
    defaults.update(overrides)
    return CorroborationRecord(**defaults)


class TestSourceFamilyIndependence(unittest.TestCase):
    def test_same_family_as_candidate_is_not_independent(self):
        self.assertFalse(is_independent(SourceFamily.SACKMANN_COMPILED, SourceFamily.SACKMANN_COMPILED))

    def test_ppaulojr_candidate_source_is_never_independent_of_itself(self):
        self.assertFalse(is_independent(PBP_CANDIDATE_SOURCE_FAMILY, PBP_CANDIDATE_SOURCE_FAMILY))

    def test_sackmann_hist_family_never_counts_as_independent_corroboration(self):
        # This is the core rule the task requires: Aneeshers mirror / direct
        # JeffSackmann / any other Sackmann-family mirror must never
        # corroborate a candidate that was ALREADY identity-resolved using
        # Sackmann-family hist data.
        self.assertFalse(is_independent(PBP_CANDIDATE_SOURCE_FAMILY, HIST_IDENTITY_SOURCE_FAMILY))

    def test_official_tour_is_independent_of_both_pipeline_sources(self):
        self.assertTrue(is_independent(PBP_CANDIDATE_SOURCE_FAMILY, SourceFamily.OFFICIAL_TOUR))

    def test_unknown_family_is_never_independent(self):
        # An unclassified source can't be trusted as independent -- forces
        # explicit classification before it can corroborate anything.
        self.assertFalse(is_independent(SourceFamily.OFFICIAL_TOUR, SourceFamily.UNKNOWN))

    def test_two_different_commercial_apis_are_independent_of_each_other(self):
        self.assertTrue(is_independent(SourceFamily.COMMERCIAL_API_TENNIS, SourceFamily.COMMERCIAL_SPORTRADAR))


class TestCorroborateMatch(unittest.TestCase):
    def test_not_independent_short_circuits_before_any_lookup(self):
        source = FakeSource(SourceFamily.SACKMANN_COMPILED, [make_record()])
        result = corroborate_match(PBP_CANDIDATE_SOURCE_FAMILY, "A", "B", "2012-03-21", "A", "6-3 6-4", source, 2012)
        self.assertEqual(result.outcome, CorroborationOutcome.NOT_INDEPENDENT)

    def test_corroborated_when_independent_and_agrees(self):
        source = FakeSource(SourceFamily.OFFICIAL_TOUR, [make_record()])
        result = corroborate_match(PBP_CANDIDATE_SOURCE_FAMILY, "Novak Djokovic", "Rafael Nadal", "2012-03-21", "Novak Djokovic", "6-3 6-4", source, 2012)
        self.assertEqual(result.outcome, CorroborationOutcome.CORROBORATED)
        self.assertIsNotNone(result.record)

    def test_not_found_when_source_has_no_records(self):
        source = FakeSource(SourceFamily.OFFICIAL_TOUR, [])
        result = corroborate_match(PBP_CANDIDATE_SOURCE_FAMILY, "A", "B", "2012-03-21", "A", "6-3 6-4", source, 2012)
        self.assertEqual(result.outcome, CorroborationOutcome.NOT_FOUND)

    def test_conflict_when_independent_record_disagrees(self):
        source = FakeSource(SourceFamily.OFFICIAL_TOUR, [make_record(winner="Rafael Nadal")])
        result = corroborate_match(PBP_CANDIDATE_SOURCE_FAMILY, "Novak Djokovic", "Rafael Nadal", "2012-03-21", "Novak Djokovic", "6-3 6-4", source, 2012)
        self.assertEqual(result.outcome, CorroborationOutcome.CONFLICT)

    def test_ambiguous_when_multiple_independent_records_agree_but_differ_from_each_other(self):
        r1 = make_record(source_record_id="r1", round="R32")
        r2 = make_record(source_record_id="r2", round="R16")
        source = FakeSource(SourceFamily.OFFICIAL_TOUR, [r1, r2])
        result = corroborate_match(PBP_CANDIDATE_SOURCE_FAMILY, "Novak Djokovic", "Rafael Nadal", "2012-03-21", "Novak Djokovic", "6-3 6-4", source, 2012)
        self.assertEqual(result.outcome, CorroborationOutcome.AMBIGUOUS)
        self.assertEqual(len(result.conflicting_records), 2)

    def test_source_error_is_surfaced_not_swallowed(self):
        result = corroborate_match(PBP_CANDIDATE_SOURCE_FAMILY, "A", "B", "2012-03-21", "A", "6-3 6-4", FailingSource(), 2012)
        self.assertEqual(result.outcome, CorroborationOutcome.SOURCE_ERROR)
        self.assertIn("ConnectionError", result.reason)


if __name__ == "__main__":
    unittest.main()
