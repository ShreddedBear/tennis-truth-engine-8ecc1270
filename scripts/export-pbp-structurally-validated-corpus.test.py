#!/usr/bin/env python3
"""Unit tests for export-pbp-structurally-validated-corpus.py's pure functions.

Focused on the orientation-flip bug found by atp-main-pbp-integrity-check.py's
score_agrees_with_reconstruction check during this session (1,924 of the first
4,065-record manifest's rows had `reconstructed.sets`/`winner` in ppaulojr's
own server1/server2 orientation instead of the exported player1Name/
player2Name (Sackmann winner-is-player1) orientation) -- this test pins that
exact regression down with synthetic fixtures so it can never silently
reappear.
"""
import importlib.util
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from lib.pbp_source_adapter import PBPRecord, VerificationStage


def one_sided_set(games: int, winner_is_index_0: bool) -> str:
    """Builds a legal `games`-0 set string for reconstruct_pbp, where the SAME absolute player
    (index 0 if winner_is_index_0 else index 1) wins every game. Server alternates each game (real
    tennis rule, and reconstruct_pbp's own game_winner enforces it) -- so "always index-0 wins"
    requires alternating "SSSS" (won as this game's server) and "RRRR" (won as this game's
    returner), never a flat repeat of "SSSS", which would actually alternate winners 3-3."""
    server_wins = "SSSS" if winner_is_index_0 else "RRRR"
    returner_wins = "RRRR" if winner_is_index_0 else "SSSS"
    return ";".join(server_wins if i % 2 == 0 else returner_wins for i in range(games))

_spec = importlib.util.spec_from_file_location("export_corpus", Path(__file__).parent / "export-pbp-structurally-validated-corpus.py")
_export = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_export)
resolve_and_validate = _export.resolve_and_validate
dedupe_by_key = None  # dedup is inline in export_year, not a standalone function -- see TestDedupeInline below


def make_hist(player_1, player_2, winner, score, tourney_id="2012-891", match_num="1"):
    return PBPRecord(
        source="Aneeshers/tennis-sackmann-archive", source_version=1,
        match_id=f"{tourney_id}-{match_num}", tournament_id=tourney_id, tournament_name="Chennai",
        year=2012, tour="ATP_MAIN", level="A", surface="Hard", round="R32", date="2012-01-02",
        player_1=player_1, player_2=player_2, winner=winner, score=score, pbp_tape=None,
        provenance={"winner_id": "1", "loser_id": "2", "match_num": match_num},
        stage=VerificationStage.RAW_SOURCE,
    )


def make_pbp(player_1, player_2, winner, score, pbp_tape, source_row=1):
    return PBPRecord(
        source="ppaulojr/tennis_pointbypoint", source_version=1,
        match_id=None, tournament_id=None, tournament_name="Chennai",
        year=2012, tour="ATP_MAIN", level=None, surface=None, round=None, date="2012-01-02",
        player_1=player_1, player_2=player_2, winner=winner, score=score, pbp_tape=pbp_tape,
        provenance={"source_file": "f.csv", "source_row": source_row, "pbp_sha256": f"sha-{source_row}"},
        stage=VerificationStage.RAW_SOURCE,
    )


class TestOrientationFlip(unittest.TestCase):
    """A real one-sided set (server always wins, "SSSS;SSSS") reconstructs as sets=[[6,0]] (or
    however many games) FROM THE TAPE'S OWN server1 perspective. Winner=Alice, score="6-0 6-0"."""

    def test_no_flip_needed_when_ppaulojr_player_1_is_the_winner(self):
        # ppaulojr's own player_1 IS the winner -- reconstructed.sets should already agree with
        # score as-is, no flip, and the returned canonical rec must equal player1(=winner)-first.
        # Alternating server each game (real tennis rule) with server always winning: 6 games of
        # "SSSS" per set, all won by server1 -> 6-0 6-0 from server1's own perspective.
        one_set = one_sided_set(6, winner_is_index_0=True)
        tape = one_set + "." + one_set
        hist = make_hist("Alice", "Bob", "Alice", "6-0 6-0")
        p = make_pbp("Alice", "Bob", "Alice", "6-0 6-0", tape)
        category, matched, rec, tier = resolve_and_validate(p, [hist])
        self.assertEqual(category, "internally_validated")
        self.assertEqual(rec["winner"], 0)
        self.assertEqual(rec["sets"], [[6, 0], [6, 0]])

    def test_flip_needed_when_ppaulojr_player_1_is_the_loser(self):
        # ppaulojr lists Bob (the LOSER) as player_1/server1, and server1 LOSES every game
        # ("RRRR" = returner wins every point) -- reconstruct_pbp always attributes game wins by
        # absolute index, so server1 (Bob, index 0) loses every game 6-0 6-0 from Bob's perspective,
        # i.e. rec["sets"] = [[0,6],[0,6]] raw. This must be flipped to [[6,0],[6,0]] (winner-first,
        # Alice=player1Name) before export.
        one_set = one_sided_set(6, winner_is_index_0=False)  # server1/index-0 (Bob) LOSES every game
        tape = one_set + "." + one_set
        hist = make_hist("Alice", "Bob", "Alice", "6-0 6-0")
        p = make_pbp("Bob", "Alice", "Alice", "6-0 6-0", tape)  # ppaulojr's own player_1 is Bob
        category, matched, rec, tier = resolve_and_validate(p, [hist])
        self.assertEqual(category, "internally_validated")
        # Exported rec must be in player1Name(=Alice=winner)-first orientation: Alice won 6-0 6-0.
        self.assertEqual(rec["winner"], 0, "winner must always be 0 (player1Name) in the exported rec")
        self.assertEqual(rec["sets"], [[6, 0], [6, 0]], "sets must be flipped to winner-first, not left in ppaulojr's raw server1-first orientation")

    def test_conflict_when_tape_disagrees_with_ppaulojrs_own_declared_score(self):
        # Identity resolves (p.score/p.winner AGREE with hist -- that's what makes this pair
        # RESOLVED, not UNRESOLVED), but the raw PBP tape itself reconstructs to a different score
        # than ppaulojr's own declared score column -- a genuine tape-vs-declared-score conflict,
        # the actual condition resolve_and_validate's "conflict" branch is for.
        one_set = one_sided_set(6, winner_is_index_0=True)
        tape = one_set + "." + one_set  # tape reconstructs to 6-0 6-0
        hist = make_hist("Alice", "Bob", "Alice", "6-1 6-0")
        p = make_pbp("Alice", "Bob", "Alice", "6-1 6-0", tape)  # declared score agrees with hist, tape doesn't
        category, matched, rec, tier = resolve_and_validate(p, [hist])
        self.assertEqual(category, "conflict")


class TestUnresolvedAndStructuralFailure(unittest.TestCase):
    def test_no_candidates_is_no_historical_player_pair(self):
        p = make_pbp("Nobody", "Else", "Nobody", "6-0 6-0", ";".join(["SSSS"] * 4))
        category, matched, rec, tier = resolve_and_validate(p, [])
        self.assertEqual(category, "no_historical_player_pair")
        self.assertIsNone(matched)

    def test_illegal_tape_is_structural_failure(self):
        hist = make_hist("Alice", "Bob", "Alice", "6-0 6-0")
        p = make_pbp("Alice", "Bob", "Alice", "6-0 6-0", "XXXX")  # illegal point codes; identity still resolves on declared score/winner
        category, matched, rec, tier = resolve_and_validate(p, [hist])
        self.assertEqual(category, "structural_failure")
        self.assertFalse(rec["valid"])


if __name__ == "__main__":
    unittest.main()
