import { execSync } from "node:child_process";

import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

function resolveCommitSha() {
  const envSha =
    process.env.GITHUB_SHA ||
    process.env.REPL_SLUG_COMMIT ||
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

const rawPort = process.env.PORT;
const port = rawPort ? Number(rawPort) : undefined;
if (port !== undefined && (Number.isNaN(port) || port <= 0)) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

export default defineConfig({
  define: {
    __APP_BUILD_INFO__: JSON.stringify(appBuildInfo),
  },
  server: {
    host: "0.0.0.0",
    port,
    strictPort: true,
    allowedHosts: true,
    fs: { strict: false },
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      server: { entry: "server" },
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
    }),
    nitro({ preset: "node-server" }),
    viteReact(),
  ],
});