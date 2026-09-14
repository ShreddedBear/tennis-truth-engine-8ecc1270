import { afterEach, describe, expect, it, vi } from "vitest";
import { aiResearcher, resolveMatchIdentity } from "./audit-research.server";

const identityResponse = {
  player1_canonical: "Player One",
  player2_canonical: "Player Two",
  player1_status: "VERIFIED",
  player2_status: "VERIFIED",
  tournament: "Test Open",
  event_level: "ATP",
  round: "R16",
  scheduled_date: "2026-08-21",
  surface: "Hard",
  indoor: false,
  best_of: 3,
  surface_status: "VERIFIED",
  unresolved_reason: null,
  sources: [{ source_name: "fallback-source", url: "https://example.test", retrieved_at: "2026-08-21T00:00:00Z" }],
  conflicts: [],
};

function providerResponse(content: unknown = identityResponse): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }), { status: 200 });
}

const input = { p1: "Player One", p2: "Player Two", hints: {} };

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("research provider fallback", () => {
  it("uses the preferred provider when it succeeds", async () => {
    vi.stubEnv("RESEARCH_API_KEY", "primary-key");
    vi.stubEnv("RESEARCH_URL", "https://primary.test/v1");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(providerResponse());

    const result = await resolveMatchIdentity(input);

    expect(result.player1_canonical).toBe("Player One");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      headers: { "content-type": "application/json", Authorization: "Bearer primary-key" },
    }));
  });

  it.each([
    [402, "credits"],
    [429, "rate limit"],
  ])("uses fallback after primary HTTP %s", async (status) => {
    vi.stubEnv("RESEARCH_API_KEY", "primary-key");
    vi.stubEnv("RESEARCH_URL", "https://primary.test/v1");
    vi.stubEnv("RESEARCH_FALLBACK_URL", "https://fallback.test/v1");
    vi.stubEnv("RESEARCH_FALLBACK_API_KEY", "fallback-key");
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(status === 402 ? "credits" : "rate limit", { status }))
      .mockResolvedValueOnce(providerResponse());

    const result = await resolveMatchIdentity(input);

    expect(result.surface).toBe("Hard");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://fallback.test/v1/chat/completions");
  });

  it("uses fallback after timeout or malformed primary response", async () => {
    vi.stubEnv("RESEARCH_API_KEY", "primary-key");
    vi.stubEnv("RESEARCH_URL", "https://primary.test/v1");
    vi.stubEnv("RESEARCH_FALLBACK_URL", "https://fallback.test/v1");
    vi.stubEnv("RESEARCH_FALLBACK_API_KEY", "fallback-key");
    const timeout = new Error("request timed out");
    timeout.name = "AbortError";
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(timeout)
      .mockResolvedValueOnce(providerResponse());

    await expect(resolveMatchIdentity(input)).resolves.toMatchObject({ surface: "Hard" });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(providerResponse("not-json"));
    fetchMock.mockResolvedValueOnce(providerResponse());
    await expect(resolveMatchIdentity(input)).resolves.toMatchObject({ surface: "Hard" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("preserves partial fallback evidence instead of fabricating missing fields", async () => {
    vi.stubEnv("RESEARCH_FALLBACK_URL", "https://fallback.test/v1");
    vi.stubEnv("RESEARCH_FALLBACK_API_KEY", "fallback-key");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(providerResponse({
      ...identityResponse,
      surface: null,
      surface_status: "UNVERIFIED",
      sources: [{ source_name: "fallback-source", url: "https://example.test", retrieved_at: null }],
    }));

    const result = await resolveMatchIdentity(input);

    expect(result.surface).toBeNull();
    expect(result.surface_status).toBe("UNVERIFIED");
  });

  it("reports all-provider failure to the pipeline without inventing identity", async () => {
    vi.stubEnv("RESEARCH_API_KEY", "primary-key");
    vi.stubEnv("RESEARCH_URL", "https://primary.test/v1");
    vi.stubEnv("RESEARCH_FALLBACK_URL", "https://fallback.test/v1");
    vi.stubEnv("RESEARCH_FALLBACK_API_KEY", "fallback-key");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("down", { status: 503 }));

    await expect(resolveMatchIdentity(input)).rejects.toThrow("All research providers failed");
  });

  it("keeps the researcher contract available for metric fallback calls", async () => {
    vi.stubEnv("RESEARCH_API_KEY", "primary-key");
    vi.stubEnv("RESEARCH_URL", "https://primary.test/v1");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(providerResponse({ metrics: [] }));

    const result = await aiResearcher.metrics({ p1: input.p1, p2: input.p2, context: "", metrics: [], dossier: "" });

    expect(result).toEqual([]);
  });
});

describe("provider-specific model IDs and grounding", () => {
  it("sends the grounding tool only when the endpoint is configured as supporting it", async () => {
    // Grounding used to be hardcoded on for one vendor's gateway. It is configuration now,
    // so this is what keeps it working after that vendor was removed: an endpoint declared
    // grounded-capable still gets the google_search tool, with its own model ID.
    vi.stubEnv("RESEARCH_API_KEY", "primary-key");
    vi.stubEnv("RESEARCH_URL", "https://primary.test/v1");
    vi.stubEnv("RESEARCH_MODEL", "google/gemini-3-flash-preview");
    vi.stubEnv("RESEARCH_GROUNDED_SEARCH", "true");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(providerResponse());

    await resolveMatchIdentity(input);

    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://primary.test/v1/chat/completions");
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.model).toBe("google/gemini-3-flash-preview");
    expect(body.tools).toEqual([{ type: "google_search" }]);
  });

  it("omits the grounding tool when the endpoint is not declared grounded-capable", async () => {
    // The default. Sending google_search to a plain OpenAI-compatible endpoint is a
    // guaranteed 400 on every grounded call.
    vi.stubEnv("RESEARCH_API_KEY", "primary-key");
    vi.stubEnv("RESEARCH_URL", "https://primary.test/v1");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(providerResponse());

    await resolveMatchIdentity(input);

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.tools).toBeUndefined();
  });

  it("talks to OpenAI directly with a real OpenAI model ID and no other provider configured", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(providerResponse());

    const result = await resolveMatchIdentity(input);

    expect(result.player1_canonical).toBe("Player One");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.openai.com/v1/chat/completions");
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.model).toBe("gpt-4o-mini");
    // OpenAI's Chat Completions API has no "google_search" tool -- sending it
    // would be a guaranteed 400 on every grounded call. A grounded request
    // (resolveMatchIdentity's first pass always is) must never carry it unless the
    // endpoint was explicitly declared grounded-capable.
    expect(body.tools).toBeUndefined();
  });

  it("defaults an unset OPENAI_BASE_URL to api.openai.com, but honors an explicit override", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("OPENAI_BASE_URL", "https://my-proxy.internal/v1");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(providerResponse());

    await resolveMatchIdentity(input);

    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://my-proxy.internal/v1/chat/completions");
  });

  it("honors RESEARCH_FALLBACK_MODEL / OPENAI_MODEL overrides for the bearer provider", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("OPENAI_MODEL", "gpt-4.1-mini");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(providerResponse());

    await resolveMatchIdentity(input);

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.model).toBe("gpt-4.1-mini");
  });
});
