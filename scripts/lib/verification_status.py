"""
The full, non-collapsed PBP verification state (ATP main tour).

Extends PBPRecordEvidence (pbp_source_adapter.py, the license/authorization/
provenance axes) with the validation-progression axis requested for this
phase. These are DELIBERATELY separate dataclasses on separate concerns:
PBPRecordEvidence answers "is this source/record allowed to be used at all",
VerificationState answers "how far has THIS candidate actually progressed".
A record's full status is the combination of both -- never collapse either
into the other, and never collapse this into one boolean.

CRITICAL RELATIONSHIP (explicit task requirement): STRUCTURALLY_VALIDATED +
MATCH_CORROBORATED does NOT automatically imply PBP_CORROBORATED.
Match-level corroboration (winner/score/date/round/surface agree with an
independent source) and PBP-level corroboration (the actual point sequence
agrees with an independent source that ALSO supplies PBP) are different
claims requiring different evidence. See match_corroborated_from() and
pbp_corroborated_from()'s separate preconditions below.
"""
from __future__ import annotations
from dataclasses import dataclass
from enum import Enum
from typing import Optional


class ValidationLevel(Enum):
    CANDIDATE = "CANDIDATE"                        # raw, unvalidated PBP record
    STRUCTURALLY_VALIDATED = "STRUCTURALLY_VALIDATED"  # reconstruct_pbp() succeeds AND agrees with the identity-resolved historical record (source-declared score/winner)
    MATCH_CORROBORATED = "MATCH_CORROBORATED"      # STRUCTURALLY_VALIDATED, AND an independent source (different SourceFamily) confirms winner/score/date/round/surface
    PBP_CORROBORATED = "PBP_CORROBORATED"          # MATCH_CORROBORATED, AND an independent source that ALSO supplies PBP has a point sequence that normalizes to the same sequence
    LEVEL_1_VERIFIED = "LEVEL_1_VERIFIED"          # the existing production bar (verify-sackmann-pbp-v4.py's LEVEL_1_RESULT_VERIFIED_PBP) -- equivalent to MATCH_CORROBORATED for this pipeline; kept as an alias so existing terminology doesn't fork
    CONFLICT = "CONFLICT"                          # structurally valid but disagrees with the historical record, OR an independent source disagrees
    REVIEW_REQUIRED = "REVIEW_REQUIRED"            # ambiguous identity or ambiguous corroboration -- human judgment needed, never auto-resolved


class ProductionStatus(Enum):
    NOT_EVALUATED = "NOT_EVALUATED"
    LICENSE_BLOCKED = "LICENSE_BLOCKED"
    VALIDATION_BLOCKED = "VALIDATION_BLOCKED"
    PRODUCTION_ELIGIBLE = "PRODUCTION_ELIGIBLE"


@dataclass
class RecordStatus:
    """The complete status of one PBP candidate at a point in time. Six
    validation states x independent license status = the full space this
    pipeline must be able to represent, per the task's explicit example:
    'STRUCTURALLY_VALIDATED + LICENSE_BLOCKED + NOT_PRODUCTION_ELIGIBLE is a
    valid state.'"""
    validation: ValidationLevel
    license_status: "LicenseStatus"  # from pbp_source_adapter -- imported lazily below to avoid a circular import at module load

    @property
    def production_status(self) -> ProductionStatus:
        from .pbp_source_adapter import LicenseStatus
        if self.license_status in (LicenseStatus.NONCOMMERCIAL_ONLY, LicenseStatus.NOT_LICENSED_FOR_USE, LicenseStatus.LICENSE_UNCERTAIN):
            return ProductionStatus.LICENSE_BLOCKED
        if self.validation not in (ValidationLevel.MATCH_CORROBORATED, ValidationLevel.PBP_CORROBORATED, ValidationLevel.LEVEL_1_VERIFIED):
            return ProductionStatus.VALIDATION_BLOCKED
        return ProductionStatus.PRODUCTION_ELIGIBLE

    def summary(self) -> str:
        return f"{self.validation.value} / {self.license_status.value} / {self.production_status.value}"


def match_corroborated_from(structurally_validated: bool, independent_match_agrees: bool) -> ValidationLevel:
    """Preconditions for MATCH_CORROBORATED: must already be structurally
    validated, AND a genuinely independent source (see corroboration_source.is_independent)
    must confirm the match-level facts. Neither alone is sufficient."""
    if not structurally_validated:
        return ValidationLevel.CANDIDATE
    if not independent_match_agrees:
        return ValidationLevel.STRUCTURALLY_VALIDATED
    return ValidationLevel.MATCH_CORROBORATED


def pbp_corroborated_from(match_corroborated: bool, independent_pbp_agrees: Optional[bool]) -> ValidationLevel:
    """Preconditions for PBP_CORROBORATED: must already be MATCH_CORROBORATED,
    AND a (possibly different) independent source that itself supplies PBP
    must have a point sequence that normalizes to the same sequence.
    independent_pbp_agrees=None means no PBP-supplying independent source was
    available at all -- this correctly STAYS at MATCH_CORROBORATED, it does
    not default to either CONFLICT or PBP_CORROBORATED. This is the exact
    "does not automatically imply" relationship the task requires."""
    if not match_corroborated:
        return ValidationLevel.CANDIDATE  # caller should use match_corroborated_from's result instead when this is False
    if independent_pbp_agrees is None:
        return ValidationLevel.MATCH_CORROBORATED
    if independent_pbp_agrees:
        return ValidationLevel.PBP_CORROBORATED
    return ValidationLevel.CONFLICT
