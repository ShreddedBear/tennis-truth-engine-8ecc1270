import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/app")({
  ssr: false,
  component: AppLayout,
});

function AppLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
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
