import type { Researcher } from "./audit-pipeline";
import { aiResearcher } from "./audit-research.server";
import { publicEvidenceDossier, publicEvidenceStats } from "./public-evidence";

// Provider-independent wrapper. AI remains first choice while configured, but a
// 402/timeout/auth failure no longer prevents us from collecting commercially
// reusable public evidence. No Matrix fields are exposed here.
export const hybridResearcher: Researcher = {
  identity: (input) => aiResearcher.identity(input),

  async dossier(input) {
    try {
      const ai = await aiResearcher.dossier?.(input);
      if (ai?.trim()) return ai;
    } catch {
      // Fall through to the public-data adapter.
    }
    return publicEvidenceDossier(input.player);
  },

  async extractStats(input) {
    // Deterministic extraction for our structured CC-BY dossier does not need
    // an AI call or Lovable credits.
    const direct = publicEvidenceStats(input.player, input.dossier, input.context.match(/surface\s+([^·]+)/i)?.[1]?.trim() ?? null);
    if (direct.length) return direct;
    try {
      return (await aiResearcher.extractStats?.(input)) ?? [];
    } catch {
      return [];
    }
  },

  // These stages still use AI when available. If unavailable, the orchestration
  // records the missing rows honestly while deterministic reconstruction keeps
  // everything supported by public raw evidence.
  metrics: (input) => aiResearcher.metrics(input),
  rules: (input) => aiResearcher.rules(input),
  underdog: (input) => aiResearcher.underdog(input),
  conclusion: (input) => aiResearcher.conclusion(input),
  stress: (input) => aiResearcher.stress(input),
};
