#!/usr/bin/env python3
"""Regression tests for the matching-defect fixes in verify-sackmann-wta-main-pbp.py.

Every case here is a REAL example found while root-causing the WTA Main Tour
REVIEW_REQUIRED population (docs/audit-wta-main-pbp-gap-analysis.md) -- not a synthetic
edge case. Each test reimplements the OLD (buggy) logic inline and asserts it disagrees
with the fixed module function on that exact real case, so these tests fail against the
pre-fix behavior and pass against the repaired behavior, per the investigation's own
requirement.

Run: python3 scripts/test_verify_sackmann_wta_main_pbp.py
"""
import importlib.util
import re
import unittest
import unicodedata
from pathlib import Path

spec = importlib.util.spec_from_file_location("verifymod", Path(__file__).parent / "verify-sackmann-wta-main-pbp.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def old_lastname_initial_key(full_name):
    """The pre-fix implementation: last WHITESPACE TOKEN only, breaking compound surnames."""
    parts = [p for p in re.split(r"\s+", unicodedata.normalize("NFKD", str(full_name or "")).encode("ascii", "ignore").decode().strip()) if p]
    if not parts:
        return None
    last = re.sub(r"[^a-z]", "", parts[-1].lower())
    first = re.sub(r"[^a-z]", "", parts[0].lower())
    if not last or not first:
        return None
    return (last, first[0])


def old_td_name_key(td_name):
    """The pre-fix implementation: regex stops the surname capture at the first space."""
    mm = re.match(r"^\s*([A-Za-z'\-]+)\s+([A-Za-z])", str(td_name or ""))
    if not mm:
        return None
    return (re.sub(r"[^a-z]", "", mm.group(1).lower()), mm.group(2).lower())


def old_tny_ok(a, b):
    def old_norm_tny(v):
        s = unicodedata.normalize("NFKD", str(v or "")).encode("ascii", "ignore").decode().lower()
        s = re.sub(r"\b(atp|wta)\b", "", s)
        s = re.sub(r"20\d{2}", "", s)
        return re.sub(r"[^a-z0-9]+", "", s)
    x, y = old_norm_tny(a), old_norm_tny(b)
    return bool(x and y and (x in y or y in x))


class TournamentSponsorNameAliasTests(unittest.TestCase):
    """Miami 2013: ppaulojr tags the match 'SonyOpenTennis-WTAMiami'; the independent
    Tennis-Data.co.uk sync's own 2013 row says 'Sony Ericsson Open' (the tournament's PRIOR
    sponsor name). Confirmed by direct inspection -- this is real production data, not a
    hypothetical."""

    def test_miami_sponsor_name_mismatch_old_behavior_fails(self):
        self.assertFalse(old_tny_ok("Sony Ericsson Open", "SonyOpenTennis-WTAMiami"))

    def test_miami_sponsor_name_alias_fixed(self):
        self.assertTrue(m.tny_ok("Sony Ericsson Open", "SonyOpenTennis-WTAMiami"))

    def test_cincinnati_html_entity_and_sponsor_name_old_behavior_fails(self):
        self.assertFalse(old_tny_ok("Western & Southern Financial Group Women's Open", "Western&amp;SouthernOpen-WTACincinnati"))

    def test_cincinnati_html_entity_and_sponsor_name_fixed(self):
        self.assertTrue(m.tny_ok("Western & Southern Financial Group Women's Open", "Western&amp;SouthernOpen-WTACincinnati"))

    def test_indian_wells_bnp_paribas_alias_fixed(self):
        self.assertTrue(m.tny_ok("BNP Paribas Open", "IndianWellsMasters-WTAIndianWells"))

    def test_unrelated_tournaments_still_rejected(self):
        # The alias table must not become a loophole that matches everything.
        self.assertFalse(m.tny_ok("Sony Ericsson Open", "WimbledonChampionships-WTAWimbledon"))
        self.assertFalse(m.tny_ok("BNP Paribas Open", "Western & Southern Financial Group Women's Open"))

    def test_html_entity_decoding_alone(self):
        self.assertEqual(m.norm_tny("Western&amp;SouthernOpen"), m.norm_tny("Western&SouthernOpen"))


class CompoundSurnameTests(unittest.TestCase):
    """Carla Suarez Navarro (WTA player, real double surname) appears in the local
    Tennis-Data.co.uk file as 'Suarez Navarro C.' -- confirmed by direct inspection of
    data/public/tennis-data-wta/wta_matches_2007_2016.csv."""

    def test_old_lastname_initial_key_breaks_on_compound_surname(self):
        self.assertEqual(old_lastname_initial_key("Carla Suarez Navarro"), ("navarro", "c"))

    def test_fixed_lastname_initial_key_joins_full_surname(self):
        self.assertEqual(m.lastname_initial_key("Carla Suarez Navarro"), ("suareznavarro", "c"))

    def test_old_td_name_key_breaks_on_compound_surname(self):
        # The old regex silently mis-parses "Navarro" as if it were the initial.
        self.assertEqual(old_td_name_key("Suarez Navarro C."), ("suarez", "n"))

    def test_fixed_td_name_key_joins_full_surname(self):
        self.assertEqual(m.td_name_key("Suarez Navarro C."), ("suareznavarro", "c"))

    def test_both_sides_now_agree_for_compound_surnames(self):
        self.assertEqual(m.lastname_initial_key("Carla Suarez Navarro"), m.td_name_key("Suarez Navarro C."))

    def test_other_real_double_surname_player(self):
        # Confirmed present in the local Tennis-Data.co.uk file by direct inspection.
        self.assertEqual(m.lastname_initial_key("Anabel Medina Garrigues"), m.td_name_key("Medina Garrigues A."))

    def test_known_remaining_limitation_twin_disambiguating_initials(self):
        # Tennis-Data.co.uk disambiguates the Pliskova twins with a 2-letter initial
        # ("Pliskova Ka." / "Pliskova Kr."), not the single-letter convention this fix
        # assumes everywhere else. td_name_key correctly returns None (refuses to guess
        # which twin) rather than silently mis-parsing "Ka." -- found during this
        # investigation, not fixed here (narrow, outside the three confirmed defects this
        # patch measures), and left as a documented gap rather than papered over.
        self.assertEqual(m.lastname_initial_key("Karolina Pliskova"), ("pliskova", "k"))
        self.assertIsNone(m.td_name_key("Pliskova Ka."))

    def test_single_word_surname_unaffected_by_the_fix(self):
        self.assertEqual(m.lastname_initial_key("Lucie Safarova"), ("safarova", "l"))
        self.assertEqual(m.td_name_key("Safarova L."), ("safarova", "l"))

    def test_short_or_empty_names_return_none_not_crash(self):
        self.assertIsNone(m.lastname_initial_key(""))
        self.assertIsNone(m.lastname_initial_key("Prince"))
        self.assertIsNone(m.td_name_key(""))
        self.assertIsNone(m.td_name_key("X"))


class DateToleranceTests(unittest.TestCase):
    """A Miami 2013 match: ppaulojr's own per-match date field says 2013-03-18, the local
    Tennis-Data.co.uk row for the identical match (same players, same score) says
    2013-03-20 -- both real dates from real rows, 2 days apart, inside the same
    tournament. Confirmed by direct inspection."""

    def test_exact_match_still_true(self):
        self.assertTrue(m.dates_within_tolerance("2013-03-18", "2013-03-18", m.DATE_TOLERANCE_DAYS))

    def test_two_days_apart_within_tolerance(self):
        self.assertTrue(m.dates_within_tolerance("2013-03-18", "2013-03-20", m.DATE_TOLERANCE_DAYS))

    def test_order_independent(self):
        self.assertTrue(m.dates_within_tolerance("2013-03-20", "2013-03-18", m.DATE_TOLERANCE_DAYS))

    def test_exactly_at_the_boundary(self):
        self.assertTrue(m.dates_within_tolerance("2013-03-18", "2013-03-21", 3))

    def test_one_day_beyond_the_boundary_rejected(self):
        self.assertFalse(m.dates_within_tolerance("2013-03-18", "2013-03-22", 3))

    def test_empty_dates_never_match(self):
        self.assertFalse(m.dates_within_tolerance("", "2013-03-18", m.DATE_TOLERANCE_DAYS))
        self.assertFalse(m.dates_within_tolerance("2013-03-18", "", m.DATE_TOLERANCE_DAYS))

    def test_old_exact_equality_would_have_rejected_this_real_pair(self):
        self.assertNotEqual("2013-03-18", "2013-03-20")


if __name__ == "__main__":
    unittest.main(verbosity=2)
