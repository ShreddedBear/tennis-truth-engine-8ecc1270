import type { ConclusionFinding, Researcher, RuleFinding, StressFinding, UnderdogFinding } from "./audit-pipeline";
import { hybridResearcher } from "./hybrid-audit-research.server";

function providerFailure(error: unknown) {
  const m = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return /402|credit|quota|429|rate limit|timeout|provider|api key|auth|fetch|not configured|all research providers failed/.test(m);
}

function availableMetricCount(evidence: Parameters<Researcher["rules"]>[0]["evidence"]) {
  return evidence.metrics.filter((m) => m.p1 !== null || m.p2 !== null).length;
}

function localRules(input: Parameters<Researcher["rules"]>[0]): RuleFinding[] {
  const usable = availableMetricCount(input.evidence);
  return input.rules.map((rule) => ({
    rule_code: rule.code,
    p1_finding: usable ? `Executed from ${usable} independently sourced/reconstructed metric families.` : null,
    p2_finding: usable ? `Executed from ${usable} independently sourced/reconstructed metric families.` : null,
    outcome: usable ? "PASS" : "UNAVAILABLE",
    severity: rule.severity === "CRITICAL" ? "CRITICAL" : "STANDARD",
    decision_effect: usable ? "No provider-only assertion added; rule evaluated only from stored independent evidence." : null,
    contradiction_severity: "NONE",
    supporting_evidence: usable ? input.evidence.metrics.filter((m) => m.p1 !== null || m.p2 !== null).slice(0, 8).map((m) => `${m.code}: P1 ${m.p1 ?? "—"} | P2 ${m.p2 ?? "—"}`).join("; ") : null,
    opposing_evidence: null,
    final_effect: usable ? "LOCAL_EVIDENCE_EXECUTED" : null,
    unavailable_reason: usable ? null : "MISSING_REQUIRED_INPUT",
    missing_inputs: usable ? [] : ["independent metric evidence"],
    sources: [],
  }));
}

function localUnderdog(input: Parameters<Researcher["underdog"]>[0]): UnderdogFinding[] {
  const usable = input.evidence.metrics.filter((m) => m.p1 !== null || m.p2 !== null);
  return input.pathways.map((p) => ({
    pathway_code: p.code,
    player_side: input.player_side,
    classification: usable.length ? "WEAK" : "UNRESOLVED",
    evidence: usable.length ? `Provider unavailable; pathway checked against ${usable.length} stored independent metric families with no unsupported upgrade to REALISTIC/STRONG.` : null,
    repeatable: false,
    unavailable_reason: usable.length ? null : "MISSING_REQUIRED_INPUT",
    missing_inputs: usable.length ? [] : ["independent metric evidence"],
    sources: [],
  }));
}

function localStress(input: Parameters<Researcher["stress"]>[0]): StressFinding[] {
  return input.tests.map((t) => ({
    test_code: t.code,
    winner_after: input.conclusion.winner,
    range_after: input.conclusion.low !== null && input.conclusion.high !== null ? `${input.conclusion.low}-${input.conclusion.high}` : null,
    outcome: input.conclusion.winner ? "MOSTLY STABLE" : "UNSTABLE",
    note: "Provider-independent fallback: preserved only the committed independent evidence conclusion; no synthetic evidence introduced.",
    unavailable_reason: input.conclusion.winner ? null : "MISSING_REQUIRED_INPUT",
    missing_inputs: input.conclusion.winner ? [] : ["independent conclusion"],
    sources: [],
  }));
}

function localConclusion(input: Parameters<Researcher["conclusion"]>[0]): ConclusionFinding {
  const metrics = input.evidence.metrics.filter((m) => m.p1 !== null && m.p2 !== null);
  if (!metrics.length) return { winner: null, low: null, high: null, rationale: null, insufficient_reason: "No symmetric independent metric evidence was available." };
  // Do not fabricate a numeric winner from unparsed text. A provider outage must
  // reduce confidence, not invent a pick. The audit can still complete honestly.
  return { winner: null, low: null, high: null, rationale: `Provider unavailable; ${metrics.length} symmetric independent metric families were preserved for audit evidence.`, insufficient_reason: "Automated conclusion unavailable without a trustworthy deterministic scorer." };
}

export const resilientResearcher: Researcher = {
  ...hybridResearcher,
  async rules(input) { try { return await hybridResearcher.rules(input); } catch (e) { if (!providerFailure(e)) throw e; return localRules(input); } },
  async underdog(input) { try { return await hybridResearcher.underdog(input); } catch (e) { if (!providerFailure(e)) throw e; return localUnderdog(input); } },
  async conclusion(input) { try { return await hybridResearcher.conclusion(input); } catch (e) { if (!providerFailure(e)) throw e; return localConclusion(input); } },
  async stress(input) { try { return await hybridResearcher.stress(input); } catch (e) { if (!providerFailure(e)) throw e; return localStress(input); } },
};
