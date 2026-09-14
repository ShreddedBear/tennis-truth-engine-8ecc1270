import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";

// Regression coverage for the real production outage this file fixes: Cloudflare
// Workers have no filesystem at request time, so readFileSync never succeeds there --
// confirmed live via the evidence-coverage diagnostic's runtime_index_status reporting
// loaded:false with every player count at 0, unchanged across multiple deploys and
// unaffected by PR #74's separate (also real, but insufficient on its own) fix for
// permanently caching a failed read. The fix under test here: fall back to fetching the
// generated index over the Cloudflare Workers ASSETS binding when the disk read fails,
// via a new ensureRuntimeIndexLoaded() pre-warm step called once before any request
// handler runs (see src/server.ts). loadRuntimeIndex() itself must stay synchronous --
// there are several existing call sites across the app that must not need to become
// async.
//
// The asset fetched over the ASSETS binding is gzip-compressed (~5.2MB) rather than the
// raw ~61MB JSON: Cloudflare Workers hard-rejects any individual static asset over 25 MiB
// at deploy time, which was the actual reason this fix stayed broken in production even
// after the ASSETS-binding fallback itself was added -- the raw file could never deploy
// as a static asset in the first place. Tests here serve a real gzip body via
// DecompressionStream/CompressionStream (both standard Web Streams APIs, no extra
// dependency) so the round trip is exercised for real, not mocked away.
//
// Each test resets modules and re-mocks node:fs so the module-scope cache never leaks
// between tests.
async function freshModule(readFileSyncImpl: (path: unknown) => string) {
  vi.resetModules();
  vi.doMock("node:fs", () => ({ readFileSync: vi.fn(readFileSyncImpl) }));
  return import("./runtime-tennis-index-data.server");
}

const REAL_INDEX = { generatedAt: "2026-01-01T00:00:00Z", ATP: { "a b": {} }, WTA: {}, matchHistory: { ATP_MAIN: {}, WTA_MAIN: {}, ATP_CHALLENGER: {}, WTA_CHALLENGER: {} } };

function gzipResponse(payload: unknown, status = 200) {
  return new Response(gzipSync(JSON.stringify(payload)), { status });
}

afterEach(() => {
  vi.doUnmock("node:fs");
  vi.resetModules();
});

describe("runtime-tennis-index-data.server", () => {
  it("loadRuntimeIndex() reads from disk when the file is present (local/Node dev path, unchanged)", async () => {
    const mod = await freshModule(() => JSON.stringify(REAL_INDEX));
    expect(mod.loadRuntimeIndex()).toEqual(REAL_INDEX);
  });

  it("loadRuntimeIndex() fails closed to an empty index when disk read fails and nothing has warmed the cache", async () => {
    const mod = await freshModule(() => { throw new Error("ENOENT"); });
    const result = mod.loadRuntimeIndex();
    expect(result.generatedAt).toBe("");
    expect(result.ATP).toEqual({});
    expect(result.matchHistory.WTA_MAIN).toEqual({});
  });

  it("ensureRuntimeIndexLoaded() with a working disk read populates the cache without needing the ASSETS binding", async () => {
    const mod = await freshModule(() => JSON.stringify(REAL_INDEX));
    await mod.ensureRuntimeIndexLoaded(undefined);
    expect(mod.loadRuntimeIndex()).toEqual(REAL_INDEX);
  });

  it("bug fix: ensureRuntimeIndexLoaded() falls back to the Cloudflare Workers ASSETS binding when the disk read fails, decompresses the gzip asset, and the synchronous loadRuntimeIndex() sees the result afterward", async () => {
    const mod = await freshModule(() => { throw new Error("ENOENT: no such file"); });
    const fetchMock = vi.fn(async (request: Request) => {
      expect(request.url).toContain("/generated/tennis-runtime-index.json.gz");
      return gzipResponse(REAL_INDEX);
    });
    await mod.ensureRuntimeIndexLoaded({ fetch: fetchMock });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mod.loadRuntimeIndex()).toEqual(REAL_INDEX);
  });

  it("ensureRuntimeIndexLoaded() only calls the ASSETS binding once, even across repeated calls (module-scope cache short-circuits)", async () => {
    const mod = await freshModule(() => { throw new Error("ENOENT"); });
    const fetchMock = vi.fn(async () => gzipResponse(REAL_INDEX));
    await mod.ensureRuntimeIndexLoaded({ fetch: fetchMock });
    await mod.ensureRuntimeIndexLoaded({ fetch: fetchMock });
    await mod.ensureRuntimeIndexLoaded({ fetch: fetchMock });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fails closed (not fabricated data) when the ASSETS binding returns a non-ok response", async () => {
    const mod = await freshModule(() => { throw new Error("ENOENT"); });
    await mod.ensureRuntimeIndexLoaded({ fetch: async () => new Response("not found", { status: 404 }) });
    const result = mod.loadRuntimeIndex();
    expect(result.generatedAt).toBe("");
  });

  it("fails closed when the ASSETS binding returns an ok response whose body isn't valid gzip (never fabricates data from a decompression failure)", async () => {
    const mod = await freshModule(() => { throw new Error("ENOENT"); });
    await mod.ensureRuntimeIndexLoaded({ fetch: async () => new Response("not actually gzip", { status: 200 }) });
    const result = mod.loadRuntimeIndex();
    expect(result.generatedAt).toBe("");
  });

  it("fails closed when the ASSETS binding itself throws (e.g. not bound in this environment)", async () => {
    const mod = await freshModule(() => { throw new Error("ENOENT"); });
    await mod.ensureRuntimeIndexLoaded({ fetch: async () => { throw new Error("binding not configured"); } });
    const result = mod.loadRuntimeIndex();
    expect(result.generatedAt).toBe("");
  });

  it("fails closed when no ASSETS binding is passed at all and disk also fails", async () => {
    const mod = await freshModule(() => { throw new Error("ENOENT"); });
    await mod.ensureRuntimeIndexLoaded(undefined);
    const result = mod.loadRuntimeIndex();
    expect(result.generatedAt).toBe("");
  });
});
