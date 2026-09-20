/**
 * Named server-to-server Truth operations.
 *
 * Audit workers run outside the browser, so they must not use a Supabase
 * client (or receive a database connection). The API server authenticates
 * these calls with the dedicated internal service credential.
 */
export async function truthServerOperation<T>(
  operation: string,
  input: Record<string, unknown> = {},
): Promise<T> {
  const configuredBase = process.env.TRUTH_ENGINE_API_URL?.trim();
  const isProduction = process.env.NODE_ENV === "production";
  // Local workers default to the shared development proxy. Production must
  // explicitly name its API origin so a missing deployment setting cannot
  // silently send worker writes to localhost.
  if (isProduction && !configuredBase) {
    throw new Error("TRUTH_ENGINE_API_URL is required in production for Truth Engine server operations");
  }
  const base = (configuredBase || "http://localhost:80/api").replace(/\/$/, "");
  const token = process.env.ADMIN_ACCESS_KEY;
  if (!token) {
    throw new Error("ADMIN_ACCESS_KEY is not configured; refusing server Truth operation");
  }
  const response = await fetch(`${base}/truth-engine/internal/${operation}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
  const payload = await response.json().catch(() => undefined);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload
      ? String((payload as { error?: unknown }).error)
      : `Truth operation ${operation} failed (${response.status})`;
    throw new Error(message);
  }
  return payload as T;
}

export type TruthIngestionTarget = {
  id: string;
  sourceId: string;
  targetKey: string;
  pullbackStart: string | null;
  pullbackEnd: string | null;
  config: Record<string, unknown> | null;
};

/** Source identifiers mirror live heliumdb TEXT values, never UUIDs. */
export function ingestionSourceId(value: string): string {
  const sourceId = value.trim();
  if (!sourceId) throw new Error("Ingestion sourceId must be a non-empty text value");
  return sourceId;
}

export async function ingestionTargets(sourceId: string) {
  sourceId = ingestionSourceId(sourceId);
  const result = await truthServerOperation<{ targets: TruthIngestionTarget[] }>("ingestion-targets", { sourceId });
  return {
    targets: result.targets.map((target) => ({
      id: target.id,
      source_id: target.sourceId,
      target_key: target.targetKey,
      pullback_start: target.pullbackStart,
      pullback_end: target.pullbackEnd,
      config: target.config,
    })),
  };
}

export async function ingestionStartRun(sourceId: string, jobType: string) {
  sourceId = ingestionSourceId(sourceId);
  return truthServerOperation<{ run: { id: string } }>("ingestion-start-run", { sourceId, jobType });
}

export async function ingestionFinishRun(
  runId: string,
  result: { recordsSeen?: number; recordsInserted?: number; metadata?: unknown },
) {
  return truthServerOperation<{ run: unknown }>("ingestion-finish-run", { runId, ...result });
}

export async function ingestionFailRun(runId: string, errorMessage: string) {
  return truthServerOperation<{ run: unknown }>("ingestion-fail-run", { runId, errorMessage });
}

export async function ingestionUpsertObservations(
  rows: Record<string, unknown>[],
  ignoreDuplicates = false,
) {
  return truthServerOperation<{ rows: unknown[] }>("ingestion-upsert-observations", {
    rows,
    ignoreDuplicates,
  });
}

export async function ingestionConfirmObservations(sourceId: string, keys: string[]) {
  sourceId = ingestionSourceId(sourceId);
  const result = await truthServerOperation<{ rows: Array<{ sourceRecordKey: string | null }> }>(
    "ingestion-confirm-observations",
    { sourceId, keys },
  );
  return { data: result.rows.map((row) => ({ source_record_key: row.sourceRecordKey })) };
}

export async function ingestionTouchTarget(targetId: string) {
  return truthServerOperation<{ target: unknown }>("ingestion-touch-target", { targetId });
}

export async function resultCaptureMatches() {
  return truthServerOperation<{ matches: any[] }>("result-capture-matches");
}
export async function resultCaptureState() {
  return truthServerOperation<{ runs: any[]; decisions: any[]; grades: any[] }>("result-capture-state");
}
export async function resultCaptureUpdateMatch(matchId: string, patch: Record<string, unknown>) {
  return truthServerOperation<{ ok: true }>("result-capture-update-match", { matchId, patch });
}
export async function resultCaptureSaveGrade(existingId: string | null, row: Record<string, unknown>) {
  return truthServerOperation<{ ok: true }>("result-capture-save-grade", { existingId, row });
}
export async function resultCaptureLog(entry: Record<string, unknown>) {
  return truthServerOperation<{ ok: true }>("result-capture-log", { entry });
}
export async function gradeCalibration(input: Record<string, unknown>) {
  return truthServerOperation<{ version: any }>("calibration-grade", { input });
}
export async function observationContextRows(aliases: string[], asOfDate: string, startDate: string) {
  return truthServerOperation<{ rows: any[] }>("observation-context-rows", { aliases, asOfDate, startDate });
}
export async function upsertMetricEvidence(input: Record<string, unknown>) {
  return truthServerOperation<{ data: any; error: { message: string } | null }>("evidence-upsert", { payload: input });
}
export async function metricEvidenceRows(metricCodes: string[], asOfDate: string) {
  return truthServerOperation<{ rows: any[] }>("metric-evidence-rows", { metricCodes, asOfDate });
}

/**
 * Transitional typed query facade for legacy deterministic calculators. The
 * table names are converted into explicit operation names by the API server;
 * callers cannot submit SQL or arbitrary table names. New code should use a
 * named operation directly.
 */
export const truthServerDb = {
  from(table: string) {
    const state: Record<string, unknown> = { table, action: "select" };
    const chain: Record<string, unknown> = {};
    const method = (name: string, ...args: unknown[]) => {
      if (name === "select") state.columns = args[0] ?? "*";
      else if (name === "insert" || name === "update" || name === "upsert") {
        state.action = name;
        state.values = args[0];
        if (args[1]) state.options = args[1];
      } else if (name === "delete") state.action = "delete";
      else if (name === "single" || name === "maybeSingle") state.cardinality = name;
      else {
        const filters = (state.filters as unknown[] | undefined) ?? [];
        filters.push({ name, args });
        state.filters = filters;
      }
      return chain;
    };
    for (const name of ["select", "insert", "update", "upsert", "delete", "eq", "neq", "not", "in", "ilike", "is", "gte", "gt", "lte", "lt", "order", "range", "limit", "single", "maybeSingle"]) {
      chain[name] = (...args: unknown[]) => method(name, ...args);
    }
    chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
      const table = String(state.table);
      const allowed = new Set(["matches", "source_observations", "metric_evidence_store", "parsed_summary_fields", "summary_versions", "players"]);
      if (!allowed.has(table)) return Promise.reject(new Error(`Unsupported Truth deterministic table: ${table}`)).then(resolve, reject);
      const action = String(state.action ?? "select").replace(/[^a-z]/g, "");
      return truthServerOperation<{ data: unknown; error: { message: string } | null }>(
        `deterministic-${action}-${table}`,
        state,
      ).then(resolve, reject);
    };
    return chain as {
      select: (...args: unknown[]) => typeof chain;
      [key: string]: unknown;
    };
  },
};