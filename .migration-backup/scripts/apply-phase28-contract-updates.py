#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIAG = ROOT / "src/lib/evidence-coverage-runtime-diagnostic.server.ts"
TEST = ROOT / "src/lib/evidence-coverage-runtime-diagnostic.test.ts"


def replace(text: str, old: str, new: str, label: str) -> str:
    if old in text:
        return text.replace(old, new)
    if new in text:
        return text
    raise SystemExit(f"Phase 28 contract target missing: {label}")


diagnostic = DIAG.read_text()
diagnostic = replace(
    diagnostic,
    'requested_classes:["ATP_MAIN","WTA_MAIN","ATP_CHALLENGER"]',
    'requested_classes:["ATP_MAIN","WTA_MAIN","ATP_CHALLENGER","WTA_CHALLENGER"]',
    "requested classes",
)
DIAG.write_text(diagnostic)

test = TEST.read_text()
test = replace(
    test,
    'No real persisted ${id} match, qualifying paired warehouse observation, ranking-proven current evidence snapshot, or verified PBP index match',
    'No real persisted ${id} match, qualifying paired warehouse observation, ranking-proven current evidence snapshot, or validated repository representative',
    "missing-class message",
)
test = replace(
    test,
    'sampling_source:"verified_pbp_index"',
    'sampling_source:row.sampling_source',
    "repository sample source assertion",
)
test = replace(test, 'schema_version:10', 'schema_version:11', "schema version")
test = replace(
    test,
    '/requested_classes\\s*:\\s*\\["ATP_MAIN","WTA_MAIN","ATP_CHALLENGER"\\]/',
    '/requested_classes\\s*:\\s*\\["ATP_MAIN","WTA_MAIN","ATP_CHALLENGER","WTA_CHALLENGER"\\]/',
    "four-tour requested-class regex",
)
TEST.write_text(test)
