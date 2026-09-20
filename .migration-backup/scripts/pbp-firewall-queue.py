#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
AUDIT_ROOT = ROOT / "data" / "audit"
VERIFIED_ROOT = AUDIT_ROOT / "verified-pbp"
QUEUE_ROOT = AUDIT_ROOT / "pbp-firewall-queue"
STATE_FILE = QUEUE_ROOT / "state.json"
GLOBAL_INDEX_FILE = QUEUE_ROOT / "global-index.json"
VIOLATIONS_FILE = QUEUE_ROOT / "global-firewall-violations.json"
SUMMARY_FILE = QUEUE_ROOT / "summary.md"

# Scope is intentionally explicit. Challenger 2018-2022 is a hard exclusion and
# can never be queued by this script without a code change and review.
TOUR_ORDER = ("ATP_MAIN", "WTA_MAIN", "ATP_CHALLENGER")
HARD_EXCLUDED = {
    "ATP_CHALLENGER": set(range(2018, 2023)),
}


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def current_year() -> int:
    return datetime.now(timezone.utc).year


def eligible_years(tour: str, through_year: int) -> list[int]:
    if through_year < 2012:
        return []
    years = list(range(2012, through_year + 1))
    excluded = HARD_EXCLUDED.get(tour, set())
    return [y for y in years if y not in excluded]


def default_state() -> dict[str, Any]:
    return {
        "schema_version": 1,
        "created_at_utc": utcnow(),
        "updated_at_utc": utcnow(),
        "hard_exclusions": {
            "ATP_CHALLENGER": [2018, 2019, 2020, 2021, 2022],
        },
        "batches": {},
    }


def load_state() -> dict[str, Any]:
    if not STATE_FILE.exists():
        return default_state()
    try:
        data = json.loads(STATE_FILE.read_text())
    except Exception:
        # Corrupt state must never erase evidence. Preserve it and start a clean
        # recoverable queue state while retaining all verifier outputs on disk.
        backup = STATE_FILE.with_name(f"state.corrupt.{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json")
        backup.write_bytes(STATE_FILE.read_bytes())
        return default_state()
    data.setdefault("batches", {})
    data.setdefault("hard_exclusions", {"ATP_CHALLENGER": [2018, 2019, 2020, 2021, 2022]})
    return data


def save_state(state: dict[str, Any]) -> None:
    QUEUE_ROOT.mkdir(parents=True, exist_ok=True)
    state["updated_at_utc"] = utcnow()
    tmp = STATE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=2, sort_keys=True) + "\n")
    tmp.replace(STATE_FILE)


def batch_key(tour: str, year: int) -> str:
    return f"{tour}:{year}"


def batch_output_dir(tour: str, year: int) -> Path:
    return VERIFIED_ROOT / tour.lower() / str(year)


def read_summary(tour: str, year: int) -> dict[str, Any] | None:
    p = batch_output_dir(tour, year) / "summary.json"
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text())
    except Exception:
        return None


def existing_batch_is_terminal(tour: str, year: int) -> bool:
    s = read_summary(tour, year)
    if not s:
        return False
    # Record-level unresolved/ambiguous/conflict states are terminal audit
    # outcomes and must not block the queue. Retrieval/source failures are not.
    if int(s.get("retrieval_failures", 0) or 0) > 0:
        return False
    if s.get("source_blocked") is True:
        return False
    if str(s.get("batch_status", "")).upper() in {"BLOCKED", "RETRIEVAL_FAILED"}:
        return False
    return True


def command_for(tour: str, year: int) -> list[str]:
    if tour in {"ATP_MAIN", "WTA_MAIN"}:
        return [sys.executable, str(ROOT / "scripts" / "verify-sackmann-pbp-v2.py"), "--tour", tour, "--year", str(year)]
    if tour == "ATP_CHALLENGER":
        return [sys.executable, str(ROOT / "scripts" / "verify-challenger-pbp.py"), "--year", str(year)]
    raise ValueError(f"Unsupported tour: {tour}")


