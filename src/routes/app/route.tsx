import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { LOCAL_WORKSPACE_ID } from "@/lib/constants";

export const Route = createFileRoute("/app")({
  ssr: false,
  component: AppLayout,
});

function AppLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    ensureBootstrapped(LOCAL_WORKSPACE_ID).finally(() => setReady(true));
  }, []);

  return (
    <AppShell>
      {ready ? (
        <Outlet />
      ) : (
        <div className="panel p-6 text-sm text-muted-foreground">Loading rule documents and calibration…</div>
      )}
    </AppShell>
  );
}
