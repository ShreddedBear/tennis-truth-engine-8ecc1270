import test from "node:test";
import assert from "node:assert/strict";
import {
  buildUnresolvedRecognitionResult,
  ScreenshotResolutionTimeoutError,
  withScreenshotResolutionDeadline,
} from "./ScreenshotImportService";

test("player-resolution deadline rejects a stalled lookup instead of hanging forever", async () => {
  const neverSettles = new Promise<never>(() => {});

  await assert.rejects(
    withScreenshotResolutionDeadline(neverSettles, 10),
    (error) => error instanceof ScreenshotResolutionTimeoutError,
  );
});

test("degraded player resolution preserves every OCR-read name and inferred event metadata", () => {
  const warning = "Player lookup timed out.";
  const result = buildUnresolvedRecognitionResult(
    {
      matchups: [
        { player1Name: "Coco Gauff", player2Name: "Iga Swiatek", eventName: "US Open" },
        { player1Name: "Aryna Sabalenka", player2Name: "Jessica Pegula", eventName: "US Open" },
      ],
    },
    warning,
  );

  assert.equal(result.player1.recognizedName, "Coco Gauff");
  assert.equal(result.player2.recognizedName, "Iga Swiatek");
  assert.equal(result.event.recognizedName, "US Open");
  assert.equal(result.event.surface, "Hard");
  assert.equal(result.matchups?.length, 2);
  assert.deepEqual(
    result.matchups?.map((entry) => [entry.player1.recognizedName, entry.player2.recognizedName]),
    [
      ["Coco Gauff", "Iga Swiatek"],
      ["Aryna Sabalenka", "Jessica Pegula"],
    ],
  );
  assert.ok(result.matchups?.every((entry) => entry.resolved === false));
  assert.deepEqual(result.warnings, [warning]);
});