def run_batch(state: dict[str, Any], tour: str, year: int) -> str:
    key = batch_key(tour, year)
    entry = state["batches"].setdefault(key, {})
    entry.update({
        "tour": tour,
        "year": year,
        "status": "RUNNING",
        "attempts": int(entry.get("attempts", 0) or 0) + 1,
        "last_started_at_utc": utcnow(),
    })
    save_state(state)

    cmd = command_for(tour, year)
    print(f"QUEUE_BATCH_START tour={tour} year={year} attempt={entry['attempts']}", flush=True)
    proc = subprocess.run(cmd, cwd=ROOT, text=True, capture_output=True)
    if proc.stdout:
        print(proc.stdout, end="" if proc.stdout.endswith("\n") else "\n", flush=True)
    if proc.stderr:
        print(proc.stderr, end="" if proc.stderr.endswith("\n") else "\n", file=sys.stderr, flush=True)

    summary = read_summary(tour, year)
    entry["last_finished_at_utc"] = utcnow()
    entry["last_exit_code"] = proc.returncode
    entry["summary_path"] = str((batch_output_dir(tour, year) / "summary.json").relative_to(ROOT))

    if proc.returncode == 75 or (summary and summary.get("source_blocked") is True):
        entry["status"] = "BLOCKED_RETRYABLE"
        entry["last_error"] = (summary or {}).get("block_reason") or "SOURCE_OR_VERIFIER_BLOCKED"
        save_state(state)
        print(f"QUEUE_BATCH_BLOCKED tour={tour} year={year}", flush=True)
        return "BLOCKED_RETRYABLE"

    if proc.returncode != 0:
        entry["status"] = "FAILED_RETRYABLE"
        entry["last_error"] = f"verifier exit {proc.returncode}"
        save_state(state)
        print(f"QUEUE_BATCH_FAILED tour={tour} year={year} exit={proc.returncode}", flush=True)
        return "FAILED_RETRYABLE"

    if not summary:
        entry["status"] = "FAILED_RETRYABLE"
        entry["last_error"] = "verifier returned success without summary.json"
        save_state(state)
        return "FAILED_RETRYABLE"

    if int(summary.get("retrieval_failures", 0) or 0) > 0:
        entry["status"] = "FAILED_RETRYABLE"
        entry["last_error"] = f"retrieval_failures={summary.get('retrieval_failures')}"
        save_state(state)
        return "FAILED_RETRYABLE"

    entry["status"] = "PROCESSED"
    entry["verified"] = int(summary.get("verified", 0) or 0)
    entry["ambiguous"] = int(summary.get("ambiguous", 0) or 0)
    entry["conflicts"] = int(summary.get("conflicts", 0) or 0)
    entry["no_pbp"] = int(summary.get("no_pbp", 0) or 0)
    entry["partial"] = int(summary.get("partial", 0) or 0)
    entry.pop("last_error", None)
    save_state(state)
    print(
        "QUEUE_BATCH_DONE "
        + json.dumps({
            "tour": tour,
            "year": year,
            "verified": entry["verified"],
            "ambiguous": entry["ambiguous"],
            "conflicts": entry["conflicts"],
            "no_pbp": entry["no_pbp"],
            "partial": entry["partial"],
        }, separators=(",", ":")),
        flush=True,
    )
    return "PROCESSED"


def norm(v: Any) -> str:
    return "".join(ch.lower() for ch in str(v or "") if ch.isalnum())


def mapping_result_key(m: dict[str, Any]) -> str:
    h = m.get("historical") or m.get("result") or {}
    ids = sorted([str(h.get("winner_id") or ""), str(h.get("loser_id") or "")])
    if not all(ids):
        ids = sorted([norm(h.get("winner")), norm(h.get("loser"))])
    material = "|".join([
        str(m.get("tour") or h.get("tour") or ""),
        str(m.get("year") or h.get("year") or ""),
        str(h.get("tourney_id") or h.get("tournament") or h.get("tourney_name") or ""),
        str(h.get("match_num") or ""),
        str(h.get("round") or ""),
        ids[0] if ids else "",
        ids[1] if len(ids) > 1 else "",
        str(h.get("score") or ""),
    ])
    return hashlib.sha256(material.encode()).hexdigest()


