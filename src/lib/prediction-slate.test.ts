// SLATE ISOLATION REGRESSION SUITE (specification items W, X, Y, Z).
//
// The failure being locked out: Clear Slate, then re-upload the identical 50-match PDF, and
// the application answers "0 new matches, 50 existing matches reused" -- silently handing the
// new prediction slate the retired slate's match ids, and with them its audit runs, metric
// results, evidence and decisions.

import { describe, expect, it } from "vitest";
import {
  activeSlate,
  dedupeCandidates,
  describeSlateIsolation,
  matchesOnSlate,
} from "./prediction-slate";
import { selectReusableMatch, type DedupeMatchRow } from "./slate-match-dedupe";
import { clearOperationalSlate } from "./reset-slate.functions";

const SLATE_A = "slate-a";
const SLATE_B = "slate-b";

function fixtureRow(over: Partial<DedupeMatchRow> = {}): DedupeMatchRow {
  return {
    id: "match-a",
    slate_id: SLATE_A,
    canonical_key: "wimbledon|r1|2026-08-31|alpha player|beta player",
    player1_name: "Alpha Player",
    player2_name: "Beta Player",
    scheduled_date: "2026-08-31",
    tournament_name: "Wimbledon",
    round: "R1",
    ...over,
  };
}

const target = {
  canonical_key: "wimbledon|r1|2026-08-31|alpha player|beta player",
  player1_name: "Alpha Player",
  player2_name: "Beta Player",
  scheduled_date: "2026-08-31",
  tournament_name: "Wimbledon",
  round: "R1",
};

describe("W. a cleared slate cannot be reused by a new upload", () => {
  it("does not reuse a retired slate's match even on an exact canonical-key hit", () => {
    const retired = fixtureRow();
    // THE ORIGINAL BUG: an unscoped dedupe finds this row and calls it "existing".
    expect(selectReusableMatch([retired], target, SLATE_A)).toBe(retired);
    // Scoped to the NEW slate, the same row is not a candidate at all.
    expect(selectReusableMatch([retired], target, SLATE_B)).toBeNull();
  });

  it("does not reuse a retired match through the fuzzy same-pair path either", () => {
    const retired = fixtureRow({
      canonical_key: "different-key",
      tournament_name: null,
      scheduled_date: null,
    });
    expect(selectReusableMatch([retired], target, SLATE_A)).toBe(retired);
    expect(selectReusableMatch([retired], target, SLATE_B)).toBeNull();
  });

  it("treats a match with no slate as unknown provenance, never as current", () => {
    expect(selectReusableMatch([fixtureRow({ slate_id: null })], target, SLATE_B)).toBeNull();
    expect(dedupeCandidates([fixtureRow({ slate_id: null })], null)).toEqual([]);
  });

  it("still deduplicates WITHIN the current slate, so one upload cannot double-ingest", () => {
    const current = fixtureRow({ id: "match-b", slate_id: SLATE_B });
    expect(selectReusableMatch([current], target, SLATE_B)).toBe(current);
  });
});

describe("X. re-uploading the same 50-match PDF after Clear Slate creates a new slate", () => {
  it("reports 50 created and 0 reused instead of 0 created and 50 reused", () => {
    const slateA: DedupeMatchRow[] = Array.from({ length: 50 }, (_, i) =>
      fixtureRow({
        id: `a-${i}`,
        slate_id: SLATE_A,
        canonical_key: `wimbledon|r1|2026-08-31|p${i}a|p${i}b`,
        player1_name: `P${i}A Player`,
        player2_name: `P${i}B Player`,
      }),
    );
    const upload = slateA.map((row) => ({
      canonical_key: row.canonical_key!,
      player1_name: row.player1_name,
      player2_name: row.player2_name,
      scheduled_date: row.scheduled_date,
      tournament_name: row.tournament_name,
      round: row.round,
    }));

    // BEFORE the fix (the whole matches table as the candidate universe): all 50 reused.
    const unscopedReuse = upload.filter(
      (m) => selectReusableMatch(slateA, m, SLATE_A) !== null,
    ).length;
    expect(unscopedReuse).toBe(50);

    // AFTER Clear Slate, uploading into Slate B: nothing is reusable, so all 50 are created.
    const created = upload.filter((m) => selectReusableMatch(slateA, m, SLATE_B) === null).length;
    const reused = upload.length - created;
    expect(created).toBe(50);
    expect(reused).toBe(0);
  });
});

