import type { SourcedStat } from "./reconstruction/engine";
import { fetchPredixPublicEvidence, predixDossier, parsePredixDossier } from "./predixsport-public";

export async function publicEvidenceDossier(player: string): Promise<string> {
  const predix = await fetchPredixPublicEvidence(player);
  return predix ? predixDossier(predix) : "";
}

export function publicEvidenceStats(player: string, dossier: string, surface?: string | null): SourcedStat[] {
  const predix = parsePredixDossier(dossier);
  if (!predix) return [];
  const source = [{
    source_name: "PredixSport",
    url: predix.sourceUrl,
    retrieved_at: predix.retrievedAt,
  }];
  const out: SourcedStat[] = [];
  const push = (key: string, value: number | undefined, statSurface: string | null = null) => {
    if (!Number.isFinite(value)) return;
    out.push({
      key,
      player,
      value: value as number,
      surface: statSurface,
      window: "current",
      tour_level: null,
      sample: null,
      origin: "DIRECT",
      sources: source,
    });
  };

  // Overall Elo is valid public evidence but the current atomic catalog has no
  // general-Elo key. Surface Elo maps directly when a surface rating is published.
  const wanted = (surface ?? "").toLowerCase();
  if (wanted.includes("hard")) push("surface_elo", predix.hardElo, "Hard");
  else if (wanted.includes("clay")) push("surface_elo", predix.clayElo, "Clay");
  else if (wanted.includes("grass")) push("surface_elo", predix.grassElo, "Grass");

  return out;
}