def mapping_pbp_key(m: dict[str, Any]) -> str:
    p = m.get("pbp_ref") or {}
    sha = str(p.get("pbp_sha256") or "").strip()
    if sha:
        return sha
    material = "|".join([
        str(p.get("source_file") or ""),
        str(p.get("source_row") or ""),
        str(p.get("date") or ""),
        norm(p.get("server1")),
        norm(p.get("server2")),
        str(p.get("score") or ""),
    ])
    return hashlib.sha256(material.encode()).hexdigest()


def global_firewall_audit() -> dict[str, Any]:
    QUEUE_ROOT.mkdir(parents=True, exist_ok=True)
    mappings: list[dict[str, Any]] = []
    for path in sorted(VERIFIED_ROOT.glob("*/*/verified-mappings.json")):
        try:
            rows = json.loads(path.read_text())
        except Exception as exc:
            mappings.append({"_load_error": str(exc), "_source_path": str(path.relative_to(ROOT))})
            continue
        if not isinstance(rows, list):
            mappings.append({"_load_error": "verified-mappings.json is not a list", "_source_path": str(path.relative_to(ROOT))})
            continue
        for row in rows:
            if isinstance(row, dict):
                x = dict(row)
                x["_source_path"] = str(path.relative_to(ROOT))
                mappings.append(x)

    by_result: dict[str, list[dict[str, Any]]] = {}
    by_pbp: dict[str, list[dict[str, Any]]] = {}
    load_errors = []
    index_rows = []
    for m in mappings:
        if "_load_error" in m:
            load_errors.append(m)
            continue
        rk = mapping_result_key(m)
        pk = mapping_pbp_key(m)
        by_result.setdefault(rk, []).append(m)
        by_pbp.setdefault(pk, []).append(m)
        index_rows.append({
            "result_key": rk,
            "pbp_key": pk,
            "tour": m.get("tour"),
            "year": m.get("year"),
            "source_path": m.get("_source_path"),
        })

    violations: list[dict[str, Any]] = []
    for rk, rows in by_result.items():
        pbps = sorted({mapping_pbp_key(x) for x in rows})
        if len(pbps) > 1:
            violations.append({"type": "ONE_RESULT_TO_MULTIPLE_PBP", "result_key": rk, "pbp_keys": pbps, "sources": sorted({x.get("_source_path") for x in rows})})
    for pk, rows in by_pbp.items():
        results = sorted({mapping_result_key(x) for x in rows})
        if len(results) > 1:
            violations.append({"type": "ONE_PBP_TO_MULTIPLE_RESULTS", "pbp_key": pk, "result_keys": results, "sources": sorted({x.get("_source_path") for x in rows})})

    audit = {
        "generated_at_utc": utcnow(),
        "mappings_indexed": len(index_rows),
        "unique_result_keys": len(by_result),
        "unique_pbp_keys": len(by_pbp),
        "load_errors": load_errors,
        "violations": violations,
        "safe_to_integrate": not violations and not load_errors,
        "rule": "1 historical result <-> 1 PBP record globally across every processed year/tour",
    }
    GLOBAL_INDEX_FILE.write_text(json.dumps({"generated_at_utc": audit["generated_at_utc"], "rows": index_rows}, indent=2) + "\n")
    VIOLATIONS_FILE.write_text(json.dumps(audit, indent=2) + "\n")
    return audit


