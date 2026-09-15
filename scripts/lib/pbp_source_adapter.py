"""
Canonical PBP source adapter layer (ATP/WTA main tour).

Every source normalizes into PBPRecord via a PBPSourceAdapter. Adapters are
read-only / side-effect-free: they fetch and normalize, nothing more. They
never write to data/audit or any persistence layer -- callers (the overlap
experiment, and eventually a staged verification pipeline) decide what to do
with normalized records.

This module does NOT replace scripts/verify-sackmann-pbp-v4.py, which remains
the production LEVEL_1 verifier (identity + structural + uniqueness +
reverse-verification + duplicate firewall, gated on independent corroboration
from tennis-data.co.uk). This module exists for:
  - source inventory / capability introspection (what can each source supply?)
  - the multi-source overlap experiment (scripts/atp-pbp-source-overlap.py)
  - a future staged pipeline, if/when more than one PBP source needs the same
    RAW_SOURCE -> ... -> LEVEL_1_VERIFIED staging applied uniformly.

Fetch logic here deliberately mirrors (does not import) verify-sackmann-pbp-v4.py's
load_hist_year/load_pbp to avoid coupling this inventory-layer module to the
production verifier's internals; both should be kept in sync by hand if the
underlying CSV schemas change.
"""
from __future__ import annotations
import csv
import hashlib
import io
import re
import unicodedata
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional


class SourceRole(Enum):
    PBP_SOURCE = "pbp_source"      # supplies the raw point-by-point tape
    CORROBORATOR = "corroborator"  # independently confirms identity/result/score
    BOTH = "both"


class VerificationStage(Enum):
    RAW_SOURCE = "RAW_SOURCE"
    NORMALIZED = "NORMALIZED"
    STRUCTURALLY_VALIDATED = "STRUCTURALLY_VALIDATED"
    INDEPENDENTLY_CORROBORATED = "INDEPENDENTLY_CORROBORATED"
    LEVEL_1_VERIFIED = "LEVEL_1_VERIFIED"


class LicenseStatus(Enum):
    APPROVED_COMMERCIAL = "APPROVED_COMMERCIAL"
    NONCOMMERCIAL_ONLY = "NONCOMMERCIAL_ONLY"
    LICENSE_UNCERTAIN = "LICENSE_UNCERTAIN"
    NOT_LICENSED_FOR_USE = "NOT_LICENSED_FOR_USE"


@dataclass
class PBPRecord:
    source: str
    source_version: int
    match_id: Optional[str]
    tournament_id: Optional[str]
    tournament_name: str
    year: int
    tour: str
    level: Optional[str]
    surface: Optional[str]
    round: Optional[str]
    date: Optional[str]
    player_1: str
    player_2: str
    winner: Optional[str]
    score: Optional[str]
    pbp_tape: Optional[str]
    provenance: dict = field(default_factory=dict)
    stage: VerificationStage = VerificationStage.RAW_SOURCE


def norm_name(v: object) -> str:
    return re.sub(r"[^a-z0-9]+", "", unicodedata.normalize("NFKD", str(v or "")).encode("ascii", "ignore").decode().lower())


def norm_tny(v: object) -> str:
    s = unicodedata.normalize("NFKD", str(v or "")).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\b(atp|wta)\b", "", s)
    s = re.sub(r"20\d{2}", "", s)
    return re.sub(r"[^a-z0-9]+", "", s)


def tny_ok(a: object, b: object) -> bool:
    x, y = norm_tny(a), norm_tny(b)
    return bool(x and y and (x in y or y in x))


def pairkey(a: object, b: object) -> tuple[str, str]:
    return tuple(sorted((norm_name(a), norm_name(b))))


