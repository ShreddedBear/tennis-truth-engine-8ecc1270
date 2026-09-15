"""
Provider-neutral independent-corroboration interface (ATP main tour).

Generalizes the ad-hoc tennis-data.co.uk-specific logic in
verify-sackmann-pbp-v4.py's read_td() into a reusable contract, so any
legitimate source (official tour data, a commercial API, tennis-data.co.uk
once reachable) can plug in without changing what "corroborated" means.

CRITICAL: a corroborator does NOT need to supply PBP. Match-level
corroboration (winner/score/date/round/surface agree) and PBP-level
corroboration (the actual point sequence agrees) are deliberately separate
capabilities -- see MATCH_CORROBORATED vs PBP_CORROBORATED in
verification_status.py. Never conflate them.

SOURCE FAMILY is the other critical concept this module introduces: two
sources sharing the same underlying dataset must never be counted as two
independent corroborations. Aneeshers' mirror, a direct JeffSackmann fetch,
and any other GitHub mirror of the same compiled dataset all belong to
SourceFamily.SACKMANN_COMPILED -- corroborating a Sackmann-derived PBP
candidate's identity against ANOTHER Sackmann-family source proves nothing
about independence, even if the two "sources" have different URLs, repo
owners, or file formats.
"""
from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from .pbp_source_adapter import LicenseStatus


class SourceFamily(Enum):
    """Sources in the SAME family can never corroborate each other -- they
    are, or may be, the same underlying dataset republished. Only a
    corroboration from a DIFFERENT family counts as independent."""
    SACKMANN_COMPILED = "SACKMANN_COMPILED"          # JeffSackmann's own repos, Aneeshers mirror, farhadGithub mirror, any other GitHub mirror of the same compiled dataset
    PPAULOJR_COMPILED = "PPAULOJR_COMPILED"           # ppaulojr/tennis_pointbypoint -- unknown upstream provenance, treated as its own family until proven otherwise (see PBP_SOURCE_LICENSE_AUDIT.md)
    OFFICIAL_TOUR = "OFFICIAL_TOUR"                    # atptour.com / wtatennis.com direct
    TENNIS_DATA_CO_UK = "TENNIS_DATA_CO_UK"            # tennis-data.co.uk's own long-standing independent dataset
    COMMERCIAL_API_TENNIS = "COMMERCIAL_API_TENNIS"    # api-tennis.com (api.api-tennis.com)
    COMMERCIAL_MATCHSTAT_RAPIDAPI = "COMMERCIAL_MATCHSTAT_RAPIDAPI"  # tennis-api-atp-wta-itf.p.rapidapi.com
    COMMERCIAL_SPORTRADAR = "COMMERCIAL_SPORTRADAR"
    UNKNOWN = "UNKNOWN"


# The identity-resolution pipeline's OWN inputs, for reference -- a
# corroboration source drawn from either of these families proves nothing.
PBP_CANDIDATE_SOURCE_FAMILY = SourceFamily.PPAULOJR_COMPILED
HIST_IDENTITY_SOURCE_FAMILY = SourceFamily.SACKMANN_COMPILED


def is_independent(candidate_family: SourceFamily, corroborator_family: SourceFamily) -> bool:
    """A corroboration only counts if it comes from a genuinely different
    family than BOTH the PBP candidate's source AND the identity/hist source
    already used to resolve it -- corroborating a Sackmann-identity-resolved
    ppaulojr candidate against another Sackmann-family source, or against
    ppaulojr itself, proves nothing new."""
    if corroborator_family == SourceFamily.UNKNOWN:
        return False
    return corroborator_family not in (PBP_CANDIDATE_SOURCE_FAMILY, HIST_IDENTITY_SOURCE_FAMILY, candidate_family)


class CommercialEligibility(Enum):
    ELIGIBLE = "ELIGIBLE"
    NOT_ELIGIBLE = "NOT_ELIGIBLE"
    UNCONFIRMED = "UNCONFIRMED"  # terms not yet verified against a real contract/account


