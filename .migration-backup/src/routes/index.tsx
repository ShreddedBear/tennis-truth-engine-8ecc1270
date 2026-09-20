import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ShieldCheck, Lock, ListChecks, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/app/upload" });
  },
  head: () => ({
    meta: [
      { title: "Tennis Matrix Independent Verification & Audit System" },
      {
        name: "description",
        content:
          "Deterministic tennis match audit engine: matrix firewall, symmetric P1/P2 metric sweeps, trap audits, stress tests and a calibration ledger that proves the work was done.",
      },
      { property: "og:title", content: "Tennis Matrix Independent Verification & Audit System" },
      {
        property: "og:description",
        content: "An audit engine, not a chatbot. No execution record = no completion.",
      },
    ],
  }),
  component: Landing,
});

const PILLARS = [
  { icon: Lock, title: "Matrix firewall", body: "The independent conclusion is committed and timestamped before any Matrix output is revealed." },
  { icon: ListChecks, title: "Symmetric sweeps", body: "Player 1 and Player 2 are processed for every applicable metric and audit rule, or the match cannot complete." },
  { icon: Gauge, title: "Live calibration", body: "Verified win rates recompute from the graded ledger. Yellow non-graded results advance the sequence only." },
  { icon: ShieldCheck, title: "Deterministic completion", body: "Application logic — never generated text — decides COMPLETE, GREEN or PASS." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-header text-header-foreground">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-sm font-semibold tracking-wide uppercase">Tennis Matrix Audit</span>
          <Button asChild variant="secondary" size="sm">
            <Link to="/app/dashboard">Open workspace</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-5xl">
          Independent verification & audit for every Tennis Matrix matchup.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          Upload the summary PDFs, run the full pipeline, and let the engine prove execution through persisted state.
          The Matrix may be compared to the audit — it may never determine it.
        </p>
        <div className="mt-8 flex gap-3">
          <Button asChild size="lg">
            <Link to="/app/dashboard">Open the audit engine</Link>
          </Button>
        </div>

        <section className="mt-16 grid gap-4 md:grid-cols-2">
          {PILLARS.map((p) => {
            const Icon = p.icon;
            return (
              <article key={p.title} className="panel p-5">
                <Icon className="size-5 text-primary" />
                <h2 className="mt-3 font-semibold">{p.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{p.body}</p>
              </article>
            );
          })}
        </section>

        <p className="mono-num mt-16 text-xs uppercase tracking-widest text-muted-foreground">
          No execution record = no completion.
        </p>
      </main>
    </div>
  );
}