describe("Y. refreshing cannot resurrect a cleared slate", () => {
  it("returns nothing current once the slate is retired, however the data is re-read", () => {
    const slates = [
      { id: SLATE_A, retired_at: "2026-09-05T10:00:00.000Z" },
      { id: SLATE_B, retired_at: null },
    ];
    const matches = [fixtureRow(), fixtureRow({ id: "match-b", slate_id: SLATE_B })];

    expect(activeSlate(slates)!.id).toBe(SLATE_B);
    // A re-read (a refresh) resolves the current slate again and gets the same answer.
    expect(matchesOnSlate(matches, activeSlate(slates)!.id).map((m) => m.id)).toEqual(["match-b"]);

    // And with EVERY slate retired the current slate is empty -- "Active Slate = 0" -- rather
    // than falling back to the most recent retired one.
    const allRetired = slates.map((s) => ({ ...s, retired_at: "2026-09-05T10:00:00.000Z" }));
    expect(activeSlate(allRetired)).toBeNull();
    expect(matchesOnSlate(matches, null)).toEqual([]);
  });

  it("describes what it is looking at without hiding the retired rows' existence", () => {
    const report = describeSlateIsolation(
      [
        fixtureRow(),
        fixtureRow({ id: "b", slate_id: SLATE_B }),
        fixtureRow({ id: "c", slate_id: null }),
      ],
      SLATE_B,
    );
    expect(report).toEqual({
      active_slate_id: SLATE_B,
      current_slate_matches: 1,
      retired_matches: 1,
      unassigned_matches: 1,
    });
  });
});

// ---------------------------------------------------------------------------------------
// Z — Clear Slate retires, and preserves global reference data
// ---------------------------------------------------------------------------------------

type Row = Record<string, unknown>;

class MemoryDb {
  tables: Record<string, Row[]>;
  constructor() {
    this.tables = {
      prediction_slates: [{ id: SLATE_A, slate_number: 1, retired_at: null }],
      summary_uploads: [{ id: "upload-1" }],
      summary_versions: [
        { id: "version-1", upload_id: "upload-1", match_id: "match-current", is_active: true },
      ],
      matches: [
        { id: "match-current", slate_id: SLATE_A },
        { id: "match-older-on-slate", slate_id: SLATE_A },
      ],
      audit_runs: [
        {
          id: "run-2",
          match_id: "match-current",
          run_number: 2,
          status: "RUNNING",
          lease_owner: "worker-1",
        },
        { id: "run-1", match_id: "match-current", run_number: 1, status: "COMPLETE" },
        { id: "run-old", match_id: "match-older-on-slate", run_number: 1, status: "COMPLETE" },
      ],
      // GLOBAL REFERENCE DATA -- must survive untouched.
      players: [{ id: "player-1", full_name: "Alpha Player" }],
      metric_evidence_store: [{ id: "evidence-1", metric_code: "001" }],
      source_observations: [{ id: "observation-1" }],
      rule_documents: [{ id: "rules-1" }],
      metric_registry: [{ id: "metric-1" }],
      calibration_versions: [{ id: "calibration-1" }],
      calibration_buckets: [{ id: "bucket-1" }],
      truth_engine_calibration_observations: [{ id: "obs-1", prediction_outcome: "WIN" }],
    };
  }

  async rpc(name: string, args: Record<string, unknown>) {
    if (name !== "retire_active_prediction_slate") throw new Error(`unexpected rpc ${name}`);
    const active = this.tables.prediction_slates.find((s) => !s.retired_at);
    if (!active) return { data: null, error: null };
    active.retired_at = "2026-09-05T12:00:00.000Z";
    active.retired_reason = args.reason;
    return { data: active.id, error: null };
  }

