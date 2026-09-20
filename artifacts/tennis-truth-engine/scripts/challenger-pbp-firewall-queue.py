#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
VERIFIED_ROOT = ROOT / "data" / "audit" / "verified-pbp" / "atp_challenger"
QUEUE_ROOT = ROOT / "data" / "audit" / "challenger-pbp-firewall-queue"
STATE_FILE = QUEUE_ROOT / "state.json"
SUMMARY_FILE = QUEUE_ROOT / "summary.md"
GLOBAL_INDEX_FILE = QUEUE_ROOT / "global-index.json"
VIOLATIONS_FILE = QUEUE_ROOT / "global-firewall-violations.json"
TOUR = "ATP_CHALLENGER"
HARD_EXCLUDED = set(range(2018, 2023))


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def current_year() -> int:
    return datetime.now(timezone.utc).year


def eligible_years(through_year: int) -> list[int]:
    return [y for y in range(2012, through_year + 1) if y not in HARD_EXCLUDED]


def default_state() -> dict[str, Any]:
    return {
        "schema_version": 1,
        "tour": TOUR,
        "scope": "ATP Challenger only",
        "created_at_utc": utcnow(),
        "updated_at_utc": utcnow(),
        "hard_exclusions": [2018, 2019, 2020, 2021, 2022],
        "batches": {},
    }


def load_state() -> dict[str, Any]:
    if not STATE_FILE.exists():
        return default_state()
    try:
        state = json.loads(STATE_FILE.read_text())
    except Exception:
        backup = STATE_FILE.with_name(
            f"state.corrupt.{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json"
        )
        backup.write_bytes(STATE_FILE.read_bytes())
        return default_state()
    state["tour"] = TOUR
    state["scope"] = "ATP Challenger only"
    state["hard_exclusions"] = [2018, 2019, 2020, 2021, 2022]
    state.setdefault("batches", {})
    # Safety firewall: this queue may never carry ATP Main or WTA Main state.
    state["batches"] = {
        k: v for k, v in state["batches"].items()
        if str(k).startswith("ATP_CHALLENGER:")
    }
    return state


def save_state(state: dict[str, Any]) -> None:
    QUEUE_ROOT.mkdir(parents=True, exist_ok=True)
    state["updated_at_utc"] = utcnow()
    tmp = STATE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=2, sort_keys=True) + "\n")
    tmp.replace(STATE_FILE)


def key(year: int) -> str:
    return f"{TOUR}:{year}"


def out_dir(year: int) -> Path:
    return VERIFIED_ROOT / str(year)


def read_summary(year: int) -> dict[str, Any] | None:
    path = out_dir(year) / "summary.json"
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text())
    except Exception:
        return None


def terminal(year: int) -> bool:
    s = read_summary(year)
    if not s:
        return False
    if str(s.get("tour")) != TOUR:
        return False
    if s.get("source_blocked") is True:
        return False
    if int(s.get("retrieval_failures", 0) or 0) > 0:
        return False
    return str(s.get("batch_status", "")).upper() in {"PROCESSED", "HARD_EXCLUDED"}


def status_update(year: int, summary: dict[str, Any] | None, state_entry: dict[str, Any]) -> str:
    s = summary or {}
    examined = int(s.get("historical_matches", 0) or 0)
    candidates = int(s.get("pbp_candidates", 0) or 0)
    verified = int(s.get("verified", 0) or 0)
    ambiguous = int(s.get("ambiguous", 0) or 0)
    conflicts = int(s.get("conflicts", 0) or 0)
    no_pbp = int(s.get("no_pbp", 0) or 0)
    retrieval = int(s.get("retrieval_failures", 0) or 0)
    blocked = s.get("source_blocked") is True
    lines = [
        f"* {examined:,} ATP Challenger historical matches examined for {year}.",
        f"* {candidates:,} PBP candidates were actually found.",
    ]
    if blocked:
        lines.append(f"* The batch is source-blocked: {s.get('block_reason', 'source unavailable')}.")
    elif retrieval:
        lines.append(f"* {retrieval:,} retrieval failures were reported by the verifier.")
    lines.extend([
        f"* {ambiguous:,} ambiguous attachments were quarantined.",
        f"* {conflicts:,} duplicate/conflicting/corrupt records were quarantined.",
        f"* {no_pbp:,} historical matches had no acceptable PBP attachment.",
        f"* Therefore the firewall allowed {verified:,} through to VERIFIED.",
        f"* Batch status: {state_entry.get('status', 'UNKNOWN')}.",
    ])
    return "\n".join(lines)


