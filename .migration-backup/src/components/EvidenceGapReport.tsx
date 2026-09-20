import { buildEvidenceGap, evidenceGapSummary } from "@/lib/evidence-gap";

const order = ["MAPPING_OR_PROVENANCE","RECONSTRUCTABLE","SOURCE_REQUIRED","PUBLIC_CONTEXT","META_DERIVED","SPECIALIZED_DATA","SUPPORTED"];

export function EvidenceGapReport({ metrics, player1, player2 }: { metrics: any[]; player1: string; player2: string }) {
  const items=buildEvidenceGap(metrics);
  const summary=evidenceGapSummary(items);
  const unresolved=items.filter((x)=>x.classification!=="SUPPORTED");
  const grouped=order.map((key)=>[key,unresolved.filter((x)=>x.classification===key)] as const).filter(([,rows])=>rows.length);
  const player=(side:"P1"|"P2")=>side==="P1"?player1:player2;
  return (
    <section className="panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Evidence Gap Report</h2>
          <p className="text-xs text-muted-foreground">Metric-aware recovery plan. It does not change treatments or manufacture evidence.</p>
        </div>
        <div className="text-right text-xs">
          <p className="font-semibold">{summary.supported}/{summary.total} player-metric sides supported · {summary.supportedPercent}%</p>
          <p className="text-muted-foreground">{summary.unsupported} sides still need recovery or a truthful unavailable classification.</p>
        </div>
      </div>
      <div className="mt-3 grid gap-2 text-xs md:grid-cols-3 xl:grid-cols-6">
        {order.filter((k)=>k!=="SUPPORTED").map((key)=><div key={key} className="rounded-md border border-border p-2"><p className="text-muted-foreground">{key.replaceAll("_"," ")}</p><p className="mono-num font-semibold">{summary.counts[key]??0}</p></div>)}
      </div>
      <div className="mt-4 space-y-3">
        {grouped.map(([key,rows])=><details key={key} open={key==="MAPPING_OR_PROVENANCE"||key==="RECONSTRUCTABLE"} className="rounded-md border border-border p-3">
          <summary className="cursor-pointer font-semibold">{key.replaceAll("_"," ")} · {rows.length}</summary>
          <div className="mt-2 overflow-auto">
            <table className="w-full min-w-[760px] text-xs">
              <thead className="bg-muted"><tr className="text-left"><th className="p-2">Metric</th><th className="p-2">Player</th><th className="p-2">Treatment</th><th className="p-2">Required data</th><th className="p-2">Why / next recovery target</th></tr></thead>
              <tbody>{rows.map((row,index)=><tr key={`${row.code}-${row.side}-${index}`} className="border-t border-border"><td className="p-2 align-top"><span className="mono-num">{row.code}</span> · {row.metricName}</td><td className="p-2 align-top">{player(row.side)}</td><td className="p-2 align-top">{row.treatment}</td><td className="p-2 align-top">{row.requiredData}</td><td className="p-2 align-top">{row.reason}</td></tr>)}</tbody>
            </table>
          </div>
        </details>)}
      </div>
    </section>
  );
}
