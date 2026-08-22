// Public tennis evidence adapter for PredixSport's CC BY 4.0 ATP/WTA rating pages.
// Source/license: https://www.predixsport.com/methodology
// The published Elo histories are free to reuse, including commercially, with attribution.
// This adapter uses only values explicitly present on a public player page. It never guesses.

export interface PredixPublicEvidence {
  player: string;
  tour: "ATP" | "WTA";
  sourceUrl: string;
  license: "CC BY 4.0";
  attribution: string;
  retrievedAt: string;
  elo?: number;
  glicko2?: number;
  ratingDeviation?: number;
  volatility?: number;
  hardElo?: number;
  clayElo?: number;
  grassElo?: number;
  formIndex?: number;
  recentText?: string;
}

function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function decodeHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function firstNumber(text: string, patterns: RegExp[]): number | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const value = Number(match[1]);
    if (Number.isFinite(value)) return value;
  }
  return undefined;
}

function parsePage(player: string, tour: "ATP" | "WTA", url: string, html: string): PredixPublicEvidence | null {
  const text = decodeHtml(html);
  if (!/CC BY 4\.0/i.test(text) || !/ELO/i.test(text)) return null;
  const retrievedAt = new Date().toISOString();
  const evidence: PredixPublicEvidence = {
    player,
    tour,
    sourceUrl: url,
    license: "CC BY 4.0",
    attribution: `Tennis ELO ratings by PredixSport (${tour}) — CC BY 4.0`,
    retrievedAt,
  };

  evidence.elo = firstNumber(text, [
    /(?:Current\s+)?ELO(?:\s+Rating)?\s*[:\-]?\s*(\d{3,4})/i,
    /ELO\s+(\d{3,4})/i,
  ]);
  evidence.glicko2 = firstNumber(text, [
    /Glicko-?2(?:\s+Rating)?\s*[:\-]?\s*(\d{3,4})/i,
    /Glicko-?2\s+(\d{3,4})/i,
  ]);
  evidence.ratingDeviation = firstNumber(text, [/(?:Rating\s+Deviation|\bRD\b)\s*[:\-]?\s*(\d+(?:\.\d+)?)/i]);
  evidence.volatility = firstNumber(text, [/Volatility\s*[:\-]?\s*(\d+(?:\.\d+)?)/i]);
  evidence.hardElo = firstNumber(text, [/Hard(?:\s+(?:Court|Surface))?(?:\s+ELO)?\s*[:\-]?\s*(\d{3,4})/i]);
  evidence.clayElo = firstNumber(text, [/Clay(?:\s+(?:Court|Surface))?(?:\s+ELO)?\s*[:\-]?\s*(\d{3,4})/i]);
  evidence.grassElo = firstNumber(text, [/Grass(?:\s+(?:Court|Surface))?(?:\s+ELO)?\s*[:\-]?\s*(\d{3,4})/i]);
  evidence.formIndex = firstNumber(text, [/Form(?:\s+Index)?\s*[:\-]?\s*(-?\d+(?:\.\d+)?)/i]);

  const recentAt = text.search(/Recent matches/i);
  if (recentAt >= 0) evidence.recentText = text.slice(recentAt, Math.min(text.length, recentAt + 7000));

  return evidence;
}

async function fetchTour(player: string, tour: "ATP" | "WTA"): Promise<PredixPublicEvidence | null> {
  const slug = slugify(player);
  const base = tour === "ATP"
    ? "https://www.predixsport.com/tennis-power-rankings/"
    : "https://www.predixsport.com/wta_tennis-power-rankings/";
  const url = `${base}${slug}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "TennisTruthEngine/1.0 (+public CC-BY data retrieval)" },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return parsePage(player, tour, url, await response.text());
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchPredixPublicEvidence(player: string): Promise<PredixPublicEvidence | null> {
  return (await fetchTour(player, "ATP")) ?? (await fetchTour(player, "WTA"));
}

export function predixDossier(evidence: PredixPublicEvidence): string {
  return `PREDIXSPORT_JSON:${JSON.stringify(evidence)}`;
}

export function parsePredixDossier(dossier: string): PredixPublicEvidence | null {
  const marker = "PREDIXSPORT_JSON:";
  const at = dossier.indexOf(marker);
  if (at < 0) return null;
  const tail = dossier.slice(at + marker.length).trim();
  try {
    const parsed = JSON.parse(tail) as PredixPublicEvidence;
    return parsed?.sourceUrl && parsed?.license === "CC BY 4.0" ? parsed : null;
  } catch {
    return null;
  }
}
