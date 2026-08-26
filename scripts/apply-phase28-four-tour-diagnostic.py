#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIAG = ROOT / "src/lib/evidence-coverage-runtime-diagnostic.server.ts"
SAMPLER = ROOT / "src/lib/evidence-index-match-sampler.server.ts"
PROOF = ROOT / ".github/workflows/evidence-coverage-production-proof.yml"
WTA125 = ROOT / "data/public/production-history/wta_challenger/matches_2021_2026.csv"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count == 0:
        if new in text:
            return text
        raise SystemExit(f"Phase 28 patch target missing: {label}")
    if count != 1:
        raise SystemExit(f"Phase 28 patch target not unique ({count}): {label}")
    return text.replace(old, new, 1)


def q(value: str | None) -> str:
    return json.dumps(str(value or "").strip(), ensure_ascii=False)


def latest_wta125_sample() -> dict[str, str]:
    if not WTA125.exists() or WTA125.stat().st_size == 0:
        raise SystemExit(f"validated WTA 125 production history missing: {WTA125}")
    candidates: list[dict[str, str]] = []
    with WTA125.open(newline="", encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            if row.get("tour_family") != "WTA_CHALLENGER":
                continue
            if row.get("competition_level") != "WTA_125":
                continue
            if row.get("production_scope") != "WTA_125_ONLY":
                continue
            if row.get("contamination_firewall") != "PASS":
                continue
            if row.get("historical_source_status") != "VALIDATED_SOURCE":
                continue
            p1 = (row.get("home_player") or "").strip()
            p2 = (row.get("away_player") or "").strip()
            date = (row.get("date") or "").strip()[:10]
            if not p1 or not p2 or p1.casefold() == p2.casefold() or len(date) != 10:
                continue
            candidates.append(row)
    if not candidates:
        raise SystemExit("no firewall-valid WTA 125 representative row found")
    candidates.sort(key=lambda r: ((r.get("date") or "")[:10], r.get("match_key") or ""), reverse=True)
    row = candidates[0]
    return {
        "match_key": (row.get("match_key") or "").strip(),
        "p1": (row.get("home_player") or "").strip(),
        "p2": (row.get("away_player") or "").strip(),
        "date": (row.get("date") or "").strip()[:10],
        "tournament": (row.get("tournament") or "WTA 125").strip(),
        "surface": (row.get("surface") or "").strip().lower(),
    }


def patch_sampler(sample: dict[str, str]) -> None:
    text = SAMPLER.read_text()
    text = replace_once(
        text,
        '  id: "ATP_MAIN" | "WTA_MAIN" | "ATP_CHALLENGER";\n',
        '  id: "ATP_MAIN" | "WTA_MAIN" | "ATP_CHALLENGER" | "WTA_CHALLENGER";\n',
        "sampler id union",
    )
    text = replace_once(
        text,
        '  surface: string | null;\n};\n\ntype IndexRow',
        '  surface: string | null;\n  sampling_source: "verified_pbp_index" | "wta125_production_history";\n};\n\ntype IndexRow',
        "sampler source field",
    )
    text = replace_once(
        text,
        'const SPECS: Record<EvidenceIndexSample["id"], { dir: string; years: number[]; floor: string }> = {',
        'const SPECS: Partial<Record<EvidenceIndexSample["id"], { dir: string; years: number[]; floor: string }>> = {',
        "partial specs",
    )
    text = replace_once(
        text,
        '  ATP_MAIN: { id: "ATP_MAIN", match_id: "verified-index:ATP_MAIN:43148", p1: "Alejandro Tabilo", p2: "Tiago Torres", date: "2026-07-22", tournament: "Estoril", surface: "clay" },\n',
        '  ATP_MAIN: { id: "ATP_MAIN", match_id: "verified-index:ATP_MAIN:43148", p1: "Alejandro Tabilo", p2: "Tiago Torres", date: "2026-07-22", tournament: "Estoril", surface: "clay", sampling_source: "verified_pbp_index" },\n',
        "ATP main source tag",
    )
    text = replace_once(
        text,
        '  WTA_MAIN: { id: "WTA_MAIN", match_id: "verified-index:WTA_MAIN:43309", p1: "Fiona Ferro", p2: "Erika Andreeva", date: "2026-07-22", tournament: "Palermo, Italy", surface: "clay" },\n',
        '  WTA_MAIN: { id: "WTA_MAIN", match_id: "verified-index:WTA_MAIN:43309", p1: "Fiona Ferro", p2: "Erika Andreeva", date: "2026-07-22", tournament: "Palermo, Italy", surface: "clay", sampling_source: "verified_pbp_index" },\n',
        "WTA main source tag",
    )
    old_atp_ch = '  ATP_CHALLENGER: { id: "ATP_CHALLENGER", match_id: "verified-index:ATP_CHALLENGER:31912", p1: "Leandro Riedi", p2: "Yunchaokete Bu", date: "2026-04-19", tournament: "Busan, South Korea", surface: "hard" },\n'
    wta_line = (
        f'  WTA_CHALLENGER: {{ id: "WTA_CHALLENGER", match_id: "wta125-history:{sample["match_key"]}", '
        f'p1: {q(sample["p1"])}, p2: {q(sample["p2"])}, date: {q(sample["date"])}, '
        f'tournament: {q(sample["tournament"])}, surface: {q(sample["surface"])} || null, sampling_source: "wta125_production_history" }},\n'
    )
    text = replace_once(
        text,
        old_atp_ch,
        old_atp_ch.replace('surface: "hard" }', 'surface: "hard", sampling_source: "verified_pbp_index" }') + wta_line,
        "ATP challenger + WTA125 bundled sample",
    )
    text = replace_once(
        text,
        '  const spec = SPECS[id];\n  for (const year of spec.years) {',
        '  const spec = SPECS[id];\n  if (spec) for (const year of spec.years) {',
        "optional filesystem spec",
    )
    text = replace_once(
        text,
        '      surface: row.surface ? String(row.surface) : null,\n    };',
        '      surface: row.surface ? String(row.surface) : null,\n      sampling_source: "verified_pbp_index",\n    };',
        "filesystem source tag",
    )
    SAMPLER.write_text(text)


def patch_diagnostic() -> None:
    text = DIAG.read_text()
    text = replace_once(
        text,
        'type RepresentativeId = "ATP_MAIN"|"WTA_MAIN"|"ATP_CHALLENGER";',
        'type RepresentativeId = "ATP_MAIN"|"WTA_MAIN"|"ATP_CHALLENGER"|"WTA_CHALLENGER";',
        "diagnostic representative union",
    )
    text = replace_once(
        text,
        'sampling_source:"matches"|"source_observations"|"matches_plus_rankings"|"metric_evidence_store"|"verified_pbp_index"',
        'sampling_source:"matches"|"source_observations"|"matches_plus_rankings"|"metric_evidence_store"|"verified_pbp_index"|"wta125_production_history"',
        "diagnostic source union",
    )
    text = replace_once(
        text,
        '  if (/wta\\s*125|wta125|125k/.test(combined)) return null;\n  if (/challenger/.test(combined)&&!/wta|women/.test(combined)) return "ATP_CHALLENGER";\n  if (/wta|women/.test(combined)&&!/challenger/.test(combined)) return "WTA_MAIN";',
        '  if (/wta\\s*125|wta125|125k|wta\\s*chall(?:enger)?/.test(combined)) return "WTA_CHALLENGER";\n  if (/challenger/.test(combined)&&!/wta|women/.test(combined)) return "ATP_CHALLENGER";\n  if (/wta|women/.test(combined)&&!/challenger|125k/.test(combined)) return "WTA_MAIN";',
        "four-tour classifier",
    )
    text = replace_once(
        text,
        'const wanted:RepresentativeId[]=["ATP_MAIN","WTA_MAIN","ATP_CHALLENGER"],selected:RepresentativeMatch[]=[];',
        'const wanted:RepresentativeId[]=["ATP_MAIN","WTA_MAIN","ATP_CHALLENGER","WTA_CHALLENGER"],selected:RepresentativeMatch[]=[];',
        "wanted four tours",
    )
    text = replace_once(
        text,
        'surface:row.surface,sampling_source:"verified_pbp_index"});',
        'surface:row.surface,sampling_source:row.sampling_source});',
        "repository sample source propagation",
    )
    text = text.replace(
        'No real persisted ${id} match, qualifying paired warehouse observation, ranking-proven current evidence snapshot, or verified PBP index match was available for diagnostic sampling.',
        'No real persisted ${id} match, qualifying paired warehouse observation, ranking-proven current evidence snapshot, or validated repository representative was available for diagnostic sampling.',
    )
    if "schema_version:10" in text:
        text = text.replace("schema_version:10", "schema_version:11", 1)
    elif "schema_version: 10" in text:
        text = text.replace("schema_version: 10", "schema_version: 11", 1)
    elif "schema_version:11" not in text and "schema_version: 11" not in text:
        raise SystemExit("Phase 28 patch target missing: schema version")
    DIAG.write_text(text)


def patch_proof() -> None:
    text = PROOF.read_text()
    text = replace_once(
        text,
        '            and (sampled("ATP_CHALLENGER") or missing_with_reason("ATP_CHALLENGER"))\'',
        '            and sampled("ATP_CHALLENGER")\n            and sampled("WTA_CHALLENGER")\'',
        "production proof four-tour gate",
    )
    PROOF.write_text(text)


def main() -> None:
    sample = latest_wta125_sample()
    patch_sampler(sample)
    patch_diagnostic()
    patch_proof()
    print(json.dumps({"phase": 28, "wta125_representative": sample}, indent=2))


if __name__ == "__main__":
    main()
