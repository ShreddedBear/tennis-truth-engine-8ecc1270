import { BUCKET_TOKEN } from "@/lib/constants";

const AUDIT_TOKEN: Record<string, string> = {
  "DOUBLE GREEN": "var(--double-green)",
  GREEN: "var(--green)",
  YELLOW: "var(--yellow)",
  "RED / PASS": "var(--red)",
  RED: "var(--red)",
  INCOMPLETE: "var(--incomplete)",
};

export function AuditColorBadge({ color }: { color: string }) {
  const bg = AUDIT_TOKEN[color] ?? "var(--incomplete)";
  const dark = color === "YELLOW";
  return (
    <span
      className="inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide"
      style={{ backgroundColor: bg, color: dark ? "var(--foreground)" : "var(--primary-foreground)" }}
    >
      {color}
    </span>
  );
}

export function BucketBadge({ code, children }: { code: string | null; children?: React.ReactNode }) {
  if (!code) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span
      className="mono-num inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: BUCKET_TOKEN[code] ?? "var(--muted)", color: "var(--primary-foreground)" }}
    >
      {children ?? code}
    </span>
  );
}

const STATE_CLASS: Record<string, string> = {
  COMPLETE: "text-ok",
  RUNNING: "text-primary",
  BLOCKED: "text-blocked",
  FAILED: "text-blocked",
  UNAVAILABLE: "text-warn",
  EXCLUDED: "text-muted-foreground",
  "NOT STARTED": "text-muted-foreground",
  "REQUIRES HUMAN REVIEW": "text-warn",
};

export function StateText({ state }: { state: string }) {
  return <span className={`text-xs font-medium ${STATE_CLASS[state] ?? "text-muted-foreground"}`}>{state}</span>;
}
