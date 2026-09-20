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

const port = Number(process.env.PORT ?? 5000);

if (!Number.isFinite(port) || port <= 0) {
  throw new Error(`Invalid PORT value: ${process.env.PORT}`);
}

  export default defineConfig({
    vite: {
      define: {
        __APP_BUILD_INFO__: JSON.stringify(appBuildInfo),
      },
      optimizeDeps: {
        entries: ["src/**/*.{ts,tsx}"],
      },
      server: {
        host: "0.0.0.0",
        port,
        strictPort: true,
        allowedHosts: true,
        watch: {
          ignored: ["**/.cache/**", "**/.local/**", "**/attached_assets/**"],
        },
      },
   },
  
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
