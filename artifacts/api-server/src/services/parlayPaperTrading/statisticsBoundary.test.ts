import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Static proof (same technique as scripts/checkParlayBoundary.ts's Builder/Prediction-Engine
 * import boundary) that the isolated prospective-statistics code path can never read from
 * Research V1, the Prediction Engine, or the legacy retrospective Builder tables.
 *
 * statistics.ts itself already can't -- it has no `db`/`pool` import at all, so this file's real
 * job is proving the DB-touching layer that FEEDS it (the admin stats route) stays equally
 * narrow. A grep-based check is the right tool here: it fails the instant someone adds a new
 * table reference, before any query ever runs against a real database, and it can't be fooled by
 * mocking the way a runtime DB-stub test could be.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));

const FORBIDDEN: Array<[RegExp, string]> = [
  [/parlayBuilderResearchV1(Runs|Results)Table/, "Research V1 table reference"],
  [/parlay_builder_research_v1/, "Research V1 raw table name"],
  [/evaluationPredictionsTable/, "Prediction Engine evaluationPredictionsTable reference"],
  [/evaluation_predictions/, "Prediction Engine raw table name"],
  [/evaluationRunsTable/, "Prediction Engine evaluationRunsTable reference"],
  [/builder_decision_log/, "legacy retrospective builder_decision_log reference"],
  [/parlay_leg_outcomes/, "legacy retrospective parlay_leg_outcomes reference"],
  [/historical_matches/, "raw historical_matches query (settlement's job, not statistics')"],
  [/historicalMatchesTable/, "historicalMatchesTable reference (settlement's job, not statistics')"],
  [/from\s+['"].*predictionEngine['"]/, "import from predictionEngine/"],
  [/from\s+['"].*\/predictionEngine\//, "import from predictionEngine/"],
];

const ALLOWED_TABLE_IMPORTS = ["parlayPaperTradesTable", "parlayPaperTradePairsTable"];

function loadNonCommentCode(relativePath: string): string {
  const full = join(__dirname, relativePath);
  const lines = readFileSync(full, "utf8").split("\n");
  return lines
    .filter((line) => {
      const trimmed = line.trimStart();
      return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/**");
    })
    .map((line) => {
      const commentStart = line.indexOf("//");
      return commentStart >= 0 ? line.slice(0, commentStart) : line;
    })
    .join("\n");
}

describe("statistics isolation boundary (static source scan)", () => {
  const files = [
    ["statistics.ts", "statistics.ts"],
    ["../../routes/adminParlayPaperTrading.ts (stats route)", "../../routes/adminParlayPaperTrading.ts"],
  ] as const;

  for (const [label, relPath] of files) {
    it(`${label} references none of the excluded retrospective/unrelated tables`, () => {
      const code = loadNonCommentCode(relPath);
      const violations = FORBIDDEN
        .filter(([pattern]) => pattern.test(code))
        .map(([, reason]) => reason);
      assert.deepStrictEqual(violations, [], `Found forbidden references in ${relPath}: ${violations.join(", ")}`);
    });
  }

  it("statistics.ts has no db/pool import at all -- it is architecturally incapable of querying any table", () => {
    const code = loadNonCommentCode("statistics.ts");
    assert.ok(!/from\s+["']@workspace\/db["']/.test(code), "statistics.ts must not import @workspace/db");
    assert.ok(!/\bdb\.(select|insert|update|delete)/.test(code), "statistics.ts must not call db.* query methods");
    assert.ok(!/pool\.query/.test(code), "statistics.ts must not call pool.query");
  });

  it("the stats route performs no mutation (no insert/update/delete anywhere in the file)", () => {
    const code = loadNonCommentCode("../../routes/adminParlayPaperTrading.ts");
    assert.ok(!/\bdb\.(insert|update|delete)\b/.test(code), "adminParlayPaperTrading.ts must never mutate");
  });

  it("the stats route makes no live provider/HTTP calls (no fetch, no odds/injury/matchstat provider imports)", () => {
    const code = loadNonCommentCode("../../routes/adminParlayPaperTrading.ts");
    assert.ok(!/\bfetch\s*\(/.test(code), "must not call fetch()");
    assert.ok(!/builderProviderFetch|acquireBuilderEvidence|computeBuilderScore/.test(code), "must not invoke Builder evidence acquisition/scoring");
  });

  it("the stats route bounds both queries (no unbounded historical scan)", () => {
    const code = readFileSync(join(__dirname, "../../routes/adminParlayPaperTrading.ts"), "utf8");
    const statsHandlerStart = code.indexOf('"/admin/parlay-paper-trading/stats"');
    assert.ok(statsHandlerStart >= 0, "expected the /stats route to exist");
    const handlerBody = code.slice(statsHandlerStart);
    const limitCount = (handlerBody.match(/\.limit\(STATS_ROW_CAP\)/g) ?? []).length;
    assert.strictEqual(limitCount, 2, "both the trades and pairs queries must be bounded by STATS_ROW_CAP");
  });

  it("the admin stats route filters out synthetic TEST- fixtures on both queries", () => {
    const code = readFileSync(join(__dirname, "../../routes/adminParlayPaperTrading.ts"), "utf8");
    const occurrences = (code.match(/NOT LIKE 'TEST-%'/g) ?? []).length;
    assert.ok(occurrences >= 2, "expected the TEST- exclusion on both the trades and pairs stats queries");
  });

  it("the admin stats route only imports the two allowed paper-trading tables from @workspace/db", () => {
    const code = readFileSync(join(__dirname, "../../routes/adminParlayPaperTrading.ts"), "utf8");
    const importMatch = code.match(/import\s*\{([^}]+)\}\s*from\s*["']@workspace\/db["']/);
    assert.ok(importMatch, "expected a @workspace/db import in adminParlayPaperTrading.ts");
    const imported = importMatch![1].split(",").map((s) => s.trim()).filter(Boolean);
    for (const name of imported) {
      const isAllowedTable = ALLOWED_TABLE_IMPORTS.includes(name);
      const isDbHandle = name === "db";
      const isFactorsOrSnapshots = name === "parlayPaperTradeFactorsTable" || name === "parlayPaperTradeSnapshotsTable";
      assert.ok(
        isAllowedTable || isDbHandle || isFactorsOrSnapshots,
        `Unexpected @workspace/db import in adminParlayPaperTrading.ts: ${name}`,
      );
    }
  });
});
