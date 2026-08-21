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
    vi.stubEnv("LOVABLE_API_KEY", "primary-key");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(providerResponse());

    const result = await resolveMatchIdentity(input);

    expect(result.player1_canonical).toBe("Player One");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      headers: { "content-type": "application/json", "Lovable-API-Key": "primary-key" },
    }));
  });

  it.each([
    [402, "credits"],
    [429, "rate limit"],
  ])("uses fallback after primary HTTP %s", async (status) => {
    vi.stubEnv("LOVABLE_API_KEY", "primary-key");
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
    vi.stubEnv("LOVABLE_API_KEY", "primary-key");
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
    vi.stubEnv("LOVABLE_API_KEY", "primary-key");
    vi.stubEnv("RESEARCH_FALLBACK_URL", "https://fallback.test/v1");
    vi.stubEnv("RESEARCH_FALLBACK_API_KEY", "fallback-key");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("down", { status: 503 }));

    await expect(resolveMatchIdentity(input)).rejects.toThrow("All research providers failed");
  });

  it("keeps the researcher contract available for metric fallback calls", async () => {
    vi.stubEnv("LOVABLE_API_KEY", "primary-key");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(providerResponse({ metrics: [] }));

    const result = await aiResearcher.metrics({ p1: input.p1, p2: input.p2, context: "", metrics: [], dossier: "" });

    expect(result).toEqual([]);
  });
});