def write_summary(state: dict[str, Any], through_year: int, audit: dict[str, Any]) -> None:
    total = 0
    processed = blocked = failed = pending = 0
    verified = ambiguous = conflicts = no_pbp = partial = 0
    for tour in TOUR_ORDER:
        for year in eligible_years(tour, through_year):
            total += 1
            e = state["batches"].get(batch_key(tour, year), {})
            status = e.get("status")
            if existing_batch_is_terminal(tour, year) or status == "PROCESSED":
                processed += 1
            elif status == "BLOCKED_RETRYABLE":
                blocked += 1
            elif status == "FAILED_RETRYABLE":
                failed += 1
            else:
                pending += 1
            verified += int(e.get("verified", 0) or 0)
            ambiguous += int(e.get("ambiguous", 0) or 0)
            conflicts += int(e.get("conflicts", 0) or 0)
            no_pbp += int(e.get("no_pbp", 0) or 0)
            partial += int(e.get("partial", 0) or 0)

    lines = [
        f"- Through year: **{through_year}**",
        f"- Eligible tour/year batches: **{total}**",
        f"- Processed batches: **{processed}**",
        f"- Pending batches: **{pending}**",
        f"- Retryable blocked batches: **{blocked}**",
        f"- Retryable failed batches: **{failed}**",
        f"- Verified PBP mappings: **{verified}**",
        f"- Ambiguous left unresolved: **{ambiguous}**",
        f"- Conflicts quarantined/not promoted: **{conflicts}**",
        f"- No-PBP records retained as unresolved: **{no_pbp}**",
        f"- Partial/review-required records: **{partial}**",
        f"- Global one-result/one-PBP firewall safe: **{'YES' if audit.get('safe_to_integrate') else 'NO'}**",
        f"- Global firewall violations: **{len(audit.get('violations', []))}**",
        "- Challenger hard exclusion: **2018–2022**",
    ]
    SUMMARY_FILE.write_text("\n".join(lines) + "\n")


def queue_complete(state: dict[str, Any], through_year: int) -> bool:
    for tour in TOUR_ORDER:
        for year in eligible_years(tour, through_year):
            if not existing_batch_is_terminal(tour, year):
                return False
    return True


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-batches", type=int, default=4)
    ap.add_argument("--through-year", type=int, default=current_year())
    ap.add_argument("--force-recheck", action="store_true")
    ap.add_argument("--audit-only", action="store_true")
    args = ap.parse_args()

    QUEUE_ROOT.mkdir(parents=True, exist_ok=True)
    VERIFIED_ROOT.mkdir(parents=True, exist_ok=True)
    state = load_state()

    if args.audit_only:
        audit = global_firewall_audit()
        write_summary(state, args.through_year, audit)
        print(f"GLOBAL_FIREWALL_SAFE={str(bool(audit['safe_to_integrate'])).lower()}")
        print(f"GLOBAL_FIREWALL_VIOLATIONS={len(audit['violations'])}")
        return 0

    candidates: list[tuple[int, int, str]] = []
    # Year-first ordering prevents any tour from starving. Within each year,
    # ATP Main, WTA Main, then Challenger are processed deterministically.
    for year in range(2012, args.through_year + 1):
        for order, tour in enumerate(TOUR_ORDER):
            if year not in eligible_years(tour, args.through_year):
                continue
            if args.force_recheck or not existing_batch_is_terminal(tour, year):
                candidates.append((year, order, tour))

    ran = 0
    for year, _, tour in candidates:
        if ran >= max(1, args.max_batches):
            break
        run_batch(state, tour, year)
        ran += 1

    audit = global_firewall_audit()
    write_summary(state, args.through_year, audit)
    complete = queue_complete(state, args.through_year)
    print(f"QUEUE_BATCHES_RUN={ran}")
    print(f"QUEUE_COMPLETE={str(complete).lower()}")
    print(f"GLOBAL_FIREWALL_SAFE={str(bool(audit['safe_to_integrate'])).lower()}")
    if audit["violations"]:
        print("GLOBAL_FIREWALL_NOTE=violations_are_quarantined_in_audit_outputs_and_must_not_be_integrated")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
