"""
Deterministic, auditable canonical match-identity resolver (ATP main tour).

Separates IDENTITY RESOLUTION (which historical match does this PBP candidate
correspond to?) from PBP VALIDATION (does the raw point-sequence tape itself
reconstruct correctly and agree with that now-identified historical match?).
Identity resolution here uses ONLY source-declared fields (player names, date,
p.score, p.winner as ppaulojr's CSV states them) -- it never uses
reconstruct_pbp(p.pbp_tape)'s output as identity evidence, since that would be
circular (using the tape to validate its own identity match). See
docs/MATCH_IDENTITY_RESOLVER.md for the full design and audit.

Priority order actually available from these two sources (neither ppaulojr nor
the Aneeshers hist CSV row exposes a shared stable ID across sources -- see
that doc for why tiers 1-4 of the originally-proposed priority list are not
reachable from this data):

  1. Exact stable tournament ID shared by both sources         -- NOT AVAILABLE
  2. Exact canonical tournament mapping via a shared ID          -- NOT AVAILABLE
  3. Tournament + year + location                                -- NOT AVAILABLE (ppaulojr has no location field)
  4. Tournament + year + surface + date range                    -- NOT AVAILABLE (ppaulojr has no surface field)
  5. Tournament + year + normalized name (fuzzy substring)        -- existing tny_ok, kept as LAST RESORT only
  6. Controlled alias table, built from repeated cross-validated  -- THIS MODULE's main contribution
     evidence (score+winner agree independently, tournament name
     disagrees, pattern repeats >=2 times across the corpus)
  7. Fuzzy matching ONLY for candidate generation, never silent
     verification on its own                                      -- tny_ok remains gated by an
                                                                       independently-agreeing score+winner,
                                                                       exactly as before

CRITICAL SAFETY RULE proven necessary by this session's own mining process: a
single (ppaulojr_name, hist_name) disagreement pair that appears only ONCE in
the corpus is NOT trusted into the alias table, because a player pair that met
more than once in a year can coincidentally share a score+winner with the
WRONG meeting. Real example found and deliberately EXCLUDED:
'ShanghaiRolexMasters-ATPShanghai' vs 'Brisbane' (appeared once; genuinely
unrelated tournaments, same score by coincidence). The table below only
contains pairs observed >=2 times across the combined 2012+2013 corpus,
manually reviewed for real-world plausibility (every entry is a well-known
ATP tournament's sponsor-name/city-name variant).
"""
from __future__ import annotations
from dataclasses import dataclass
from enum import Enum
from typing import Optional

from .pbp_source_adapter import PBPRecord, score_games, norm_name, tny_ok


def normalize_ppaulojr_tournament_name(name: str) -> str:
    """Strips the scraping artifacts specific to ppaulojr's tny_name field
    (trailing '.html', trailing '.') so 'Foo-ATPBar.html' and 'Foo-ATPBar.'
    and 'Foo-ATPBar' all normalize to the same alias-table key. This is exact
    literal stripping, not approximate/fuzzy matching."""
    n = name.strip()
    if n.endswith(".html"):
        n = n[: -len(".html")]
    n = n.rstrip(".")
    return n


# Built by scripts/mine-pbp-tournament-aliases.py from the real 2012+2013
# ATP_MAIN corpus: every entry appeared >=2 times where the candidate's
# source-declared score AND winner independently agreed with a specific
# historical match, and the pairing was manually reviewed for real-world
# plausibility. Re-run that script and re-review before adding any new year's
# entries -- do not hand-add an entry without that evidence trail.
TOURNAMENT_ALIAS_TABLE: dict[str, str] = {
    "MensFrenchOpen": "Roland Garros",
    "SonyOpenTennis-ATPMiami": "Miami Masters",
    "ShanghaiRolexMasters-ATPShanghai": "Shanghai Masters",
    "BNPParibasOpen-ATPIndianWells": "Indian Wells Masters",
    "InternazionaliBNLd'Italia-ATPRome": "Rome Masters",
    "BNPParibasMasters-ATPParis": "Paris Masters",
    "SonyEricssonOpen-ATPMiami": "Miami Masters",
    "Western&amp;SouthernOpen-ATPCincinnati": "Cincinnati Masters",
    "MutuaMadridOpen-ATPMadrid": "Madrid Masters",
    "BNPParibasOpen-ATPIndianWells2012": "Indian Wells Masters",
    "Monte-CarloRolexMasters-ATPMonaco2012": "Monte Carlo Masters",
    "RogersCup-ATPMontreal": "Canada Masters",
    "RogersCup-ATPToronto": "Canada Masters",
    "QatarExxonMobilOpen-ATPQatarLive": "Doha",
    "PortugalOpen-ATPOeiras": "Estoril",
    "PowerHorseWorldTeamCup": "Dusseldorf",
    "Monte-CarloRolexMasters-ATPMonaco": "Monte Carlo Masters",
    "VTROpen-ATPVinaDelMar": "Santiago",
    "QatarExxonMobilOpen-ATPQatar20111": "Doha",
}


