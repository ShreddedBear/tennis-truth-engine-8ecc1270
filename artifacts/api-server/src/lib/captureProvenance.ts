import { execSync } from "node:child_process";

/**
 * Reads the git SHA of the current worktree HEAD, live, at call time -- never hardcoded, never a
 * build-time constant that could go stale between a deploy and the code actually running. Used to
 * stamp every market_snapshots row (and, once approved, every Risk Floor observability column)
 * with the exact commit that produced it, so a reader can always trace a stored value back to the
 * code that computed it.
 *
 * Fails loud (throws) rather than silently writing a placeholder like "unknown" -- a capture row
 * with no real provenance is a data-quality bug, not a value worth defaulting.
 */
export function readCurrentCommit(cwd: string = process.cwd()): string {
  const sha = execSync("git rev-parse HEAD", { cwd, encoding: "utf8" }).trim();
  if (!/^[0-9a-f]{40}$/.test(sha)) {
    throw new Error(`readCurrentCommit: "git rev-parse HEAD" returned an unexpected value: "${sha}"`);
  }
  return sha;
}
