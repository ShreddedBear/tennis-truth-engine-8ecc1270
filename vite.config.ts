import { execSync } from "node:child_process";

import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

// This was `defineConfig` from @lovable.dev/vite-tanstack-config, a wrapper that assembled
// the plugin list below and defaulted Nitro to Cloudflare Workers. The plugins are the
// standard TanStack Start set and are now listed here directly, so the build depends on
// nothing Lovable-managed.
//
// Two things the wrapper did are deliberately NOT reproduced: its Lovable preview-asset
// proxy and sandbox devtools (they only ever activated inside Lovable's own sandbox), and
// its Cloudflare default preset -- see the nitro() call below.

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

export default defineConfig({
  define: {
    __APP_BUILD_INFO__: JSON.stringify(appBuildInfo),
  },
  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // Redirect TanStack Start's bundled server entry to src/start.ts (the SSR error
      // wrapper). Nitro builds from this.
      server: { entry: "server" },
      // Fail the build, rather than shipping it, if a module under a server directory or
      // anything marked server-only is reachable from the client graph. src/db's tests
      // assert the same boundary from the other side.
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
    }),
    // node-server, not cloudflare-module.
    //
    // The wrapper defaulted to Cloudflare Workers, which is why .replit launched the app
    // with `npx wrangler dev --config .output/server/wrangler.json`. Replit runs a Node
    // process, and the data layer now holds a PostgreSQL connection pool -- a long-lived
    // TCP socket, which a Workers runtime cannot keep. So the server build is a plain Node
    // server: `node .output/server/index.mjs`.
    nitro({ preset: "node-server" }),
    viteReact(),
  ],
});