def run_batch(state: dict[str, Any], year: int) -> None:
    if year in HARD_EXCLUDED:
        raise RuntimeError(f"HARD_EXCLUDED_YEAR:{year}")
    e = state["batches"].setdefault(key(year), {})
    e.update({
        "tour": TOUR,
        "year": year,
        "status": "RUNNING",
        "attempts": int(e.get("attempts", 0) or 0) + 1,
        "last_started_at_utc": utcnow(),
    })
    save_state(state)
    print(f"CHALLENGER_BATCH_START year={year} attempt={e['attempts']}", flush=True)

    proc = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "verify-challenger-pbp.py"), "--year", str(year)],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    if proc.stdout:
        print(proc.stdout, end="" if proc.stdout.endswith("\n") else "\n", flush=True)
    if proc.stderr:
        print(proc.stderr, end="" if proc.stderr.endswith("\n") else "\n", file=sys.stderr, flush=True)

    s = read_summary(year)
    e["last_finished_at_utc"] = utcnow()
    e["last_exit_code"] = proc.returncode
    e["summary_path"] = str((out_dir(year) / "summary.json").relative_to(ROOT))

    if proc.returncode == 75 or (s and s.get("source_blocked") is True):
        e["status"] = "BLOCKED_RETRYABLE"
        e["last_error"] = (s or {}).get("block_reason") or "SOURCE_BLOCKED"
    elif proc.returncode != 0:
        e["status"] = "FAILED_RETRYABLE"
        e["last_error"] = f"verifier exit {proc.returncode}"
    elif not s:
        e["status"] = "FAILED_RETRYABLE"
        e["last_error"] = "missing summary.json"
    elif int(s.get("retrieval_failures", 0) or 0) > 0:
        e["status"] = "FAILED_RETRYABLE"
        e["last_error"] = f"retrieval_failures={s.get('retrieval_failures')}"
    else:
        e["status"] = "PROCESSED"
        e.pop("last_error", None)

    if s:
        for field in ("historical_matches", "pbp_candidates", "verified", "partial", "ambiguous", "conflicts", "no_pbp", "retrieval_failures"):
            e[field] = int(s.get(field, 0) or 0)
    save_state(state)
    print(status_update(year, s, e), flush=True)


def norm(v: Any) -> str:
    return "".join(ch.lower() for ch in str(v or "") if ch.isalnum())


def result_key(m: dict[str, Any]) -> str:
    h = m.get("historical") or {}
    ids = sorted([str(h.get("winner_id") or ""), str(h.get("loser_id") or "")])
    if not all(ids):
        ids = sorted([norm(h.get("winner")), norm(h.get("loser"))])
    material = "|".join([
        TOUR,
        str(m.get("year") or h.get("year") or ""),
        str(h.get("tourney_id") or h.get("tournament") or ""),
        str(h.get("tourney_date") or m.get("exact_match_date") or ""),
        str(h.get("round") or ""),
        ids[0] if ids else "",
        ids[1] if len(ids) > 1 else "",
        str(h.get("score") or ""),
    ])
    return hashlib.sha256(material.encode()).hexdigest()


def pbp_key(m: dict[str, Any]) -> str:
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


