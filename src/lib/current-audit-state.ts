export type AuditRunRef = {
  id: string;
  match_id: string;
  run_number: number;
};

export type AuditDecisionRef = {
  audit_run_id: string;
  audit_complete: boolean;
};

export function latestRunsByMatch<T extends AuditRunRef>(runs: T[]) {
  const latest = new Map<string, T>();
  for (const run of runs) {
    const current = latest.get(run.match_id);
    if (!current || run.run_number > current.run_number) latest.set(run.match_id, run);
  }
  return latest;
}

export function currentAuditRows<
  M extends { id: string },
  R extends AuditRunRef,
  D extends AuditDecisionRef,
>(matches: M[], runs: R[], decisions: D[]) {
  const latest = latestRunsByMatch(runs);
  const decisionsByRun = new Map(decisions.map((decision) => [decision.audit_run_id, decision]));
  return matches.map((match) => {
    const run = latest.get(match.id) ?? null;
    return {
      match,
      run,
      decision: run ? decisionsByRun.get(run.id) ?? null : null,
    };
  });
}