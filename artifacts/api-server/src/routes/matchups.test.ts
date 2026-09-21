// Proves the "retry without re-OCR" contract for the screenshot pipeline:
// POST /matchups/from-text-names -- the endpoint the frontend's "RETRY
// LOOKUP" button (BulkMatchupPredictor.tsx) and "EDIT & RETRY FROM RAW
// TEXT" fallback both call -- resolves player identity from already-known
// names WITHOUT touching any OCR/vision-AI call path. Unlike the image
// pipeline, the PDF vision-tier's page-batch retry currently re-runs
// extraction for the whole file (see pdf-extract.functions.ts); that gap is
// intentionally NOT claimed complete here or anywhere else in this suite.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("POST /matchups/from-text-names never calls an OCR/vision-AI provider -- retry-without-re-OCR is real for the screenshot pipeline", () => {
  const source = readFileSync(new URL("./matchups.ts", import.meta.url), "utf8");
  const routeStart = source.indexOf('router.post("/matchups/from-text-names"');
  assert.ok(routeStart >= 0, "the /matchups/from-text-names route must exist");
  // Slice to the next top-level route declaration (or EOF) so this only inspects
  // THIS handler's body, not the whole file (which also imports screenshotImportService
  // for the unrelated /matchups/from-screenshot route).
  const nextRoute = source.indexOf("router.", routeStart + 1);
  const handlerBody = source.slice(routeStart, nextRoute >= 0 ? nextRoute : undefined);

  assert.match(handlerBody, /resolveScreenshotMatchup/, "must resolve identity through the real resolver");
  for (const forbidden of ["recognizeMatchupScreenshot", "screenshotImportService", "callOcrSpace", "importScreenshot"]) {
    assert.ok(
      !handlerBody.includes(forbidden),
      `/matchups/from-text-names must never call ${forbidden} -- that would re-run OCR on retry`,
    );
  }
});

test("screenshotMatchupResolver.ts (the shared resolver both /from-screenshot and /from-text-names use) never imports a vision/OCR provider as a value", () => {
  // Confirms at the import-graph level, not just this one route: the resolver
  // this test file's retry path calls cannot possibly trigger OCR, because
  // the module it's calling into has no OCR provider import to call.
  const source = readFileSync(new URL("../services/tennisData/screenshotMatchupResolver.ts", import.meta.url), "utf8");
  const valueImports = [...source.matchAll(/^import\s+(?!type\s)\{([^}]*)\}\s+from\s+"([^"]+)"/gm)];
  const ocrLikeImport = valueImports.find(([, , from]) => /screenshotRecognition|ocrSpaceProvider|screenshotImport\//.test(from));
  assert.equal(ocrLikeImport, undefined, "screenshotMatchupResolver.ts must not import an OCR/vision module as a VALUE (type-only imports are fine)");
});
