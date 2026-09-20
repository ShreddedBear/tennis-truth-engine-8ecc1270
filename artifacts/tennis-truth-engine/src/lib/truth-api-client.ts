/**
 * Same-origin Truth Engine API client.
 *
 * Browser requests deliberately use credentials: "include": Clerk's web
 * session is transported by the session cookie, never by a bearer token.
 */
export class TruthApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, payload: unknown) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error?: unknown }).error)
        : `Truth Engine request failed (${status})`;
    super(message);
    this.name = "TruthApiError";
    this.status = status;
    this.payload = payload;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const payload: unknown = await response
    .json()
    .catch(() => undefined);
  if (!response.ok) throw new TruthApiError(response.status, payload);
  return payload as T;
}

export type TruthMatch = Record<string, unknown> & { id: string };
export type TruthAudit = Record<string, unknown> & { id: string };

export const truthApi = {
  getDashboard: () =>
    request<{
      matches: unknown[];
      runs: unknown[];
      versions: unknown[];
      decisions: unknown[];
      stages: unknown[];
      coverage: unknown[];
      uploads: unknown[];
      version: unknown;
      buckets: unknown[];
    }>("/truth-engine/app/dashboard"),
  getSlate: () =>
    request<{
      matches: unknown[];
      runs: unknown[];
      versions: unknown[];
      decisions: unknown[];
      stages: unknown[];
      coverage: unknown[];
    }>("/truth-engine/app/slate"),
  getBoard: () =>
    request<{
      decisions: unknown[];
      runs: unknown[];
      matches: unknown[];
      fields: unknown[];
      versions: unknown[];
    }>("/truth-engine/app/board"),
  getLogs: () =>
    request<{ logs: unknown[]; runs: unknown[]; versions: unknown[] }>(
      "/truth-engine/app/logs",
    ),
  getSourcesScreen: () =>
    request<{ snapshots: unknown[]; conflicts: unknown[] }>(
      "/truth-engine/app/sources",
    ),
  getRulesScreen: () =>
    request<{ documents: unknown[]; versions: unknown[]; rules: unknown[] }>(
      "/truth-engine/app/rules",
    ),
  getCalibrationScreen: () =>
    request<{ version: unknown; buckets: unknown[]; ledger: unknown[] }>(
      "/truth-engine/app/calibration",
    ),
  getCalibrationHistory: () =>
    request<{ versions: unknown[]; buckets: unknown[] }>(
      "/truth-engine/app/calibration-history",
    ),
  getMatchView: (matchId: string) =>
    request<Record<string, unknown>>(
      `/truth-engine/app/matches/${encodeURIComponent(matchId)}/view`,
    ),
  resolveSourceConflict: (conflictId: string, resolutionStatus: string) =>
    request<unknown>(
      `/truth-engine/sources/conflicts/${encodeURIComponent(conflictId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ resolutionStatus }),
      },
    ),
  updateResult: (runId: string, resultType: string, resultId: string, fields: Record<string, unknown>) =>
    request<unknown>(
      `/truth-engine/audits/${encodeURIComponent(runId)}/results/${encodeURIComponent(resultType)}/${encodeURIComponent(resultId)}`,
      { method: "PATCH", body: JSON.stringify(fields) },
    ),
  updateMatch: (matchId: string, fields: Record<string, unknown>) =>
    request<unknown>(`/truth-engine/matches/${encodeURIComponent(matchId)}`, {
      method: "PATCH",
      body: JSON.stringify(fields),
    }),
  getMatch: (matchId: string) =>
    request<{ match: TruthMatch; fields: Record<string, unknown> }>(
      `/truth-engine/matches/${encodeURIComponent(matchId)}`,
    ),
  getAudit: (matchId: string) =>
    request<TruthAudit>(`/truth-engine/matches/${encodeURIComponent(matchId)}/audit`),
  getStages: (runId: string) =>
    request<unknown[]>(`/truth-engine/audits/${encodeURIComponent(runId)}/stages`),
  getResults: (runId: string) =>
    request<unknown[]>(`/truth-engine/audits/${encodeURIComponent(runId)}/results`),
  getSources: (runId: string) =>
    request<unknown[]>(`/truth-engine/audits/${encodeURIComponent(runId)}/sources`),
  getMetrics: (runId: string) =>
    request<unknown[]>(`/truth-engine/audits/${encodeURIComponent(runId)}/metrics`),
  getEvidence: (query: URLSearchParams = new URLSearchParams()) =>
    request<unknown[]>(`/truth-engine/evidence?${query.toString()}`),
  getCalibration: () => request<unknown[]>("/truth-engine/calibration"),
  getCalibrationObservations: (matchId: string) =>
    request<unknown[]>(
      `/truth-engine/matches/${encodeURIComponent(matchId)}/calibration-observations`,
    ),
  getRules: (docType: string) =>
    request<unknown[]>(`/truth-engine/rules/${encodeURIComponent(docType)}`),
  getGrades: (matchId: string) =>
    request<unknown[]>(`/truth-engine/matches/${encodeURIComponent(matchId)}/grades`),
  getIngestionTargets: (sourceId: string) =>
    request<unknown[]>(
      `/truth-engine/ingestion/${encodeURIComponent(sourceId)}/targets`,
    ),
  claimLease: (runId: string) =>
    request<{ ok: true }>(
      `/truth-engine/audits/${encodeURIComponent(runId)}/lease/claim`,
      { method: "POST" },
    ),
  renewLease: (runId: string) =>
    request<{ ok: true }>(
      `/truth-engine/audits/${encodeURIComponent(runId)}/lease/renew`,
      { method: "POST" },
    ),
  releaseLease: (runId: string) =>
    request<{ ok: true }>(
      `/truth-engine/audits/${encodeURIComponent(runId)}/lease/release`,
      { method: "POST" },
    ),
};

export async function uploadTruthSummary(body: {
  filename: string;
  rawText: string;
  pageCount: number;
  match: {
    canonicalKey: string;
    player1Name: string;
    player2Name: string;
    tournamentName?: string | null;
    eventLevel?: string | null;
    round?: string | null;
    scheduledDate?: string | null;
    surface?: string | null;
    bestOf?: number | null;
  };
  fields?: Array<{
    fieldKey: string;
    rawValue?: string | null;
    normalizedValue?: string | null;
    fieldType?: string | null;
  }>;
}) {
  return request<{ upload: unknown; match: unknown; version: unknown }>("/truth-engine/uploads", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function publishTruthRules(docType: string, content: string) {
  return request<unknown>(
    `/truth-engine/admin/rules/${encodeURIComponent(docType)}/publish`,
    { method: "POST", body: JSON.stringify({ content }) },
  );
}

export async function clearTruthSlate() {
  return request<unknown>("/truth-engine/admin/clear-slate", {
    method: "POST",
    body: JSON.stringify({}),
  });
}