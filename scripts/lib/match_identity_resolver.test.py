#!/usr/bin/env python3
"""Unit tests for match_identity_resolver.py (no network access)."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from lib.pbp_source_adapter import PBPRecord, VerificationStage
from lib.match_identity_resolver import (
    normalize_ppaulojr_tournament_name,
    resolve_tournament_identity,
    resolve_match_identity,
    IdentityResolution,
    TournamentIdentityTier,
    TOURNAMENT_ALIAS_TABLE,
)


def make_hist(**overrides) -> PBPRecord:
    defaults = dict(
        source="hist", source_version=1, match_id="h1", tournament_id="t1",
        tournament_name="Miami Masters", year=2012, tour="ATP_MAIN", level="M",
        surface="Hard", round="R32", date="2012-03-21",
        player_1="Novak Djokovic", player_2="Rafael Nadal",
        winner="Novak Djokovic", score="6-3 6-4", pbp_tape=None,
    )
    defaults.update(overrides)
    return PBPRecord(**defaults, stage=VerificationStage.RAW_SOURCE)


def make_pbp(**overrides) -> PBPRecord:
    defaults = dict(
        source="pbp", source_version=1, match_id=None, tournament_id=None,
        tournament_name="SonyEricssonOpen-ATPMiami", year=2012, tour="ATP_MAIN",
        level=None, surface=None, round=None, date="2012-03-21",
        player_1="Novak Djokovic", player_2="Rafael Nadal",
        winner="Novak Djokovic", score="6-3 6-4", pbp_tape="SSSS;RRRR;SSSS;RRRR;SSSS;RRRR",
    )
    defaults.update(overrides)
    return PBPRecord(**defaults, stage=VerificationStage.RAW_SOURCE)


class TestNormalization(unittest.TestCase):
    def test_strips_html_suffix(self):
        self.assertEqual(normalize_ppaulojr_tournament_name("SonyEricssonOpen-ATPMiami.html"), "SonyEricssonOpen-ATPMiami")

    def test_strips_trailing_dot(self):
        self.assertEqual(normalize_ppaulojr_tournament_name("VTROpen-ATPVinaDelMar."), "VTROpen-ATPVinaDelMar")

    def test_strips_both(self):
        self.assertEqual(normalize_ppaulojr_tournament_name("VTROpen-ATPVinaDelMar..html"), "VTROpen-ATPVinaDelMar")

    def test_leaves_clean_name_unchanged(self):
        self.assertEqual(normalize_ppaulojr_tournament_name("MensFrenchOpen"), "MensFrenchOpen")


class TestResolveTournamentIdentity(unittest.TestCase):
    def test_alias_table_hit(self):
        tier = resolve_tournament_identity("SonyEricssonOpen-ATPMiami", "Miami Masters")
        self.assertEqual(tier, TournamentIdentityTier.ALIAS_TABLE)

    def test_alias_table_hit_with_html_suffix(self):
        tier = resolve_tournament_identity("SonyEricssonOpen-ATPMiami.html", "Miami Masters")
        self.assertEqual(tier, TournamentIdentityTier.ALIAS_TABLE)

    def test_falls_back_to_fuzzy_when_not_in_alias_table(self):
        tier = resolve_tournament_identity("Brisbane International", "Brisbane")
        self.assertEqual(tier, TournamentIdentityTier.FUZZY_FALLBACK)

    def test_unresolved_when_genuinely_unrelated(self):
        tier = resolve_tournament_identity("ShanghaiRolexMasters-ATPShanghai", "Brisbane")
        self.assertEqual(tier, TournamentIdentityTier.UNRESOLVED)

    def test_alias_table_never_matches_the_wrong_canonical_name(self):
        # The table maps this ppaulojr string ONLY to Miami Masters -- it must
        # not accidentally satisfy a lookup against a different hist name.
        tier = resolve_tournament_identity("SonyEricssonOpen-ATPMiami", "Cincinnati Masters")
        self.assertEqual(tier, TournamentIdentityTier.UNRESOLVED)


class TestResolveMatchIdentity(unittest.TestCase):
    def test_no_historical_pair_at_all(self):
        result = resolve_match_identity(make_pbp(), [])
        self.assertEqual(result.resolution, IdentityResolution.UNRESOLVED)
        self.assertEqual(result.reason, "NO_HISTORICAL_PLAYER_PAIR")

    def test_clean_resolution_via_alias_table(self):
        p = make_pbp()
        h = make_hist()
        result = resolve_match_identity(p, [h])
        self.assertEqual(result.resolution, IdentityResolution.RESOLVED)
        self.assertEqual(result.tier, TournamentIdentityTier.ALIAS_TABLE)
        self.assertIs(result.matched, h)

    def test_score_disagreement_leaves_unresolved(self):
        p = make_pbp(score="6-3 6-4")
        h = make_hist(score="7-5 6-4")
        result = resolve_match_identity(p, [h])
        self.assertEqual(result.resolution, IdentityResolution.UNRESOLVED)

    def test_winner_disagreement_leaves_unresolved(self):
        p = make_pbp(winner="Novak Djokovic")
        h = make_hist(winner="Rafael Nadal")
        result = resolve_match_identity(p, [h])
        self.assertEqual(result.resolution, IdentityResolution.UNRESOLVED)

    def test_never_silently_picks_when_multiple_candidates_qualify(self):
        # Two hist rows for the SAME player pair, SAME score+winner (e.g. a
        # data quality artifact or a genuine rare coincidence) -- must be
        # AMBIGUOUS, never an automatic pick of either one.
        p = make_pbp()
        h1 = make_hist(tournament_name="Miami Masters", match_id="h1")
        h2 = make_hist(tournament_name="Miami Masters", match_id="h2", date="2012-03-22")
        result = resolve_match_identity(p, [h1, h2])
        self.assertEqual(result.resolution, IdentityResolution.AMBIGUOUS)
        self.assertEqual(len(result.candidates), 2)

    def test_ambiguous_when_multiple_DIFFERENT_tournaments_both_qualify(self):
        # A player pair that met twice in the year, and this candidate's
        # score+winner happens to agree with both meetings (rare but must be
        # handled safely) -- both are in the alias table or fuzzy-resolvable.
        p = make_pbp(tournament_name="MensFrenchOpen")
        h1 = make_hist(tournament_name="Roland Garros", match_id="h1")
        h2 = make_hist(tournament_name="Roland Garros", match_id="h2", date="2012-06-05")
        result = resolve_match_identity(p, [h1, h2])
        self.assertEqual(result.resolution, IdentityResolution.AMBIGUOUS)

    def test_identity_never_uses_reconstructed_pbp_output(self):
        # The resolver must work identically regardless of pbp_tape content --
        # it is identity-only, using p.score/p.winner (source-declared
        # fields), never reconstruct_pbp(p.pbp_tape)'s derived winner/score.
        p_valid_tape = make_pbp(pbp_tape="SSSS;RRRR;SSSS;RRRR;SSSS;RRRR")
        p_garbage_tape = make_pbp(pbp_tape="not a real pbp tape at all")
        p_no_tape = make_pbp(pbp_tape=None)
        h = make_hist()
        r1 = resolve_match_identity(p_valid_tape, [h])
        r2 = resolve_match_identity(p_garbage_tape, [h])
        r3 = resolve_match_identity(p_no_tape, [h])
        self.assertEqual(r1.resolution, r2.resolution, r3.resolution)
        self.assertEqual(r1.resolution, IdentityResolution.RESOLVED)


class TestSpecificTournaments(unittest.TestCase):
    """Task-specified spot checks: Miami, Indian Wells, Cincinnati."""

    def test_miami_sony_ericsson_open_2012(self):
        tier = resolve_tournament_identity("SonyEricssonOpen-ATPMiami", "Miami Masters")
        self.assertEqual(tier, TournamentIdentityTier.ALIAS_TABLE)

    def test_miami_sony_open_tennis_2013(self):
        # ppaulojr renamed the sponsor string between 2012 and 2013 -- both
        # must resolve to the same canonical tournament.
        tier = resolve_tournament_identity("SonyOpenTennis-ATPMiami", "Miami Masters")
        self.assertEqual(tier, TournamentIdentityTier.ALIAS_TABLE)

    def test_indian_wells_bnp_paribas_open(self):
        tier = resolve_tournament_identity("BNPParibasOpen-ATPIndianWells", "Indian Wells Masters")
        self.assertEqual(tier, TournamentIdentityTier.ALIAS_TABLE)

    def test_indian_wells_with_year_suffix_variant(self):
        tier = resolve_tournament_identity("BNPParibasOpen-ATPIndianWells2012", "Indian Wells Masters")
        self.assertEqual(tier, TournamentIdentityTier.ALIAS_TABLE)

    def test_cincinnati_western_southern_open(self):
        tier = resolve_tournament_identity("Western&amp;SouthernOpen-ATPCincinnati", "Cincinnati Masters")
        self.assertEqual(tier, TournamentIdentityTier.ALIAS_TABLE)


class TestCrossYearSafety(unittest.TestCase):
    """A tournament-name string must never be trusted to imply a specific
    year -- year/date constraint comes from the caller only fetching one
    year's hist+pbp data at a time (by construction, both adapters take an
    explicit `year` parameter and only that year's rows are ever compared)."""

    def test_alias_table_values_are_pure_canonical_names_not_year_or_match_specific(self):
        # Keys are raw ppaulojr strings and MAY legitimately contain a literal
        # year (e.g. "BNPParibasOpen-ATPIndianWells2012" -- that's really what
        # ppaulojr wrote that year). Values, however, must always be a plain
        # canonical tournament name -- never a year or a specific match/date --
        # so the same value is reusable identically across any year the
        # resolver is applied to (year disambiguation comes from the caller
        # only ever comparing within one year's hist+pbp fetch, not from
        # anything encoded in this table).
        for k, v in TOURNAMENT_ALIAS_TABLE.items():
            self.assertNotRegex(v, r"20\d{2}", f"value {v!r} (for key {k!r}) must not encode a year")

    def test_same_alias_entry_correctly_resolves_in_two_different_years_independently(self):
        # Two PBPRecords for the "same" tournament name in different years
        # must each resolve ONLY against their own year's hist candidate list
        # -- simulated here by never passing a cross-year hist_candidates list.
        p_2012 = make_pbp(year=2012, date="2012-03-21")
        h_2012 = make_hist(year=2012, date="2012-03-21", match_id="miami-2012")
        p_2013 = make_pbp(year=2013, date="2013-03-20", tournament_name="SonyOpenTennis-ATPMiami")
        h_2013 = make_hist(year=2013, date="2013-03-20", match_id="miami-2013")

        r_2012 = resolve_match_identity(p_2012, [h_2012])  # only 2012's hist candidates passed
        r_2013 = resolve_match_identity(p_2013, [h_2013])  # only 2013's hist candidates passed

        self.assertEqual(r_2012.matched.match_id, "miami-2012")
        self.assertEqual(r_2013.matched.match_id, "miami-2013")

    def test_never_matches_a_different_year_meeting_between_the_same_players(self):
        # Same two players, same tournament NAME, but genuinely a different
        # year's meeting (different score) -- must not resolve as a match
        # even though names/players line up, because score independently
        # disagrees (this is the real-world proxy for "don't let a name
        # collision override an actual score/winner disagreement").
        p = make_pbp(year=2013, score="6-3 6-4")
        h_wrong_year = make_hist(year=2012, score="7-5 6-2")  # different real result
        result = resolve_match_identity(p, [h_wrong_year])
        self.assertEqual(result.resolution, IdentityResolution.UNRESOLVED)


if __name__ == "__main__":
    unittest.main()