class TournamentIdentityTier(Enum):
    ALIAS_TABLE = "ALIAS_TABLE"       # tier 6 -- controlled, auditable, evidence-backed
    FUZZY_FALLBACK = "FUZZY_FALLBACK"  # tier 7 -- last resort, still gated by score+winner agreement
    UNRESOLVED = "UNRESOLVED"


def resolve_tournament_identity(ppaulojr_name: str, hist_name: str) -> TournamentIdentityTier:
    """Tries the alias table first (tier 6), falls back to the existing fuzzy
    substring match (tier 7, unchanged behavior from tny_ok), never guesses
    beyond that."""
    normalized = normalize_ppaulojr_tournament_name(ppaulojr_name)
    if TOURNAMENT_ALIAS_TABLE.get(normalized) == hist_name:
        return TournamentIdentityTier.ALIAS_TABLE
    if tny_ok(hist_name, ppaulojr_name):
        return TournamentIdentityTier.FUZZY_FALLBACK
    return TournamentIdentityTier.UNRESOLVED


class IdentityResolution(Enum):
    RESOLVED = "RESOLVED"
    AMBIGUOUS = "AMBIGUOUS"   # multiple plausible candidates -- NEVER auto-picked
    UNRESOLVED = "UNRESOLVED"


@dataclass
class IdentityResult:
    resolution: IdentityResolution
    matched: Optional[PBPRecord] = None          # only set when resolution == RESOLVED
    candidates: Optional[list[PBPRecord]] = None  # only set when resolution == AMBIGUOUS
    tier: Optional[TournamentIdentityTier] = None
    reason: str = ""


def resolve_match_identity(p: PBPRecord, hist_candidates: list[PBPRecord]) -> IdentityResult:
    """The full match-level resolver. Uses ONLY p.score/p.winner (ppaulojr's
    own CSV-declared fields) and hist's declared fields -- never
    reconstruct_pbp(p.pbp_tape)'s output. See module docstring for why.

    Prefers false negative over false positive: if more than one hist
    candidate independently qualifies (score+winner agree AND tournament
    identity resolves via either tier), returns AMBIGUOUS with every
    qualifying candidate listed rather than silently choosing one.
    """
    if not hist_candidates:
        return IdentityResult(IdentityResolution.UNRESOLVED, reason="NO_HISTORICAL_PLAYER_PAIR")

    qualifying: list[tuple[PBPRecord, TournamentIdentityTier]] = []
    for h in hist_candidates:
        if p.score and h.score and score_games(p.score) != score_games(h.score):
            continue
        if norm_name(p.winner) != norm_name(h.winner):
            continue
        tier = resolve_tournament_identity(p.tournament_name, h.tournament_name)
        if tier == TournamentIdentityTier.UNRESOLVED:
            continue
        qualifying.append((h, tier))

    if not qualifying:
        return IdentityResult(IdentityResolution.UNRESOLVED, reason="NO_QUALIFYING_CANDIDATE")
    if len(qualifying) > 1:
        return IdentityResult(
            IdentityResolution.AMBIGUOUS,
            candidates=[h for h, _ in qualifying],
            reason=f"{len(qualifying)} historical matches independently qualify for this player pair/score/winner -- refusing to guess",
        )
    matched, tier = qualifying[0]
    return IdentityResult(IdentityResolution.RESOLVED, matched=matched, tier=tier)
