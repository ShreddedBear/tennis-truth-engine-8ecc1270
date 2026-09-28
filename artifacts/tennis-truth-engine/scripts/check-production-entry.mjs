import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

// Guards against production outages that both built "successfully":
//
// 1. Blank page with HTTP 200. Nitro silently adopts any `index.html` in the
//    project root as its production renderer template when no renderer is
//    configured. A leftover Vite-SPA index.html (pointing at a nonexistent
//    /src/main.tsx) therefore replaced TanStack Start's SSR output on every
//    route, so the browser received a valid-looking shell that never mounted.
//
// 2. Worker fails to boot. Nitro defaults the Cloudflare compatibility_date to
//    today's date, which can be newer than the locally installed workerd
//    binary supports ("This Worker requires compatibility date ..."). The
//    build script pins NITRO_COMPATIBILITY_DATE; this check keeps it pinned.

const root = process.cwd();
const failures = [];

if (existsSync(join(root, "index.html"))) {
  failures.push(
    "index.html exists in the Truth Engine root. Nitro will use it as the production renderer instead of TanStack Start SSR. Delete it; the document shell lives in src/routes/__root.tsx.",
  );
}

const CANDIDATE_SERVER_DIRS = [".output/server", "dist/server"];
const serverDir = CANDIDATE_SERVER_DIRS.map((dir) => join(root, dir)).find(
  (dir) => existsSync(dir),
);

if (!serverDir) {
  failures.push(
    `none of the expected server output directories exist (${CANDIDATE_SERVER_DIRS.join(", ")}). Did the build step run before this check?`,
  );
} else {
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return walk(path);
      return /\.(mjs|js)$/.test(entry.name) ? [path] : [];
    });

  for (const file of walk(serverDir)) {
    if (
      /renderer-template/.test(file) ||
      readFileSync(file, "utf8").includes("/src/main.tsx")
    ) {
      failures.push(
        `${file} contains a static HTML renderer template or a /src/main.tsx reference; production would serve a blank page.`,
      );
    }
  }

  // 3. Blank page with 404 assets. Vite emits asset URLs under BASE_PATH
  //    (/truth-engine/assets/...), so the Worker's static asset directory
  //    must contain them at that same path (nitro.baseURL in vite.config.ts).
  const basePath = (process.env.BASE_PATH ?? "/")
    .replace(/^\/*/, "/")
    .replace(/\/*$/, "/");
  const publicDir = join(serverDir, "..", "public");
  if (
    existsSync(publicDir) &&
    !existsSync(join(publicDir, basePath, "assets"))
  ) {
    failures.push(
      `${join(publicDir, basePath, "assets")} does not exist, but pages request client assets from ${basePath}assets/. Set nitro.baseURL to BASE_PATH.`,
    );
  }

  const wranglerPath = join(serverDir, "wrangler.json");
  if (existsSync(wranglerPath)) {
    const date = JSON.parse(
      readFileSync(wranglerPath, "utf8"),
    ).compatibility_date;
    const maxDate = installedWorkerdDate();
    if (!date) {
      failures.push(`${wranglerPath} has no compatibility_date.`);
    } else if (maxDate && date > maxDate) {
      failures.push(
        `${wranglerPath} compatibility_date ${date} is newer than the installed workerd release (${maxDate}); the Worker would refuse to start. Pin NITRO_COMPATIBILITY_DATE in the build script.`,
      );
    }
  }
}

// workerd versions are "1.YYYYMMDD.N"; the binary always supports its own
// release date, so that is a safe upper bound for compatibility_date.
function installedWorkerdDate() {
  try {
    const wranglerPkg = createRequire(join(root, "package.json")).resolve(
      "wrangler/package.json",
    );
    const { version } = createRequire(wranglerPkg)("workerd/package.json");
    const match = /^1\.(\d{4})(\d{2})(\d{2})/.exec(version);
    return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
  } catch {
    return null;
  }
}

if (failures.length) {
  console.error("Production entry check FAILED:");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  "Production entry check passed: TanStack Start SSR renderer, no stale index.html, assets under BASE_PATH, supported compatibility_date.",
);
