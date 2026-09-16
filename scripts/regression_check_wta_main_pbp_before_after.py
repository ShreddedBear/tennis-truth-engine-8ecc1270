#!/usr/bin/env python3
"""Before/after regression check for the matching-defect fixes in verify-sackmann-wta-main-pbp.py.

Proves two things by actually EXECUTING the real, unmodified run() function (never a
reimplementation of its logic), with disk writes mocked out so this makes zero production
writes:

1. With the new matching layer (lastname_initial_key/td_name_key/tny_ok/
   dates_within_tolerance) monkeypatched back to their pre-fix forms, run() reproduces the
   exact on-disk committed totals for 2012-2015 (verified=4018, review_required=1865) --
   i.e. the "old" result is genuinely reproducible from the current codebase, not just
   asserted from memory.
2. The real, current (fixed) run() produces the already-audited improved result
   (verified=4616, review_required=1253).

Requires network access (fetches the historical + PBP archives from
raw.githubusercontent.com) -- not part of the fast local unittest suite
(test_verify_sackmann_wta_main_pbp.py) for that reason. Run on demand:

    python3 scripts/regression_check_wta_main_pbp_before_after.py

Exits non-zero if either invariant fails.
"""
import importlib.util
import json
import re
import sys
import unicodedata
from pathlib import Path
from unittest import mock

spec = importlib.util.spec_from_file_location("verifymod", Path(__file__).parent / "verify-sackmann-wta-main-pbp.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

YEARS = [2012, 2013, 2014, 2015]
EXPECTED_OLD = {"verified": 4018, "review_required": 1865}
EXPECTED_NEW = {"verified": 4616, "review_required": 1253}


def old_lastname_initial_key(full_name):
    """Pre-fix: last WHITESPACE TOKEN only, breaking compound surnames."""
    parts = [p for p in re.split(r"\s+", unicodedata.normalize("NFKD", str(full_name or "")).encode("ascii", "ignore").decode().strip()) if p]
    if not parts:
        return None
    last = re.sub(r"[^a-z]", "", parts[-1].lower())
    first = re.sub(r"[^a-z]", "", parts[0].lower())
    if not last or not first:
        return None
    return (last, first[0])


def old_td_name_key(td_name):
    """Pre-fix: regex stops the surname capture at the first space."""
    mm = re.match(r"^\s*([A-Za-z'\-]+)\s+([A-Za-z])", str(td_name or ""))
    if not mm:
        return None
    return (re.sub(r"[^a-z]", "", mm.group(1).lower()), mm.group(2).lower())


def old_td_pairkey(w, l):
    a, b = old_td_name_key(w), old_td_name_key(l)
    if not a or not b:
        return None
    return tuple(sorted((a, b)))


def old_norm_tny(v):
    s = unicodedata.normalize("NFKD", str(v or "")).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\b(atp|wta)\b", "", s)
    s = re.sub(r"20\d{2}", "", s)
    return re.sub(r"[^a-z0-9]+", "", s)


def old_tny_ok(a, b):
    """Pre-fix: plain substring check, no tournament-sponsor-name alias table."""
    x, y = old_norm_tny(a), old_norm_tny(b)
    return bool(x and y and (x in y or y in x))


def old_dates_within_tolerance(a, b, max_days):
    """Pre-fix: exact equality only, no tolerance window."""
    return a == b


def fake_write_text(self, content, *a, **kw):
    return len(content)


def fake_mkdir(self, *a, **kw):
    pass


def run_all_years():
    totals = {"verified": 0, "review_required": 0}
    with mock.patch.object(Path, "write_text", fake_write_text), mock.patch.object(Path, "mkdir", fake_mkdir):
        for year in YEARS:
            s = m.run(year)
            totals["verified"] += s["verified"]
            totals["review_required"] += s["review_required"]
    return totals


def main():
    ok = True

    old_disk_totals = {"verified": 0, "review_required": 0}
    for year in YEARS:
        s = json.load(open(f"data/audit/verified-pbp-v4/wta_main/{year}/summary.json"))
        old_disk_totals["verified"] += s["verified"]
        old_disk_totals["review_required"] += s["review_required"]
    print("OLD on-disk committed totals (2012-2015):", old_disk_totals)
    if old_disk_totals != EXPECTED_OLD:
        print(f"  UNEXPECTED: on-disk totals no longer match {EXPECTED_OLD} -- has the committed audit trail changed?")
        ok = False

    real_fns = (m.lastname_initial_key, m.td_name_key, m.td_pairkey, m.tny_ok, m.dates_within_tolerance)
    m.lastname_initial_key, m.td_name_key, m.td_pairkey = old_lastname_initial_key, old_td_name_key, old_td_pairkey
    m.tny_ok, m.dates_within_tolerance = old_tny_ok, old_dates_within_tolerance
    try:
        old_repro_totals = run_all_years()
    finally:
        m.lastname_initial_key, m.td_name_key, m.td_pairkey, m.tny_ok, m.dates_within_tolerance = real_fns

    print("REPRODUCED old behavior (new matching layer disabled):", old_repro_totals)
    if old_repro_totals != old_disk_totals:
        print(f"  FAIL: does not reproduce the on-disk committed totals {old_disk_totals}")
        ok = False
    else:
        print("  PASS: exactly reproduces the on-disk committed totals")

    new_totals = run_all_years()
    print("NEW (current, fixed) behavior:", new_totals)
    if new_totals != EXPECTED_NEW:
        print(f"  FAIL: does not match the previously-audited result {EXPECTED_NEW}")
        ok = False
    else:
        print("  PASS: matches the previously-audited improved result")

    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
