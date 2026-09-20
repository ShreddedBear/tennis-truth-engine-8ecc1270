#!/usr/bin/env python3
from __future__ import annotations
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path('data/audit/bsd-wta-main-pbp-history')
OUT=Path('data/audit/bsd-wta-main-pbp-integration-validation.json')
OUT_MD=Path('data/audit/bsd-wta-main-pbp-integration-validation.md')
BOUNDARY='2024-12-02'
YEARS=(2024,2025,2026)
BLOCKED=('challenger','wta 125','wta125','125k','itf','utr','futures','satellite','exhibition','atp')

accepted=[]
rejected=[]
seen=set()
duplicate_ids=[]
missing_years=[]

for year in YEARS:
    p=ROOT/str(year)/'results.json'
    if not p.exists():
        missing_years.append(year)
        continue
    rows=json.loads(p.read_text())
    for row in rows if isinstance(rows,list) else []:
        if row.get('structurally_present') is not True:
            continue
        mid=str(row.get('match_id') or '')
        date=str(row.get('date') or '')[:10]
        circuit=str(row.get('circuit') or '').strip().upper()
        blob=f"{row.get('category') or ''} {row.get('tournament') or ''}".lower()
        reasons=[]
        if circuit!='WTA': reasons.append(f'circuit={circuit or "EMPTY"}')
        if any(x in blob for x in BLOCKED): reasons.append('blocked_tour_marker')
        if not date or date<BOUNDARY: reasons.append('before_boundary')
        if not mid: reasons.append('missing_match_id')
        if reasons:
            rejected.append({'year':year,'match_id':mid or None,'date':date or None,'reasons':reasons})
            continue
        if mid in seen:
            duplicate_ids.append(mid)
            continue
        seen.add(mid)
        accepted.append(row)

module=Path('src/lib/bsd-wta-main-pbp.server.ts')
warehouse=Path('src/lib/warehouse-first-researcher.server.ts')
advance=Path('scripts/advance-bsd-wta-main-pbp-history.py')
module_text=module.read_text() if module.exists() else ''
warehouse_text=warehouse.read_text() if warehouse.exists() else ''
advance_text=advance.read_text() if advance.exists() else ''

checks={
    'all_expected_year_files_present': not missing_years,
    'zero_contaminating_accepted_rows': not rejected,
    'zero_duplicate_match_ids': not duplicate_ids,
    'coverage_floor_enforced_in_metrics_module': 'const COVERAGE_START = "2024-12-02"' in module_text,
    'strict_wta_main_tour_guard_present': 'STRICT_WTA_MAIN_ONLY' in module_text and 'strictIndexedWtaMain' in module_text,
    'duplicate_guard_present_in_metrics_module': 'seenMatchIds' in module_text,
    'metrics_pipeline_wired': 'buildBsdWtaMainPbpContext' in warehouse_text and '_bsd_wta_main_pbp_status' in warehouse_text,
    'historical_scan_locked_at_boundary': "BOUNDARY_DATE='2024-12-02'" in advance_text and "BOUNDARY_YEAR=2024" in advance_text,
}
passed=all(checks.values())
report={
    'generated_at_utc':datetime.now(timezone.utc).isoformat(),
    'boundary':BOUNDARY,
    'years':list(YEARS),
    'accepted_unique_usable_wta_main_pbp_matches':len(accepted),
    'rejected_contaminating_or_preboundary_rows':len(rejected),
    'duplicate_match_ids':len(duplicate_ids),
    'missing_year_files':missing_years,
    'checks':checks,
    'validation_passed':passed,
    'rejected_examples':rejected[:25],
    'duplicate_examples':duplicate_ids[:25],
}
OUT.parent.mkdir(parents=True,exist_ok=True)
OUT.write_text(json.dumps(report,indent=2)+'\n')
lines=[
    '# BSD WTA Main PBP Integration Validation','',
    f"Validation: {'PASS' if passed else 'FAIL'}",
    f"Locked coverage: {BOUNDARY} → current",
    f"Accepted unique usable WTA Main PBP matches: {len(accepted):,}",
    f"Rejected contamination/pre-boundary rows: {len(rejected):,}",
    f"Duplicate match IDs: {len(duplicate_ids):,}",
    '', '## Checks'
]
for name,value in checks.items(): lines.append(f"- {'PASS' if value else 'FAIL'} — {name}")
OUT_MD.write_text('\n'.join(lines)+'\n')
print(json.dumps(report,separators=(',',':')))
raise SystemExit(0 if passed else 1)