@dataclass
class CorroborationRecord:
    """What an independent source reports about a match. Does NOT need a pbp
    field -- match-level corroboration (this record) is a complete, valid
    outcome on its own."""
    source: str
    source_family: SourceFamily
    source_record_id: Optional[str]
    tournament: str
    date: Optional[str]
    round: Optional[str]
    surface: Optional[str]
    player1: str
    player2: str
    winner: Optional[str]
    score: Optional[str]
    provenance: dict = field(default_factory=dict)
    retrieved_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    license_status: LicenseStatus = LicenseStatus.LICENSE_UNCERTAIN
    commercial_eligibility: CommercialEligibility = CommercialEligibility.UNCONFIRMED
    pbp_tape: Optional[str] = None  # only set when the source ALSO happens to supply PBP


class CorroborationOutcome(Enum):
    CORROBORATED = "CORROBORATED"
    NOT_FOUND = "NOT_FOUND"
    CONFLICT = "CONFLICT"
    AMBIGUOUS = "AMBIGUOUS"
    SOURCE_ERROR = "SOURCE_ERROR"
    NOT_INDEPENDENT = "NOT_INDEPENDENT"  # the only source that responded belongs to a non-independent family


@dataclass
class CorroborationResult:
    outcome: CorroborationOutcome
    record: Optional[CorroborationRecord] = None
    conflicting_records: Optional[list[CorroborationRecord]] = None
    reason: str = ""


class CorroborationSource(ABC):
    """Contract every independent corroboration provider must implement. A
    corroborator does NOT need to provide PBP -- lookup() returning a
    CorroborationRecord with pbp_tape=None is a complete, valid,
    match-level-only corroboration."""
    source_name: str
    source_family: SourceFamily
    license_status: LicenseStatus
    commercial_eligibility: CommercialEligibility

    @abstractmethod
    def lookup(self, player1: str, player2: str, year: int, tournament_hint: Optional[str] = None) -> list[CorroborationRecord]:
        """Returns every candidate record this source has for this player
        pair in this year (empty list if none). Callers apply date/score/
        tournament comparison themselves -- this method's job is retrieval,
        not judgment, mirroring the existing candidate/dedup separation
        already used throughout this pipeline (e.g. AneeshersSackmannHistAdapter)."""
        raise NotImplementedError


def corroborate_match(
    candidate_family: SourceFamily,
    player1: str, player2: str, date: Optional[str], winner: Optional[str], score: Optional[str],
    source: CorroborationSource,
    year: int,
) -> CorroborationResult:
    """Match-level corroboration only -- see corroborate_pbp() (Phase 7,
    separate function) for point-level comparison. Never silently picks among
    multiple disagreeing records: returns AMBIGUOUS or CONFLICT explicitly."""
    if not is_independent(candidate_family, source.source_family):
        return CorroborationResult(CorroborationOutcome.NOT_INDEPENDENT,
                                    reason=f"{source.source_family.value} is not independent of {candidate_family.value}")
    try:
        records = source.lookup(player1, player2, year)
    except Exception as e:
        return CorroborationResult(CorroborationOutcome.SOURCE_ERROR, reason=f"{type(e).__name__}: {e}")

    if not records:
        return CorroborationResult(CorroborationOutcome.NOT_FOUND)

    from .pbp_source_adapter import norm_name, score_games
    agreeing = []
    disagreeing = []
    for r in records:
        if date and r.date and r.date != date:
            disagreeing.append(r)
            continue
        if winner and r.winner and norm_name(winner) != norm_name(r.winner):
            disagreeing.append(r)
            continue
        if score and r.score:
            try:
                if score_games(score) != score_games(r.score):
                    disagreeing.append(r)
                    continue
            except Exception:
                pass
        agreeing.append(r)

    if len(agreeing) == 1 and not disagreeing:
        return CorroborationResult(CorroborationOutcome.CORROBORATED, record=agreeing[0])
    if len(agreeing) > 1:
        return CorroborationResult(CorroborationOutcome.AMBIGUOUS, conflicting_records=agreeing,
                                    reason=f"{len(agreeing)} independent records all agree with the candidate but disagree with each other on some other field, or represent distinct meetings")
    if disagreeing and not agreeing:
        return CorroborationResult(CorroborationOutcome.CONFLICT, conflicting_records=disagreeing)
    return CorroborationResult(CorroborationOutcome.NOT_FOUND)