  from(table: string) {
    const db = this;
    return {
      mode: "select" as "select" | "update" | "delete",
      patch: null as Record<string, unknown> | null,
      select() {
        return this;
      },
      update(patch: Record<string, unknown>) {
        this.mode = "update";
        this.patch = patch;
        return this;
      },
      delete() {
        this.mode = "delete";
        return this;
      },
      in(column: string, values: string[]) {
        const rows = db.tables[table] ?? [];
        const selected = new Set(values);
        if (this.mode === "update") {
          db.tables[table] = rows.map((row) =>
            selected.has(String(row[column])) ? { ...row, ...this.patch } : row,
          );
          return Promise.resolve({ data: null, error: null });
        }
        if (this.mode === "delete") {
          db.tables[table] = rows.filter((row) => !selected.has(String(row[column])));
          return Promise.resolve({ data: null, error: null });
        }
        return Promise.resolve({
          data: rows.filter((row) => selected.has(String(row[column]))),
          error: null,
        });
      },
      then(resolve: (value: { data: Row[]; error: null }) => unknown) {
        return Promise.resolve({ data: db.tables[table] ?? [], error: null }).then(resolve);
      },
    };
  }
}

describe("Z. Clear Slate retires the slate and preserves global reference data", () => {
  it("retires the active slate, deactivates its versions and invalidates ALL of its runs", async () => {
    const db = new MemoryDb();
    const result = await clearOperationalSlate(db);

    expect(result.retiredSlateId).toBe(SLATE_A);
    expect(db.tables.prediction_slates[0].retired_at).toBeTruthy();
    expect(db.tables.prediction_slates[0].retired_reason).toBe("CLEAR_SLATE");

    // Every run on the retired slate, not just each match's latest: no older run may be
    // resolvable as "active" afterwards.
    expect(result.auditRuns).toBe(3);
    expect(db.tables.audit_runs.every((r) => String(r.status).startsWith("INVALIDATED"))).toBe(
      true,
    );
    expect(db.tables.audit_runs.every((r) => r.lease_owner === null)).toBe(true);

    expect(db.tables.summary_versions.every((v) => v.is_active === false)).toBe(true);
    expect(db.tables.matches.every((m) => m.active_summary_version_id === null)).toBe(true);
  });

  it("deletes nothing -- the retired slate stays auditable", async () => {
    const db = new MemoryDb();
    await clearOperationalSlate(db);
    expect(db.tables.matches).toHaveLength(2);
    expect(db.tables.audit_runs).toHaveLength(3);
    expect(db.tables.summary_versions).toHaveLength(1);
    expect(db.tables.summary_uploads).toHaveLength(1);
  });

  it("leaves every global reference table exactly as it was", async () => {
    const db = new MemoryDb();
    const before = JSON.stringify([
      db.tables.players,
      db.tables.metric_evidence_store,
      db.tables.source_observations,
      db.tables.rule_documents,
      db.tables.metric_registry,
      db.tables.calibration_versions,
      db.tables.calibration_buckets,
      db.tables.truth_engine_calibration_observations,
    ]);
    await clearOperationalSlate(db);
    const after = JSON.stringify([
      db.tables.players,
      db.tables.metric_evidence_store,
      db.tables.source_observations,
      db.tables.rule_documents,
      db.tables.metric_registry,
      db.tables.calibration_versions,
      db.tables.calibration_buckets,
      db.tables.truth_engine_calibration_observations,
    ]);
    expect(after).toBe(before);
  });

  it("is idempotent: a second clear with no active slate retires nothing", async () => {
    const db = new MemoryDb();
    await clearOperationalSlate(db);
    const second = await clearOperationalSlate(db);
    expect(second.retiredSlateId).toBeNull();
    expect(second.summaryVersions).toBe(0);
  });
});