def global_firewall() -> dict[str, Any]:
    QUEUE_ROOT.mkdir(parents=True, exist_ok=True)
    mappings: list[dict[str, Any]] = []
    load_errors: list[dict[str, str]] = []
    for path in sorted(VERIFIED_ROOT.glob("*/verified-mappings.json")):
        try:
            rows = json.loads(path.read_text())
            if not isinstance(rows, list):
                raise ValueError("not a list")
        except Exception as exc:
            load_errors.append({"path": str(path.relative_to(ROOT)), "error": str(exc)})
            continue
        for row in rows:
            if isinstance(row, dict) and str(row.get("tour")) == TOUR:
                x = dict(row)
                x["_source_path"] = str(path.relative_to(ROOT))
                mappings.append(x)

    by_result: dict[str, list[dict[str, Any]]] = {}
    by_pbp: dict[str, list[dict[str, Any]]] = {}
    index: list[dict[str, Any]] = []
    for m in mappings:
        rk, pk = result_key(m), pbp_key(m)
        by_result.setdefault(rk, []).append(m)
        by_pbp.setdefault(pk, []).append(m)
        index.append({"result_key": rk, "pbp_key": pk, "year": m.get("year"), "source_path": m.get("_source_path")})

    violations: list[dict[str, Any]] = []
    for rk, rows in by_result.items():
        keys = sorted({pbp_key(r) for r in rows})
        if len(keys) > 1:
            violations.append({"type": "ONE_RESULT_TO_MULTIPLE_PBP", "result_key": rk, "pbp_keys": keys})
    for pk, rows in by_pbp.items():
        keys = sorted({result_key(r) for r in rows})
        if len(keys) > 1:
            violations.append({"type": "ONE_PBP_TO_MULTIPLE_RESULTS", "pbp_key": pk, "result_keys": keys})

    audit = {
        "tour": TOUR,
        "generated_at_utc": utcnow(),
        "mappings_indexed": len(index),
        "unique_result_keys": len(by_result),
        "unique_pbp_keys": len(by_pbp),
        "load_errors": load_errors,
        "violations": violations,
        "safe_to_integrate": not load_errors and not violations,
        "rule": "ATP Challenger only: 1 historical match <-> 1 unique PBP record",
    }
    GLOBAL_INDEX_FILE.write_text(json.dumps({"generated_at_utc": audit["generated_at_utc"], "rows": index}, indent=2) + "\n")
    VIOLATIONS_FILE.write_text(json.dumps(audit, indent=2) + "\n")
    return audit


def write_summary(state: dict[str, Any], through_year: int, audit: dict[str, Any]) -> None:
    years = eligible_years(through_year)
    lines = [
        "# ATP Challenger PBP Firewall Status",
        "",
        "**Scope: ATP Challenger ONLY. ATP Main and WTA Main are never queued or modified by this workflow.**",
        "",
        f"Requested years: 2012–2017 and 2023–{through_year}.",
        "Hard excluded: 2018–2022.",
        "",
    ]
    total_verified = 0
    processed = pending = blocked = failed = 0
    for year in years:
        e = state["batches"].get(key(year), {})
        s = read_summary(year)
        status = e.get("status", "PENDING")
        if terminal(year): processed += 1
        elif status == "BLOCKED_RETRYABLE": blocked += 1
        elif status == "FAILED_RETRYABLE": failed += 1
        else: pending += 1
        total_verified += int(e.get("verified", 0) or 0)
        lines.append(f"## {year}")
        lines.append(status_update(year, s, e))
        lines.append("")
    lines.extend([
        "## Overall",
        f"* {len(years)} eligible Challenger year batches.",
        f"* {processed} processed; {pending} pending; {blocked} blocked-retryable; {failed} failed-retryable.",
        f"* {total_verified:,} Challenger PBP mappings currently VERIFIED.",
        f"* Global 1-match↔1-PBP firewall safe: {'YES' if audit.get('safe_to_integrate') else 'NO'}.",
        f"* Global firewall violations quarantined: {len(audit.get('violations', []))}.",
    ])
    SUMMARY_FILE.write_text("\n".join(lines) + "\n")


def queue_complete(through_year: int) -> bool:
    return all(terminal(year) for year in eligible_years(through_year))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-batches", type=int, default=10)
    ap.add_argument("--through-year", type=int, default=current_year())
    ap.add_argument("--force-recheck", action="store_true")
    ap.add_argument("--audit-only", action="store_true")
    args = ap.parse_args()

    QUEUE_ROOT.mkdir(parents=True, exist_ok=True)
    VERIFIED_ROOT.mkdir(parents=True, exist_ok=True)
    state = load_state()

    if args.audit_only:
        audit = global_firewall()
        write_summary(state, args.through_year, audit)
        print(f"CHALLENGER_GLOBAL_FIREWALL_SAFE={str(bool(audit['safe_to_integrate'])).lower()}")
        print(f"CHALLENGER_GLOBAL_FIREWALL_VIOLATIONS={len(audit['violations'])}")
        return 0

    candidates = [
        year for year in eligible_years(args.through_year)
        if args.force_recheck or not terminal(year)
    ]
    ran = 0
    for year in candidates:
        if ran >= max(1, args.max_batches):
            break
        run_batch(state, year)
        ran += 1

    audit = global_firewall()
    write_summary(state, args.through_year, audit)
    complete = queue_complete(args.through_year)
    print(f"CHALLENGER_QUEUE_BATCHES_RUN={ran}")
    print(f"CHALLENGER_QUEUE_COMPLETE={str(complete).lower()}")
    print(f"CHALLENGER_GLOBAL_FIREWALL_SAFE={str(bool(audit['safe_to_integrate'])).lower()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
