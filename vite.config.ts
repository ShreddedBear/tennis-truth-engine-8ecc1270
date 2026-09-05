/// <reference types="vitest/config" />
import { execSync } from "node:child_process";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

function resolveCommitSha() {
  const envSha =
    process.env.GITHUB_SHA ||
    process.env.CF_PAGES_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.SOURCE_VERSION ||
    process.env.COMMIT_SHA;

  if (envSha) return String(envSha).slice(0, 12);

  try {
    return execSync("git rev-parse --short=12 HEAD", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

const appBuildInfo = {
  commit: resolveCommitSha(),
  builtAt: new Date().toISOString(),
};

  export default defineConfig({
    vite: {
      // Several suites (the 013/014/030 producer fixes, the 043/044 underdog patterns, the
      // twin-match search) parse the ~80MB generated runtime tennis index inside the test
      // body. They complete in roughly 3-8s each, which sat close enough to vitest's 5s
      // default that adding any further parallel load made them time out at random --
      // reporting a red suite for a change that had nothing to do with them. The headroom is
      // for I/O-bound fixture loading only; no assertion or behaviour changes with it.
      test: {
        testTimeout: 30_000,
        hookTimeout: 30_000,
      },
      define: {
        __APP_BUILD_INFO__: JSON.stringify(appBuildInfo),
      },
      server: {
        host: "0.0.0.0",
        port: 5000,
        allowedHosts: true,
      },
   },
  
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
