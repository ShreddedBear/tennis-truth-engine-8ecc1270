export const METADATA_KEYS = ["tournament", "event_level", "round", "scheduled_date", "surface", "best_of"] as const;
export type MetadataKey = typeof METADATA_KEYS[number];
export type MetadataStatus = "VERIFIED" | "DERIVED" | "OCR" | "UNRESOLVED" | "AMBIGUOUS";
export interface MetadataProvenance {
  source: string | null;
  method: "LOCAL_REGISTRY" | "PERSISTED_MATCH" | "OCR" | "PROVIDER" | "COMPETITION_RULE" | "NONE";
  status: MetadataStatus;
  direct: boolean;
}
export type MetadataProvenanceMap = Record<MetadataKey, MetadataProvenance>;
export type MetadataFields = Record<string, string | null>;

const unknown = (): MetadataProvenance => ({ source: null, method: "NONE", status: "UNRESOLVED", direct: false });
export function emptyMetadataProvenance(): MetadataProvenanceMap {
  return { tournament: unknown(), event_level: unknown(), round: unknown(), scheduled_date: unknown(), surface: unknown(), best_of: unknown() };
}
export function normalizeMetadataText(value: string | null | undefined) {
  return String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function normalizedRound(value: string | null | undefined) {
  const n = normalizeMetadataText(value);
  if (/\bqf\b|quarter final/.test(n)) return "Quarterfinals";
  if (/\bsf\b|semi final/.test(n)) return "Semifinals";
  if (/\bfinal\b/.test(n) && !/semi/.test(n)) return "Final";
  const round = n.match(/\b(?:r|round(?: of)? )(16|32|64|128)\b/)?.[1];
  return round ? `Round of ${round}` : null;
}
type Event = { aliases: RegExp; name: string; surface: string; atpLevel?: string; wtaLevel?: string };
const EVENTS: Event[] = [
  { aliases: /wimbledon/, name: "Wimbledon", surface: "Grass", atpLevel: "Grand Slam", wtaLevel: "Grand Slam" },
  { aliases: /roland garros|french open/, name: "Roland Garros", surface: "Clay", atpLevel: "Grand Slam", wtaLevel: "Grand Slam" },
  { aliases: /\bus open\b/, name: "US Open", surface: "Hard", atpLevel: "Grand Slam", wtaLevel: "Grand Slam" },
  { aliases: /australian open/, name: "Australian Open", surface: "Hard", atpLevel: "Grand Slam", wtaLevel: "Grand Slam" },
  { aliases: /indian wells/, name: "Indian Wells", surface: "Hard", atpLevel: "Masters 1000", wtaLevel: "WTA 1000" },
  { aliases: /miami open/, name: "Miami Open", surface: "Hard", atpLevel: "Masters 1000", wtaLevel: "WTA 1000" },
  { aliases: /cincinn(?:ati|nati|atti)/, name: "Cincinnati Open", surface: "Hard", atpLevel: "Masters 1000", wtaLevel: "WTA 1000" },
  { aliases: /sao paulo/, name: "São Paulo Open", surface: "Hard", wtaLevel: "WTA 250" },
  { aliases: /palermo/, name: "Palermo Ladies Open", surface: "Clay", wtaLevel: "WTA 250" },
  { aliases: /eastbourne/, name: "Eastbourne International", surface: "Grass", atpLevel: "ATP 250", wtaLevel: "WTA 250" },
  { aliases: /doha|qatar/, name: "Qatar Open", surface: "Hard", wtaLevel: "WTA 1000" },
  { aliases: /buenos aires/, name: "Argentina Open", surface: "Clay", atpLevel: "ATP 250" },
];

export function resolveDeterministicMetadata(hints: MetadataFields, knownTour?: "ATP" | "WTA" | null) {
  const rawTournament = hints.tournament ?? hints.event ?? null;
  const n = normalizeMetadataText(rawTournament);
  const explicitTour = /\bwta\b/.test(n) ? "WTA" : /\batp\b/.test(n) ? "ATP" : null;
  const tour = explicitTour ?? knownTour ?? null;
  const matches = EVENTS.filter(event => event.aliases.test(n) && (!tour || (tour === "ATP" ? event.atpLevel : event.wtaLevel)));
  const provenance = emptyMetadataProvenance();
  const fields: MetadataFields = {
    tournament: null, event_level: null, round: normalizedRound(hints.round ?? rawTournament),
    scheduled_date: hints.scheduled_date ?? null, surface: null, best_of: null,
  };
  if (fields.round) provenance.round = { source: hints.round ? "OCR round field" : "OCR event label", method: "OCR", status: "OCR", direct: true };
  if (fields.scheduled_date) provenance.scheduled_date = { source: "OCR scheduled date", method: "OCR", status: "OCR", direct: true };
  if (matches.length !== 1) {
    if (matches.length > 1) provenance.tournament = { source: "canonical tournament registry", method: "LOCAL_REGISTRY", status: "AMBIGUOUS", direct: false };
    return { fields, provenance, tour };
  }
  const event = matches[0]!;
  fields.tournament = event.name;
  fields.surface = event.surface;
  fields.event_level = tour === "ATP" ? event.atpLevel ?? null : tour === "WTA" ? event.wtaLevel ?? null : event.atpLevel === event.wtaLevel ? event.atpLevel ?? null : null;
  const registry = { source: "canonical tournament registry", method: "LOCAL_REGISTRY", status: "VERIFIED", direct: true } as const;
  provenance.tournament = registry;
  provenance.surface = registry;
  if (fields.event_level) provenance.event_level = registry;
  const grandSlam = fields.event_level === "Grand Slam";
  if (tour) {
    fields.best_of = grandSlam && tour === "ATP" ? "5" : "3";
    provenance.best_of = { source: grandSlam ? "Grand Slam tour format rule" : "ATP/WTA tour format rule", method: "COMPETITION_RULE", status: "DERIVED", direct: false };
  }
  return { fields, provenance, tour };
}

export function parseBestOf(value: string | null | undefined): string | null {
  const match = String(value ?? "").match(/\b(?:(?:best\s*(?:of)?\s*)|bo)?([35])\b/i);
  return match?.[1] ?? null;
}