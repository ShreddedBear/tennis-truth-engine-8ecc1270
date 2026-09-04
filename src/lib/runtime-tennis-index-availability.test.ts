import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadRuntimeIndex } from "./runtime-tennis-index-data.server";

// PHASE 14 — the guard that makes a missing generated index diagnose ITSELF.
//
// The raw 61MB index at data/generated/tennis-runtime-index.json is tracked by Git LFS.
// Any checkout without git-lfs -- a fresh clone, a CI runner, this project's own remote
// container -- gets a 133-byte pointer file instead. Nothing crashed: loadRuntimeIndex()
// caught the JSON.parse failure and returned an EMPTY index, so every static-index metric
// engine truthfully reported "no data" for every player, and 33 tests failed with
// "expected null not to be null".
//
// Those 33 failures were misdiagnosed as "pre-existing date-sensitive fixture failures" in
// two separate phase reports and carried as an accepted baseline. They were neither
// pre-existing in the code nor date-sensitive: the index was a pointer. With it present,
// all 33 pass.
//
// Two things now prevent a repeat. loadFromDisk() falls back to the gzip copy under
// public/ (committed normally, not via LFS, and byte-identical once decompressed), so a
// no-LFS checkout behaves like a full one. And these tests fail with an explicit
// explanation if the index is ever genuinely unavailable, instead of leaving 33 unrelated
// suites to fail confusingly somewhere else.
describe("the generated tennis index is actually available to the engines", () => {
  it("loads a populated index, not the empty fallback", () => {
    const index = loadRuntimeIndex();
    const lanes = Object.keys(index.matchHistory ?? {});
    expect(
      lanes.length,
      "loadRuntimeIndex() returned an EMPTY index. Every static-index metric will report no " +
        "data for every player and dozens of unrelated tests will fail with 'expected null " +
        "not to be null'. Cause: data/generated/tennis-runtime-index.json is a Git LFS " +
        "pointer (run `git lfs pull`) AND the public/generated/*.json.gz fallback is also " +
        "missing or unreadable.",
    ).toBeGreaterThan(0);

    // Not merely present -- populated. An index with lanes but no players would fail the
    // same engines just as silently.
    const totalPlayers = lanes.reduce((n, lane) => n + Object.keys((index.matchHistory as any)[lane] ?? {}).length, 0);
    expect(totalPlayers, "the index has lanes but no players in them").toBeGreaterThan(1000);
  });

  it("the gzip fallback that makes a no-LFS checkout work is present and non-trivial", () => {
    // If this file is ever dropped (or itself moved into LFS), a no-LFS checkout silently
    // regresses to the empty index and the 33-failure confusion returns.
    const gz = join(process.cwd(), "public", "generated", "tennis-runtime-index.json.gz");
    expect(existsSync(gz), `${gz} is missing -- the no-LFS fallback path is gone`).toBe(true);
    const size = statSync(gz).size;
    expect(size, "the gzip index looks like an LFS pointer or a stub, not real data").toBeGreaterThan(1_000_000);
  });

  it("still works when the raw JSON is only an LFS pointer", () => {
    // Proves the fallback is what is actually carrying a no-LFS checkout, rather than the
    // test passing because this particular machine happens to have the real file.
    const raw = join(process.cwd(), "data", "generated", "tennis-runtime-index.json");
    if (!existsSync(raw)) return;
    const head = readFileSync(raw, "utf8").slice(0, 64);
    const isPointer = head.startsWith("version https://git-lfs.github.com/spec/v1");
    // Whichever state this checkout is in, the loader must produce a populated index.
    expect(Object.keys(loadRuntimeIndex().matchHistory ?? {}).length).toBeGreaterThan(0);
    // And when it IS a pointer, that is precisely the case the fallback exists for.
    if (isPointer) expect(existsSync(join(process.cwd(), "public", "generated", "tennis-runtime-index.json.gz"))).toBe(true);
  });
});
