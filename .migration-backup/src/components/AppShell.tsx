import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  BarChart3,
  BookOpen,
  Database,
  FileText,
  Gauge,
  History,
  LayoutDashboard,
  ListChecks,
  ScrollText,
  Upload,
} from "lucide-react";

const NAV = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/upload", label: "Upload Summaries", icon: Upload },
  { to: "/app/slate", label: "Active Slate", icon: ListChecks },
  { to: "/app/board", label: "Master Ranked Board", icon: BarChart3 },
  { to: "/app/calibration", label: "Calibration", icon: Gauge },
  { to: "/app/calibration-history", label: "Calibration History", icon: History },
  { to: "/app/rules", label: "Rules / Knowledge Base", icon: BookOpen },
  { to: "/app/sources", label: "Sources", icon: Database },
  { to: "/app/logs", label: "Execution Logs", icon: ScrollText },
  { to: "/app/reports", label: "PDF Reports", icon: FileText },
];

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-header text-header-foreground">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-semibold tracking-wide uppercase">Tennis Matrix — Independent Verification & Audit</p>
            <p className="text-xs opacity-70">The Matrix may be compared to the audit. It may not determine the audit.</p>
          </div>
        </div>
      </header>
      <nav className="md:hidden overflow-x-auto border-b border-border bg-card">
        <ul className="flex w-max gap-1 px-2 py-2">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = path.startsWith(item.to);
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-xs transition-colors ${
                    active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  }`}
                >
                  <Icon className="size-3.5" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="mx-auto flex max-w-[1600px] gap-4 px-4 py-4">
        <nav className="hidden w-60 shrink-0 md:block">
          <ul className="panel sticky top-4 space-y-0.5 p-2">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = path.startsWith(item.to);
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                      active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    }`}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <main className="min-w-0 flex-1 pb-16">{children}</main>
      </div>
    </div>
  );
}
