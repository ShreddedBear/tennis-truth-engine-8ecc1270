import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Guards against a repeat of the outage where a statically-imported 46MB
// generated data file got inlined into the Cloudflare Worker bundle,
// growing it to ~82MB and crashing the Worker during global-scope module
// evaluation on every request (before the app's own error handling could
// even run). Keep these ceilings well above normal chunk sizes (the
// largest legitimate chunk today is pdfjs-dist at ~3MB) but far below
// Cloudflare's compressed script size limit.
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB per compiled chunk
const MAX_TOTAL_BYTES = 25 * 1024 * 1024; // 25MB across the whole server bundle

const serverDir = join(process.cwd(), '.output/server');

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path));
    else if (/\.(mjs|js)$/.test(entry.name)) out.push(path);
  }
  return out;
}

let files;
try {
  files = walk(serverDir);
} catch (error) {
  console.error(`Could not read ${serverDir}: ${error.message}`);
  process.exit(1);
}

let total = 0;
const oversized = [];
for (const file of files) {
  const size = statSync(file).size;
  total += size;
  if (size > MAX_FILE_BYTES) oversized.push([file, size]);
}

if (oversized.length) {
  console.error('Worker bundle check FAILED: oversized server chunk(s) found.');
  for (const [file, size] of oversized) {
    console.error(`  ${file}: ${(size / 1024 / 1024).toFixed(1)}MB (limit ${(MAX_FILE_BYTES / 1024 / 1024).toFixed(0)}MB)`);
  }
  console.error('This usually means a large generated/data file got statically imported into server code instead of being loaded from disk at runtime. See src/lib/runtime-tennis-index-data.server.ts for the pattern to follow.');
  process.exit(1);
}

if (total > MAX_TOTAL_BYTES) {
  console.error(`Worker bundle check FAILED: total server bundle is ${(total / 1024 / 1024).toFixed(1)}MB, exceeding the ${(MAX_TOTAL_BYTES / 1024 / 1024).toFixed(0)}MB limit.`);
  process.exit(1);
}

console.log(`Worker bundle check passed: ${(total / 1024 / 1024).toFixed(1)}MB across ${files.length} chunks (largest chunk limit ${(MAX_FILE_BYTES / 1024 / 1024).toFixed(0)}MB, total limit ${(MAX_TOTAL_BYTES / 1024 / 1024).toFixed(0)}MB).`);
