#!/usr/bin/env python3
"""Unit tests for pbp_source_adapter.py's pure logic (no network calls)."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from lib.pbp_source_adapter import (
    pairkey, tny_ok, norm_name, norm_tny, parse_date, clean_score,
    score_games, game_winner, reconstruct_pbp,
    PBPRecord, VerificationStage, SourceRole, LicenseStatus,
    AneeshersSackmannHistAdapter, PpaulojrPbpAdapter,
    TennisDataCoUkAdapter, MatchChartingProjectAdapter,
    SourceAuthorization, SourceProvenance, ValidationState,
    CorroborationState, ProductionEligibility, PBPRecordEvidence,
    PPAULOJR_CURRENT_STATUS,
)


class TestNormalization(unittest.TestCase):
    def test_pairkey_is_order_independent(self):
        self.assertEqual(pairkey("Andy Murray", "Mikhail Kukushkin"),
                          pairkey("Mikhail Kukushkin", "Andy Murray"))

    def test_norm_name_strips_accents_and_case(self):
        self.assertEqual(norm_name("Novak Djokovic"), norm_name("NOVAK DJOKOVIC"))
        self.assertEqual(norm_name("Félix Auger-Aliassime"), norm_name("Felix AugerAliassime"))

    def test_tny_ok_matches_substrings(self):
        self.assertTrue(tny_ok("Australian Open", "Australian Open 2012"))
        self.assertTrue(tny_ok("Brisbane", "Brisbane International"))
        self.assertFalse(tny_ok("Brisbane", "Sydney"))

    def test_parse_date_handles_multiple_formats(self):
        self.assertEqual(parse_date("2012-01-01"), "2012-01-01")
        self.assertEqual(parse_date("01/01/2012"), "2012-01-01")
        self.assertEqual(parse_date("garbage"), "")

    def test_clean_score_strips_retirement_markers(self):
        self.assertEqual(clean_score("6-3 6-4 RET"), "6-3 6-4")

    def test_score_games_parses_set_scores(self):
        self.assertEqual(score_games("6-3 3-6 7-6(4)"), [(6, 3), (3, 6), (7, 6)])


class TestGameReconstruction(unittest.TestCase):
    def test_game_winner_server_holds(self):
        # server wins 4 points to 0 -> server (0) wins
        self.assertEqual(game_winner("SSSS", server=0), 0)

    def test_game_winner_returner_breaks(self):
        self.assertEqual(game_winner("RRRR", server=0), 1)

    def test_game_winner_illegal_terminates_early_then_continues(self):
        # extra points after the game already ended -> illegal
        self.assertIsNone(game_winner("SSSSS", server=0))

    def test_game_winner_tiebreak_requires_slash_for_serve_change(self):
        # a tiebreak without any '/' serve-change marker should still resolve normally
        result = game_winner("SSSSSSS", server=0, tb=True)
        self.assertEqual(result, 0)


class TestReconstructPbp(unittest.TestCase):
    def test_empty_pbp_is_invalid(self):
        self.assertFalse(reconstruct_pbp("")["valid"])

    def test_valid_simple_set(self):
        # Server alternates every game (real tennis), so to make player 0 win all
        # 6 games we need the WINNING SIDE to alternate between "server wins" (S)
        # and "returner wins" (R): game1 server=0 -> S gives P0 the game; game2
        # server=1 -> R gives P0 the game (since P0 is the returner); etc.
        one_set = ";".join(["SSSS", "RRRR"] * 3)
        result = reconstruct_pbp(one_set)  # a single set with no trailing '.' (sets are '.'-delimited, not '.'-terminated)
        self.assertTrue(result["valid"], result)
        self.assertEqual(result["winner"], 0)
        self.assertEqual(result["sets"], [[6, 0]])

    def test_illegal_set_score_rejected(self):
        # Server alternates but ALWAYS wins ("SSSS" every game) -> the winning
        # side naturally alternates too, producing a 5-4 tally after 9 games --
        # not a legal terminal set score (not >=6 with a 2-game gap, not 7-6/6-7).
        bad_set = ";".join(["SSSS"] * 9)
        result = reconstruct_pbp(bad_set)
        self.assertFalse(result["valid"])
        self.assertEqual(result["reason"], "ILLEGAL_SET")
        self.assertEqual(result["sets"], [[5, 4]])


class TestAdapterMetadata(unittest.TestCase):
    """Locks in each adapter's declared role/license -- these are policy
    decisions, not implementation details, so a change here should be
    deliberate and visible in a diff, not an accidental refactor."""

    def test_aneeshers_is_corroborator_only_not_pbp_source(self):
        a = AneeshersSackmannHistAdapter()
        self.assertEqual(a.role, SourceRole.CORROBORATOR)
        self.assertEqual(a.license_status, LicenseStatus.NONCOMMERCIAL_ONLY)

    def test_ppaulojr_is_pbp_source_with_uncertain_license(self):
        a = PpaulojrPbpAdapter()
        self.assertEqual(a.role, SourceRole.PBP_SOURCE)
        self.assertEqual(a.license_status, LicenseStatus.LICENSE_UNCERTAIN)

    def test_match_charting_project_is_noncommercial_only(self):
        a = MatchChartingProjectAdapter()
        self.assertEqual(a.license_status, LicenseStatus.NONCOMMERCIAL_ONLY)
        with self.assertRaises(NotImplementedError):
            a.fetch_year("ATP_MAIN", 2012)

    def test_tennis_data_adapter_fetch_year_not_implemented(self):
        # Deliberately not implemented here -- the real, fixed fetch logic
        # (retry/backoff/HTTP-fallback) lives only in verify-sackmann-pbp-v4.py
        # to avoid two divergent implementations of the same fix.
        a = TennisDataCoUkAdapter()
        with self.assertRaises(NotImplementedError):
            a.fetch_year("ATP_MAIN", 2012)


class TestPBPRecord(unittest.TestCase):
    def test_default_stage_is_raw_source(self):
        rec = PBPRecord(
            source="test", source_version=1, match_id=None, tournament_id=None,
            tournament_name="Test Open", year=2012, tour="ATP_MAIN", level="A",
            surface="Hard", round="R32", date="2012-01-01",
            player_1="A", player_2="B", winner="A", score="6-3 6-4", pbp_tape=None,
        )
        self.assertEqual(rec.stage, VerificationStage.RAW_SOURCE)


class TestMultiDimensionalStatus(unittest.TestCase):
    """These axes must never collapse into one boolean -- confirms the model can
    hold the exact 'valid but blocked' state the task requires."""

    def test_ppaulojr_worked_example_matches_task_spec(self):
        s = PPAULOJR_CURRENT_STATUS
        self.assertEqual(s.authorization, SourceAuthorization.AUTHORIZED)
        self.assertEqual(s.license, LicenseStatus.LICENSE_UNCERTAIN)
        self.assertEqual(s.validation, ValidationState.STRUCTURALLY_VALIDATED)
        self.assertEqual(s.corroboration, CorroborationState.CURRENTLY_NONE)
        # Structurally validated + license uncertain simultaneously -- not a contradiction.
        self.assertEqual(s.production_eligibility, ProductionEligibility.LICENSE_BLOCKED)

    def test_verified_but_still_license_blocked(self):
        # Even a fully VERIFIED (independently corroborated) record must stay
        # blocked from production if its license is unresolved -- license and
        # validation are independent gates, and license blocks regardless of
        # how strong the validation is.
        s = PBPRecordEvidence(
            authorization=SourceAuthorization.AUTHORIZED,
            license=LicenseStatus.LICENSE_UNCERTAIN,
            provenance=SourceProvenance.KNOWN,
            validation=ValidationState.VERIFIED,
            corroboration=CorroborationState.CORROBORATED,
        )
        self.assertEqual(s.production_eligibility, ProductionEligibility.LICENSE_BLOCKED)

    def test_commercially_licensed_but_not_yet_validated_is_still_blocked(self):
        # The reverse: a perfectly-licensed source with only a raw candidate
        # (no validation done yet) must also be blocked -- license alone is
        # not sufficient either.
        s = PBPRecordEvidence(
            authorization=SourceAuthorization.AUTHORIZED,
            license=LicenseStatus.APPROVED_COMMERCIAL,
            provenance=SourceProvenance.KNOWN,
            validation=ValidationState.CANDIDATE,
            corroboration=CorroborationState.NOT_ATTEMPTED,
        )
        self.assertEqual(s.production_eligibility, ProductionEligibility.VALIDATION_BLOCKED)

    def test_only_licensed_and_verified_together_are_eligible(self):
        s = PBPRecordEvidence(
            authorization=SourceAuthorization.AUTHORIZED,
            license=LicenseStatus.APPROVED_COMMERCIAL,
            provenance=SourceProvenance.KNOWN,
            validation=ValidationState.VERIFIED,
            corroboration=CorroborationState.CORROBORATED,
        )
        self.assertEqual(s.production_eligibility, ProductionEligibility.PRODUCTION_ELIGIBLE)

    def test_describe_never_claims_verified_for_uncorroborated_record(self):
        # Regression guard against ever wording an uncorroborated record's
        # description as if it were fully verified.
        text = PPAULOJR_CURRENT_STATUS.describe()
        self.assertNotIn("is independently corroborated", text)
        self.assertIn("not independently corroborated", text)


if __name__ == "__main__":
    unittest.main()
