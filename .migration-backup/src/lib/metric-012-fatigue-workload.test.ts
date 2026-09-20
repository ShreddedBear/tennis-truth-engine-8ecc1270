import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

// See docs/metric-audit-012-fatigue-workload.md. The pre-2018 DataHub
// match_stats files (data/public/datahub-atp/match_stats_*.csv) carry a real
// match_duration/match_time column, but that source's coverage stops in
// 2017 -- it cannot answer "recent" workload for a match being audited
// today. Wiring it into the recent-window family would silently misrepresent
// a 2005-2017 average as current form, exactly the substitution this test
// guards against.
const FORBIDDEN_RECENT_WORKLOAD_KEYS = ["rest_hours", "match_duration", "match_time", "late_finish", "minutes_on_court"];

describe("metric 012 — Fatigue/Workload", () => {
  it("never emits an hour-precision rest figure, a match-duration figure, or a late-finish figure from the recent-window sources", () => {
    for (const file of ["src/lib/predixsport-recent.server.ts", "src/lib/wta-official-match-evidence.server.ts", "src/lib/travel-burden.server.ts"]) {
      const body = source(file);
      for (const forbidden of FORBIDDEN_RECENT_WORKLOAD_KEYS) {
        expect(body, `${file} should not reference "${forbidden}"`).not.toContain(forbidden);
      }
    }
  });

  it("keeps every SUMMARY_KEYS['012'] entry a set-count/match-count/day-count/travel key, never a minutes-of-play or game-count key", () => {
    const hybrid = source("src/lib/hybrid-audit-research.server.ts");
    const row = hybrid.match(/"012":\s*\[([^\]]*)\]/)?.[1] ?? "";
    expect(row.length).toBeGreaterThan(0);
    for (const forbidden of FORBIDDEN_RECENT_WORKLOAD_KEYS) {
      expect(row).not.toContain(forbidden);
    }
    // The keys this family is honestly allowed to claim, per the audit.
    for (const expected of ["matches_last_7_days", "matches_last_14_days", "matches_last_28_days", "sets_last_14_days", "three_setters_last_14_days", "rest_days", "qualifying_matches_last_14_days", "days_since_last_match"]) {
      expect(row).toContain(expected);
    }
  });

  it("never lets the recent-workload family import the pre-2018 DataHub score/stats source", () => {
    // datahub-atp-score-profile.server.ts is the only module that reads
    // match_stats_*.csv / carries per-set game scores; it is deliberately
    // used for historical-only metrics (e.g. metric 011), never for the
    // recent-window Fatigue/Workload family.
    for (const file of ["src/lib/predixsport-recent.server.ts", "src/lib/wta-official-match-evidence.server.ts", "src/lib/travel-burden.server.ts"]) {
      const body = source(file);
      expect(body, `${file} should not import datahub-atp-score-profile.server`).not.toContain("datahub-atp-score-profile");
    }
  });
});
