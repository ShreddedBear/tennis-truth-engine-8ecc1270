"""
Cross-provider point-sequence normalization (Phase 7: PBP-specific
corroboration). Converts any provider's raw point-sequence encoding into a
canonical intermediate form so two DIFFERENT encodings of the same match can
be compared for agreement without requiring byte-for-byte tape identity.

IMPORTANT CAVEAT: no second PBP-supplying independent source is actually
integrated or reachable this session (see PBP_PIPELINE_ARCHITECTURE.md's
Phase 2 corroboration-source research -- MatchStat/RapidAPI and Sportradar
are real leads but neither is wired up here). This module is therefore
built and unit-tested against SYNTHETIC alternate-encoding fixtures that
demonstrate the normalization handles the documented difference classes
(server/point notation, tiebreak, advantage, set separators, retirement) --
it has NOT been run against a second real provider's actual output. Treat
compare_point_sequences() as ready-to-wire, not as evidence that any real
cross-provider PBP corroboration has happened.

Canonical form: a list of sets, each a list of games, each game a list of
points, each point one of "SERVER" or "RETURNER" (who won that point) plus a
flag for whether it was an ace/double-fault (kept for informational parity
with ppaulojr's own A/D notation, not required for agreement comparison).
Retirements are represented as a truncated set list (fewer games than a
complete match) rather than a special sentinel -- two sources that both
truncate at the same point agree; if one shows a completed final game the
other doesn't, that is a genuine disagreement, not a normalization artifact.
"""
from __future__ import annotations
from dataclasses import dataclass
from enum import Enum
from typing import Optional


class PointWinner(Enum):
    SERVER = "SERVER"
    RETURNER = "RETURNER"


@dataclass(frozen=True)
class CanonicalPoint:
    winner: PointWinner
    is_terminal_shot: bool = False  # ace or double fault -- informational only


CanonicalGame = list[CanonicalPoint]
CanonicalSet = list[CanonicalGame]
CanonicalMatch = list[CanonicalSet]


def normalize_ppaulojr_encoding(raw: str) -> CanonicalMatch:
    """ppaulojr's own encoding: '.'-delimited sets, ';'-delimited games,
    characters S(server point)/R(returner point)/A(ace)/D(double fault),
    '/' marks a mid-tiebreak serve change (not a point itself)."""
    match: CanonicalMatch = []
    for blob in raw.strip().split("."):
        if not blob:
            continue
        games: CanonicalSet = []
        for game_str in (g for g in blob.split(";") if g):
            points: CanonicalGame = []
            for ch in game_str:
                if ch == "/":
                    continue  # serve-change marker, not a point
                if ch == "S":
                    points.append(CanonicalPoint(PointWinner.SERVER))
                elif ch == "R":
                    points.append(CanonicalPoint(PointWinner.RETURNER))
                elif ch == "A":
                    points.append(CanonicalPoint(PointWinner.SERVER, is_terminal_shot=True))
                elif ch == "D":
                    points.append(CanonicalPoint(PointWinner.RETURNER, is_terminal_shot=True))
            games.append(points)
        match.append(games)
    return match


def normalize_generic_ws_l_encoding(raw: str, set_sep: str = "|", game_sep: str = ",", win_char: str = "W", lose_char: str = "L") -> CanonicalMatch:
    """A SYNTHETIC alternate encoding used only to prove the normalization
    concept in tests: a hypothetical provider that separates sets with '|',
    games with ',', and marks each point 'W' (server won) / 'L' (server
    lost, i.e. returner won) instead of ppaulojr's S/R. This function is not
    tied to any real integrated provider -- see module docstring."""
    match: CanonicalMatch = []
    for blob in raw.strip().split(set_sep):
        if not blob:
            continue
        games: CanonicalSet = []
        for game_str in (g for g in blob.split(game_sep) if g):
            points = [CanonicalPoint(PointWinner.SERVER if ch == win_char else PointWinner.RETURNER) for ch in game_str]
            games.append(points)
        match.append(games)
    return match


class PointSequenceComparison(Enum):
    IDENTICAL = "IDENTICAL"                # canonical forms match exactly
    DIFFERENT_LENGTH = "DIFFERENT_LENGTH"  # different number of sets/games -- e.g. one source recorded a retirement, the other didn't
    POINT_DISAGREEMENT = "POINT_DISAGREEMENT"  # same structure, at least one point's winner disagrees


@dataclass
class PointSequenceComparisonResult:
    result: PointSequenceComparison
    first_disagreement: Optional[tuple[int, int, int]] = None  # (set_idx, game_idx, point_idx)


def compare_point_sequences(a: CanonicalMatch, b: CanonicalMatch) -> PointSequenceComparisonResult:
    """Structural, not textual, comparison -- ignores is_terminal_shot (an
    ace vs. a regular server-won point are the same PointWinner outcome for
    match-consistency purposes; the A/D distinction is informational, not
    load-bearing for agreement)."""
    if len(a) != len(b):
        return PointSequenceComparisonResult(PointSequenceComparison.DIFFERENT_LENGTH)
    for si, (set_a, set_b) in enumerate(zip(a, b)):
        if len(set_a) != len(set_b):
            return PointSequenceComparisonResult(PointSequenceComparison.DIFFERENT_LENGTH)
        for gi, (game_a, game_b) in enumerate(zip(set_a, set_b)):
            if len(game_a) != len(game_b):
                return PointSequenceComparisonResult(PointSequenceComparison.DIFFERENT_LENGTH)
            for pi, (pa, pb) in enumerate(zip(game_a, game_b)):
                if pa.winner != pb.winner:
                    return PointSequenceComparisonResult(PointSequenceComparison.POINT_DISAGREEMENT, first_disagreement=(si, gi, pi))
    return PointSequenceComparisonResult(PointSequenceComparison.IDENTICAL)
