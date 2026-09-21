// Reconstructs column-separated table cells from Tesseract's flat per-line
// OCR text using each word's bounding box.
//
// Discovered via real-fixture validation (not assumed): parseSummaryText's
// no-"vs" table heuristic expects one cell per line (matching how the
// hand-transcribed regression fixture was written), but real Tesseract
// output for an actual table-formatted screenshot puts an entire physical
// row -- row number, player 1, player 2, and round/event text -- on ONE
// line, because that's how the row is laid out visually in the source
// image. Confirmed on the real "Truth Engine OCR Verification" reference
// PNGs (attached_assets/): Tesseract read
//   "1 Lucie Havlickova Ekaterine Gorgodze Round of 16"
// as a single line, and parseSummaryText -- which requires each candidate
// name to be its OWN line with nothing else on it -- extracted 0 of that
// page's 6 matches from it. Real OCR accuracy was excellent (only a single
// "Anastasiia" -> "Anastasia" character slip across all 4 pages); the loss
// was entirely a text-layout mismatch downstream of OCR, not an OCR
// failure -- exactly the "OCR succeeded but the match still vanished"
// failure shape this whole effort is about, just one layer earlier than
// the player-lookup timeout this branch started by fixing.
//
// The fix: within-word-group gaps (letters/words of the SAME name or
// phrase) are small and fairly uniform; a genuine column boundary in a
// printed/rendered table is dramatically wider (empirically 175-200px vs.
// 6-36px on the real fixture, a 5x+ margin) because the columns are laid
// out with generous padding. A gap that clears a page-wide baseline,
// computed from the page's own OTHER inter-word gaps (so it scales with
// whatever render resolution pdf-ocr.ts chose for this document, not a
// fixed pixel count), is treated as a cell boundary and becomes a newline.

export interface OcrWordBox {
  text: string;
  x0: number;
  x1: number;
}

export interface OcrLineBox {
  text: string;
  words: OcrWordBox[];
}

const MIN_GAP_SAMPLES_FOR_BASELINE = 3;
// Used only when the page has too few multi-word lines to compute its own
// baseline (e.g. a one-line page) -- a generous flat fallback, well above
// ordinary word spacing at any common render scale.
const FALLBACK_ABSOLUTE_THRESHOLD_PX = 80;
const BASELINE_MULTIPLIER = 4;

function gapsForLine(line: OcrLineBox): number[] {
  const gaps: number[] = [];
  for (let i = 1; i < line.words.length; i++) {
    gaps.push(line.words[i]!.x0 - line.words[i - 1]!.x1);
  }
  return gaps;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/**
 * Computes a page-wide "normal word gap" baseline from every line's inter-word
 * gaps, then splits any line whose gaps clear BASELINE_MULTIPLIER times that
 * baseline into one cell per line. Lines with no such gap pass through
 * unchanged (this never affects ordinary running text -- headers, subtitles,
 * single-name lines -- where no gap is anomalous).
 */
export function reconstructTableAwareText(lines: OcrLineBox[]): string {
  const allGaps = lines.flatMap(gapsForLine).filter((g) => g > 0);
  const baseline = allGaps.length >= MIN_GAP_SAMPLES_FOR_BASELINE
    ? Math.max(median(allGaps), 1)
    : null;
  const threshold = baseline !== null ? baseline * BASELINE_MULTIPLIER : FALLBACK_ABSOLUTE_THRESHOLD_PX;

  const outLines: string[] = [];
  for (const line of lines) {
    if (line.words.length < 2) {
      const t = line.text.trim();
      if (t) outLines.push(t);
      continue;
    }
    const cells: string[] = [];
    let current: string[] = [line.words[0]!.text];
    for (let i = 1; i < line.words.length; i++) {
      const gap = line.words[i]!.x0 - line.words[i - 1]!.x1;
      if (gap > threshold) {
        cells.push(current.join(" "));
        current = [line.words[i]!.text];
      } else {
        current.push(line.words[i]!.text);
      }
    }
    cells.push(current.join(" "));

    if (cells.length > 1) outLines.push(...cells.map((c) => c.trim()).filter(Boolean));
    else {
      const t = line.text.trim();
      if (t) outLines.push(t);
    }
  }
  return outLines.join("\n");
}
