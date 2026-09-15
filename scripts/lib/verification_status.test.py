#!/usr/bin/env python3
"""Unit tests for verification_status.py (no network access)."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from lib.pbp_source_adapter import LicenseStatus
from lib.verification_status import (
    ValidationLevel, ProductionStatus, RecordStatus,
    match_corroborated_from, pbp_corroborated_from,
)


class TestMatchCorroboratedFrom(unittest.TestCase):
    def test_stays_candidate_when_not_structurally_validated(self):
        self.assertEqual(match_corroborated_from(False, True), ValidationLevel.CANDIDATE)

    def test_stops_at_structurally_validated_without_independent_agreement(self):
        self.assertEqual(match_corroborated_from(True, False), ValidationLevel.STRUCTURALLY_VALIDATED)

    def test_reaches_match_corroborated_only_with_both(self):
        self.assertEqual(match_corroborated_from(True, True), ValidationLevel.MATCH_CORROBORATED)


class TestPbpCorroboratedFrom(unittest.TestCase):
    def test_no_pbp_supplying_source_stays_at_match_corroborated_not_conflict(self):
        # This is the exact "does not automatically imply" relationship the
        # task requires: absence of PBP-level evidence is NOT a conflict.
        self.assertEqual(pbp_corroborated_from(True, None), ValidationLevel.MATCH_CORROBORATED)

    def test_agreeing_independent_pbp_reaches_pbp_corroborated(self):
        self.assertEqual(pbp_corroborated_from(True, True), ValidationLevel.PBP_CORROBORATED)

    def test_disagreeing_independent_pbp_is_a_conflict(self):
        self.assertEqual(pbp_corroborated_from(True, False), ValidationLevel.CONFLICT)

    def test_cannot_reach_pbp_corroborated_without_match_corroboration_first(self):
        self.assertEqual(pbp_corroborated_from(False, True), ValidationLevel.CANDIDATE)


class TestRecordStatus(unittest.TestCase):
    def test_structurally_validated_plus_license_uncertain_is_a_valid_non_contradictory_state(self):
        # The exact example from the task: STRUCTURALLY_VALIDATED +
        # LICENSE_BLOCKED + NOT_PRODUCTION_ELIGIBLE simultaneously.
        s = RecordStatus(validation=ValidationLevel.STRUCTURALLY_VALIDATED, license_status=LicenseStatus.LICENSE_UNCERTAIN)
        self.assertEqual(s.validation, ValidationLevel.STRUCTURALLY_VALIDATED)
        self.assertEqual(s.production_status, ProductionStatus.LICENSE_BLOCKED)

    def test_match_corroborated_but_still_license_blocked(self):
        s = RecordStatus(validation=ValidationLevel.MATCH_CORROBORATED, license_status=LicenseStatus.NONCOMMERCIAL_ONLY)
        self.assertEqual(s.production_status, ProductionStatus.LICENSE_BLOCKED)

    def test_licensed_but_not_yet_corroborated_is_validation_blocked_not_eligible(self):
        s = RecordStatus(validation=ValidationLevel.STRUCTURALLY_VALIDATED, license_status=LicenseStatus.APPROVED_COMMERCIAL)
        self.assertEqual(s.production_status, ProductionStatus.VALIDATION_BLOCKED)

    def test_only_licensed_and_match_corroborated_together_are_eligible(self):
        s = RecordStatus(validation=ValidationLevel.MATCH_CORROBORATED, license_status=LicenseStatus.APPROVED_COMMERCIAL)
        self.assertEqual(s.production_status, ProductionStatus.PRODUCTION_ELIGIBLE)

    def test_pbp_corroborated_does_not_lower_eligibility_vs_match_corroborated(self):
        s = RecordStatus(validation=ValidationLevel.PBP_CORROBORATED, license_status=LicenseStatus.APPROVED_COMMERCIAL)
        self.assertEqual(s.production_status, ProductionStatus.PRODUCTION_ELIGIBLE)


if __name__ == "__main__":
    unittest.main()
