const GITHUB_OIDC_ISSUER = "https://token.actions.githubusercontent.com";
const EXPECTED_REPOSITORY = "dashawnkillzz-sketch/tennis-truth-engine";
const EXPECTED_AUDIENCE = "tennis-truth-engine-warehouse-ingestion";
const EXPECTED_WORKFLOW_REF = `${EXPECTED_REPOSITORY}/.github/workflows/historical-hard-pull.yml@refs/heads/main`;
const ALLOWED_EVENTS = new Set(["workflow_dispatch", "schedule", "push"]);

function decodeBase64Url(input: string): Uint8Array {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Uint8Array.from(Buffer.from(padded, "base64"));
}

function decodeJsonSegment<T>(segment: string): T {
  return JSON.parse(Buffer.from(decodeBase64Url(segment)).toString("utf8")) as T;
}

type JwtHeader = { alg?: string; kid?: string };
type GithubOidcClaims = {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  repository?: string;
  ref?: string;
  event_name?: string;
  workflow_ref?: string;
};

type Jwks = { keys?: JsonWebKey[] };

function audienceMatches(aud: string | string[] | undefined): boolean {
  return Array.isArray(aud) ? aud.includes(EXPECTED_AUDIENCE) : aud === EXPECTED_AUDIENCE;
}

export async function verifyGithubActionsOidc(token: string): Promise<GithubOidcClaims> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed GitHub OIDC token");

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJsonSegment<JwtHeader>(encodedHeader);
  const claims = decodeJsonSegment<GithubOidcClaims>(encodedPayload);

  if (header.alg !== "RS256" || !header.kid) throw new Error("Unsupported GitHub OIDC token header");
  if (claims.iss !== GITHUB_OIDC_ISSUER) throw new Error("Invalid GitHub OIDC issuer");
  if (!audienceMatches(claims.aud)) throw new Error("Invalid GitHub OIDC audience");
  if (claims.repository !== EXPECTED_REPOSITORY) throw new Error("Invalid GitHub OIDC repository");
  if (claims.ref !== "refs/heads/main") throw new Error("GitHub ingestion is restricted to main");
  if (claims.workflow_ref !== EXPECTED_WORKFLOW_REF) throw new Error("Invalid GitHub ingestion workflow");
  if (!claims.event_name || !ALLOWED_EVENTS.has(claims.event_name)) throw new Error("Unsupported GitHub ingestion event");

  const now = Math.floor(Date.now() / 1000);
  if (!claims.exp || claims.exp <= now) throw new Error("Expired GitHub OIDC token");
  if (claims.nbf && claims.nbf > now + 30) throw new Error("GitHub OIDC token is not active yet");

  const discovery = await fetch(`${GITHUB_OIDC_ISSUER}/.well-known/openid-configuration`);
  if (!discovery.ok) throw new Error(`Could not load GitHub OIDC discovery: ${discovery.status}`);
  const discoveryJson = (await discovery.json()) as { jwks_uri?: string };
  if (!discoveryJson.jwks_uri) throw new Error("GitHub OIDC discovery did not include jwks_uri");

  const jwksResponse = await fetch(discoveryJson.jwks_uri);
  if (!jwksResponse.ok) throw new Error(`Could not load GitHub OIDC keys: ${jwksResponse.status}`);
  const jwks = (await jwksResponse.json()) as Jwks;
  const jwk = jwks.keys?.find((key) => key.kid === header.kid);
  if (!jwk) throw new Error("GitHub OIDC signing key not found");

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const signingInput = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
  const signature = decodeBase64Url(encodedSignature);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, signingInput);
  if (!valid) throw new Error("Invalid GitHub OIDC signature");

  return claims;
}

export const GITHUB_INGESTION_OIDC_AUDIENCE = EXPECTED_AUDIENCE;