def parse_date(v: object) -> str:
    s = str(v or "").strip()
    for f in ("%d %b %y", "%Y-%m-%d", "%Y%m%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(s, f).date().isoformat()
        except ValueError:
            pass
    return ""


def clean_score(v: object) -> str:
    return re.sub(r"\s+", " ", str(v or "").upper().replace("RET", "").replace("DEF", "").replace("W/O", "").strip())


def score_games(v: object) -> list[tuple[int, int]]:
    out = []
    for tok in clean_score(v).split():
        m = re.match(r"^(\d+)-(\d+)", tok)
        if m:
            out.append((int(m.group(1)), int(m.group(2))))
    return out


def game_winner(seq: str, server: int, tb: bool = False) -> Optional[int]:
    cur = server
    p = [0, 0]
    ended = False
    for ch in seq:
        if ch == "/":
            if not tb:
                return None
            cur = 1 - cur
            continue
        if ch not in "SRAD":
            return None
        w = cur if ch in "SA" else 1 - cur
        p[w] += 1
        terminal = (max(p) >= 7 and abs(p[0] - p[1]) >= 2) if tb else (max(p) >= 4 and abs(p[0] - p[1]) >= 2)
        if ended:
            return None
        if terminal:
            ended = True
    if not ended:
        return None
    return 0 if p[0] > p[1] else 1


def reconstruct_pbp(pbp: str) -> dict:
    """Structural validation: replays the raw point-sequence string against real
    tennis scoring rules. Independent of any other source -- this alone answers
    'is this tape internally coherent', not 'does it match the historical record'."""
    if not pbp:
        return {"valid": False, "reason": "EMPTY_PBP"}
    server = 0
    sets: list[tuple[int, int]] = []
    points = 0
    for blob in pbp.strip().split("."):
        if not blob:
            return {"valid": False, "reason": "EMPTY_SET"}
        wins = [0, 0]
        for game in [x for x in blob.split(";") if x]:
            w = game_winner(game, server, "/" in game)
            if w is None:
                return {"valid": False, "reason": "ILLEGAL_GAME"}
            wins[w] += 1
            points += sum(c in "SRAD" for c in game)
            server = 1 - server
        a, b = wins
        if not ((max(a, b) >= 6 and abs(a - b) >= 2) or (a, b) in ((7, 6), (6, 7))):
            return {"valid": False, "reason": "ILLEGAL_SET", "sets": sets + [wins]}
        sets.append(wins)
    sw = [sum(a > b for a, b in sets), sum(b > a for a, b in sets)]
    if sw[0] == sw[1]:
        return {"valid": False, "reason": "NO_MATCH_WINNER", "sets": sets}
    return {"valid": True, "sets": sets, "winner": 0 if sw[0] > sw[1] else 1, "points": points, "games": sum(sum(s) for s in sets)}


def _fetch_text(url: str, timeout: int = 90, headers: Optional[dict] = None) -> str:
    hdrs = {"User-Agent": "tennis-truth-engine-pbp-source-adapter/1.0", "Accept": "*/*"}
    if headers:
        hdrs.update(headers)
    req = urllib.request.Request(url, headers=hdrs)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8-sig", "replace")


class PBPSourceAdapter:
    """Contract every source module must implement."""
    source_name: str
    source_version: int
    role: SourceRole
    license_status: LicenseStatus

    def fetch_year(self, tour: str, year: int) -> list[PBPRecord]:
        raise NotImplementedError


MAIN_LEVELS = {"G", "M", "A", "F"}


class AneeshersSackmannHistAdapter(PBPSourceAdapter):
    """Match-identity source (NOT a PBP source): tournament/date/round/surface/
    winner/score, mirrored from Jeff Sackmann's tennis_atp/tennis_wta archive.
    License: CC BY-NC-SA 4.0 (non-commercial) -- see docs/ATP_DATA_ATTRIBUTION.md."""
    source_name = "Aneeshers/tennis-sackmann-archive"
    source_version = 1
    role = SourceRole.CORROBORATOR
    license_status = LicenseStatus.NONCOMMERCIAL_ONLY
    BASE = "https://raw.githubusercontent.com/Aneeshers/tennis-sackmann-archive/main"

    def fetch_year(self, tour: str, year: int) -> list[PBPRecord]:
        p = "atp" if tour == "ATP_MAIN" else "wta"
        text = _fetch_text(f"{self.BASE}/{p}/{p}_matches_{year}.csv")
        out = []
        for r in csv.DictReader(io.StringIO(text)):
            level = (r.get("tourney_level") or "").upper()
            if level not in MAIN_LEVELS:
                continue
            out.append(PBPRecord(
                source=self.source_name, source_version=self.source_version,
                match_id=f"{r.get('tourney_id','')}-{r.get('match_num','')}",
                tournament_id=r.get("tourney_id"), tournament_name=r.get("tourney_name", ""),
                year=year, tour=tour, level=level, surface=r.get("surface"),
                round=r.get("round"), date=parse_date(r.get("tourney_date")),
                player_1=r.get("winner_name", ""), player_2=r.get("loser_name", ""),
                winner=r.get("winner_name", ""), score=clean_score(r.get("score", "")),
                pbp_tape=None,
                provenance={"winner_id": r.get("winner_id"), "loser_id": r.get("loser_id"), "match_num": r.get("match_num")},
                stage=VerificationStage.RAW_SOURCE,
            ))
        return out


class PpaulojrPbpAdapter(PBPSourceAdapter):
    """The only currently-integrated raw PBP tape source.
    License: no LICENSE file, no license statement in README -- LICENSE_UNCERTAIN.
    See docs/PBP_SOURCE_LICENSE_AUDIT.md for the full audit."""
    source_name = "ppaulojr/tennis_pointbypoint"
    source_version = 1
    role = SourceRole.PBP_SOURCE
    license_status = LicenseStatus.LICENSE_UNCERTAIN
    BASE = "https://raw.githubusercontent.com/ppaulojr/tennis_pointbypoint/master"
    FILES = {
        "ATP_MAIN": ["pbp_matches_atp_main_archive.csv", "pbp_matches_atp_main_current.csv"],
        "WTA_MAIN": ["pbp_matches_wta_main_archive.csv", "pbp_matches_wta_main_current.csv"],
    }

    def fetch_year(self, tour: str, year: int) -> list[PBPRecord]:
        expected = "ATP" if tour == "ATP_MAIN" else "WTA"
        out = []
        for fn in self.FILES[tour]:
            text = _fetch_text(f"{self.BASE}/{fn}")
            for idx, r in enumerate(csv.DictReader(io.StringIO(text))):
                d = parse_date(r.get("date"))
                if not d or int(d[:4]) != year:
                    continue
                if (r.get("tour") or "").upper() != expected or (r.get("draw") or "").lower() != "main":
                    continue
                raw = r.get("pbp", "") or ""
                out.append(PBPRecord(
                    source=self.source_name, source_version=self.source_version,
                    match_id=None, tournament_id=None, tournament_name=r.get("tny_name", ""),
                    year=year, tour=tour, level=None, surface=None, round=None, date=d,
                    player_1=r.get("server1", ""), player_2=r.get("server2", ""),
                    winner=(r.get("server1") if str(r.get("winner")) == "1" else r.get("server2") if str(r.get("winner")) == "2" else None),
                    score=clean_score(r.get("score", "")), pbp_tape=raw,
                    provenance={"source_file": fn, "source_row": idx + 2, "pbp_sha256": hashlib.sha256(raw.encode()).hexdigest()},
                    stage=VerificationStage.RAW_SOURCE,
                ))
        return out


class TennisDataCoUkAdapter(PBPSourceAdapter):
    """Independent corroborator only -- never a PBP source. Currently unreachable
    (see data/audit/verified-pbp-v4/atp_main/*/summary.json for the outage record)."""
    source_name = "tennis-data.co.uk"
    source_version = 1
    role = SourceRole.CORROBORATOR
    license_status = LicenseStatus.LICENSE_UNCERTAIN

    def fetch_year(self, tour: str, year: int) -> list[PBPRecord]:
        raise NotImplementedError("Use scripts/verify-sackmann-pbp-v4.py's read_td -- has the 503/backoff/HTTP-fallback fix")


class MatchChartingProjectAdapter(PBPSourceAdapter):
    """NOT integrated. Documented in src/lib/yellow-metric-sources.ts as
    access=NONCOMMERCIAL_ONLY; excluded from the commercial production path per
    existing policy. Coverage is charted matches only (mostly Slams, mostly top
    players) -- would never cover the full ATP main tour even if licensed."""
    source_name = "JeffSackmann/tennis_MatchChartingProject"
    source_version = 0
    role = SourceRole.PBP_SOURCE
    license_status = LicenseStatus.NONCOMMERCIAL_ONLY

    def fetch_year(self, tour: str, year: int) -> list[PBPRecord]:
        raise NotImplementedError("Not integrated: NONCOMMERCIAL_ONLY, excluded from production path")
