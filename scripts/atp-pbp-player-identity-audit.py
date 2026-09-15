#!/usr/bin/env python3
"""
Categorizes root causes for ppaulojr candidates with NO historical player-pair
match at all (Task: PBP match-identity reconciliation, Phase 3). Read-only,
does not modify or feed into match_identity_resolver.py -- this resolver was
built for tournament identity only; player-identity resolution is a distinct,
larger problem (would need real canonical_players/player_aliases data, which
lives in tennis-stats-engine's Postgres DB and is not queryable from this
environment -- no DATABASE_URL available). This script does the best possible
categorization from the two static CSV corpora already fetched, using exact
string heuristics only (no fuzzy "guessing" that could misclassify).

Categories (per task spec):
  A. player actually absent from that year's hist file at all (checked by name)
  B. spelling/diacritic difference (normalized forms match after accent-stripping,
     but raw strings differ, and NEITHER individual player is simply missing)
  C. initials vs full name (e.g. "R. Federer" vs "Roger Federer")
  D. married/name-change issue -- NOT DETECTABLE from this data (would need a
     real player-identity table with historical aliases; flagged, not counted)
  E. duplicate canonical player -- NOT DETECTABLE from this data (same reason)
  F. provider ID mismatch -- N/A, neither source in this pair carries IDs
  G. incorrect source record (e.g. a Challenger/qualifying match mislabeled as
     "main" in ppaulojr's own draw column, or a genuinely non-ATP-main event)
  H. other / undetermined
"""
from __future__ import annotations
import argparse
import json
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

from lib.pbp_source_adapter import AneeshersSackmannHistAdapter, PpaulojrPbpAdapter, pairkey, norm_name

ROOT = Path("data/audit/pbp-player-identity-audit")


def strip_accents(s: str) -> str:
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()


def initials_form(name: str) -> str:
    """'Roger Federer' -> 'r federer' (first-initial + surname), for the C check."""
    parts = name.strip().split()
    if len(parts) < 2:
        return norm_name(name)
    return norm_name(f"{parts[0][0]} {parts[-1]}")


def run_year(tour: str, year: int) -> dict:
    hist = AneeshersSackmannHistAdapter().fetch_year(tour, year)
    pbp = PpaulojrPbpAdapter().fetch_year(tour, year)

    by_pair = defaultdict(list)
    for h in hist:
        by_pair[pairkey(h.player_1, h.player_2)].append(h)

    all_hist_names_exact: set[str] = set()
    all_hist_names_normalized: dict[str, str] = {}   # normalized -> original (first seen)
    all_hist_initials: dict[str, list[str]] = defaultdict(list)  # initials-form -> [original names]
    for h in hist:
        for name in (h.player_1, h.player_2):
            all_hist_names_exact.add(name)
            all_hist_names_normalized[norm_name(name)] = name
            all_hist_initials[initials_form(name)].append(name)

    categories: Counter = Counter()
    examples: dict[str, list] = defaultdict(list)

    for p in pbp:
        pk = pairkey(p.player_1, p.player_2)
        if by_pair.get(pk):
            continue  # has a historical pair -- not in scope for this audit

        names_absent = []
        names_present_but_pair_never_played = []
        reason = None

        for name in (p.player_1, p.player_2):
            norm = norm_name(name)
            if norm in all_hist_names_normalized:
                exact_original = all_hist_names_normalized[norm]
                if exact_original == name:
                    names_present_but_pair_never_played.append(name)
                else:
                    # Same normalized form, different raw string -- diacritic/spacing/punctuation diff.
                    names_present_but_pair_never_played.append(name)
            elif initials_form(name) in all_hist_initials and len(all_hist_initials[initials_form(name)]) >= 1:
                pass  # handled by reason logic below
            else:
                names_absent.append(name)

        if len(names_absent) == 2:
            reason = "A_both_players_absent_from_hist_this_year"
        elif len(names_absent) == 1:
            missing = names_absent[0]
            if initials_form(missing) in all_hist_initials:
                reason = "C_initials_vs_full_name"
            elif strip_accents(norm_name(missing)) in {strip_accents(n) for n in all_hist_names_normalized}:
                reason = "B_spelling_or_diacritic_difference"
            else:
                reason = "A_one_player_absent_from_hist_this_year"
        else:
            # Both names individually exist in hist (possibly under exact or
            # accent-normalized form), but this exact PAIR never played each
            # other per the hist file that year -- most likely G: the ppaulojr
            # record is not actually an ATP-main-tour match this year (e.g.
            # exhibition, team event, or a draw/tour mislabel), since both
            # players are real, known tour players.
            reason = "G_players_exist_individually_but_pair_never_met_per_hist"

        categories[reason] += 1
        if len(examples[reason]) < 10:
            examples[reason].append({"player_1": p.player_1, "player_2": p.player_2, "ppaulojr_tournament": p.tournament_name, "date": p.date})

    return {
        "tour": tour, "year": year,
        "no_historical_player_pair_total": sum(categories.values()),
        "category_counts": dict(categories),
        "category_examples_sample": dict(examples),
        "not_detectable_from_available_data": [
            "D_married_name_change -- needs a real canonical player-alias history table (stats-engine's canonical_players/player_aliases, not queryable here -- no DATABASE_URL)",
            "E_duplicate_canonical_player -- same reason",
            "F_provider_id_mismatch -- N/A, neither Aneeshers-hist nor ppaulojr rows carry a shared provider ID",
        ],
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tour", default="ATP_MAIN")
    ap.add_argument("--year", type=int, nargs="+", required=True)
    args = ap.parse_args()

    ROOT.mkdir(parents=True, exist_ok=True)
    for year in args.year:
        result = run_year(args.tour, year)
        out = ROOT / f"{args.tour.lower()}_{year}.json"
        out.write_text(json.dumps(result, indent=2) + "\n")
        print(f"=== {args.tour} {year}: {result['no_historical_player_pair_total']} total ===")
        for k, v in sorted(result["category_counts"].items(), key=lambda x: -x[1]):
            print(f"  {k}: {v}")
        print()


if __name__ == "__main__":
    main()
