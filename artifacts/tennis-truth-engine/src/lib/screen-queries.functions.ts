// Browser-callable entry points for the application screens.
//
// Module scope stays free of server-only imports: this file ships to the client bundle and
// only the .handler() bodies are stripped from it, so the server module is reached with a
// dynamic import inside each handler.
//
// These are reads, with one exception (resolveConflict). They are POST server functions
// because that is the idiom every other *.functions.ts here uses and what start.ts's CSRF
// middleware is written against -- and because the point is not the verb: the browser can
// ask for a screen's data, but it cannot say which table, which columns, or which rows.
import { createServerFn } from "@tanstack/react-start";

export const fetchLogsScreen = createServerFn({ method: "POST" }).handler(async () => {
  const { loadLogsScreen } = await import("./screen-queries.server");
  return loadLogsScreen();
});

export const fetchSourcesScreen = createServerFn({ method: "POST" }).handler(async () => {
  const { loadSourcesScreen } = await import("./screen-queries.server");
  return loadSourcesScreen();
});

export const resolveConflict = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; resolution: string }) => {
    const id = String(data?.id ?? "").trim();
    const resolution = String(data?.resolution ?? "").trim();
    if (!id) throw new Error("A conflict id is required.");
    // The screen offers exactly these two. Pinning them here means the browser cannot
    // write an arbitrary status into the conflict ledger.
    if (!["RESOLVED", "UNRESOLVED"].includes(resolution)) {
      throw new Error(`Unsupported conflict resolution "${resolution}".`);
    }
    return { id, resolution };
  })
  .handler(async ({ data }) => {
    const { resolveSourceConflict } = await import("./screen-queries.server");
    await resolveSourceConflict(data.id, data.resolution);
    return { ok: true as const };
  });

export const fetchRulesScreen = createServerFn({ method: "POST" }).handler(async () => {
  const { loadRulesScreen } = await import("./screen-queries.server");
  return loadRulesScreen();
});

export const fetchCalibrationHistoryScreen = createServerFn({ method: "POST" }).handler(async () => {
  const { loadCalibrationHistoryScreen } = await import("./screen-queries.server");
  return loadCalibrationHistoryScreen();
});

export const fetchCalibrationScreen = createServerFn({ method: "POST" }).handler(async () => {
  const { loadCalibrationScreen } = await import("./screen-queries.server");
  return loadCalibrationScreen();
});

export const fetchDashboardScreen = createServerFn({ method: "POST" }).handler(async () => {
  const { loadDashboardScreen } = await import("./screen-queries.server");
  return loadDashboardScreen();
});

export const fetchBoardScreen = createServerFn({ method: "POST" }).handler(async () => {
  const { loadBoardScreen } = await import("./screen-queries.server");
  return loadBoardScreen();
});

export const fetchSlateBase = createServerFn({ method: "POST" }).handler(async () => {
  const { loadSlateBase } = await import("./screen-queries.server");
  return loadSlateBase();
});

export const fetchSlateRunDetail = createServerFn({ method: "POST" })
  .inputValidator((data: { runIds: string[] }) => {
    const runIds = Array.isArray(data?.runIds) ? data.runIds.map(String).filter(Boolean) : [];
    return { runIds };
  })
  .handler(async ({ data }) => {
    const { loadSlateRunDetail } = await import("./screen-queries.server");
    return loadSlateRunDetail(data.runIds);
  });
