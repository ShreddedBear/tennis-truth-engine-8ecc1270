import { describe, expect, it } from "vitest";
import { classifyPbpFetchFailure as challengerClassify } from "./bsd-atp-challenger-pbp.server";
import { classifyPbpFetchFailure as atpMainClassify } from "./bsd-atp-main-pbp.server";
import { classifyPbpFetchFailure as wtaMainClassify } from "./bsd-wta-main-pbp.server";

// Live production finding: every real fetchPbp() call against the BSD/Bzzoiro API returned
// HTTP 402 (payment/credits required), for every one of the 002/003/009/018/032 coverage-gap
// matches -- but the old fetchPbp() silently collapsed ANY failure (missing key, 402, 429,
// network error, malformed JSON) into a bare `return null`, indistinguishable from "this
// match genuinely has no point-by-point record". These tests lock in that a real producer
// failure is now classified as exactly that, never as a data absence.
const IMPLEMENTATIONS: Array<[string, typeof challengerClassify]> = [
  ["bsd-atp-challenger-pbp.server.ts", challengerClassify],
  ["bsd-atp-main-pbp.server.ts", atpMainClassify],
  ["bsd-wta-main-pbp.server.ts", wtaMainClassify],
];

describe.each(IMPLEMENTATIONS)("%s classifyPbpFetchFailure", (_name, classify) => {
  it("classifies HTTP 402 as a billing failure, explicitly not a data absence", () => {
    const reason = classify({ status: 402 });
    expect(reason).toContain("402");
    expect(reason.toLowerCase()).toContain("payment");
    expect(reason.toLowerCase()).not.toContain("no data");
  });

  it("classifies HTTP 401/403 as an auth failure", () => {
    expect(classify({ status: 401 })).toMatch(/401/);
    expect(classify({ status: 403 })).toMatch(/403/);
  });

  it("classifies HTTP 429 as rate limiting", () => {
    expect(classify({ status: 429 }).toLowerCase()).toContain("rate limit");
  });

  it("classifies a network/timeout error using its own message", () => {
    expect(classify({ networkError: "The operation was aborted due to timeout" })).toContain("The operation was aborted due to timeout");
  });

  it("classifies a JSON parse failure distinctly from a 402/network failure", () => {
    const reason = classify({ parseError: true });
    expect(reason.toLowerCase()).toContain("json");
    expect(reason).not.toContain("402");
  });

  it("classifies the provider's own available:false as its own distinct case", () => {
    const reason = classify({ availableFalse: true });
    expect(reason.toLowerCase()).toContain("unavailable");
  });
});
