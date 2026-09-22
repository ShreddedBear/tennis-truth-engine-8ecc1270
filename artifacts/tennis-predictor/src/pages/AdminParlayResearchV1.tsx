import { type ReactElement, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "wouter"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertTriangle, FlaskConical } from "lucide-react"

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")
const api = (path: string) => `${BASE}${path}`

// ── Types (mirror the API's label + disclaimer contract) ──────────────────────

interface ResearchRun {
  runId: string
  researchBuilderVersion: string
  configFingerprint: string
  cohortStart: string
  cohortEnd: string
  cohortFingerprint: string
  cohortMatchCount: number
  status: string
  decisionsFrozenAt: string | null
  outcomesAttachedAt: string | null
  deterministicMatch: boolean | null
  resultSetFingerprint: string | null
  summary: Record<string, unknown> | null
}

interface ResearchResult {
  historicalMatchId: number
  scheduledStartAt: string
  player1Name: string
  player2Name: string
  surface: string | null
  builderScore: number | null
  builderDecision: string | null
  eligibility: string
  rejectionReason: string | null
  pitStatus: string
  outcomeActualWinnerId: string | null
  outcomeCorrect: boolean | null
}

// ── The one banner every research view carries, never omitted ─────────────────

function ResearchDisclaimerBanner(): ReactElement {
  return (
    <Alert className="border-amber-500/50 bg-amber-500/10">
      <FlaskConical className="h-4 w-4" />
      <AlertTitle className="font-mono">COUNTERFACTUAL_RESEARCH_V1</AlertTitle>
      <AlertDescription>
        This is a counterfactual research backtest, not a record of the production Parlay Builder's
        historical decisions. The production Builder did not exist during the cohort period — see
        docs/historical-builder-integration/ for the evidence. These results answer a different
        question: what would an independent, point-in-time-safe scoring layer have said, using only
        information available before each match's cutoff and never fit on this cohort?
      </AlertDescription>
    </Alert>
  )
}

function DecisionBadge({ decision }: { decision: string | null }): ReactElement {
  if (!decision) return <Badge variant="outline">—</Badge>
  const variant = decision === "KEEP" ? "default" : decision === "REMOVE" ? "destructive" : "secondary"
  return <Badge variant={variant}>{decision}</Badge>
}

export default function AdminParlayResearchV1(): ReactElement {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)

  const { data: runsData, isLoading: runsLoading } = useQuery<{ runs: ResearchRun[] }>({
    queryKey: ["research-v1-runs"],
    queryFn: async () => {
      const r = await fetch(api("/api/admin/parlay/research-v1/runs"), { credentials: "include" })
      if (!r.ok) throw new Error("Failed to load research runs")
      return r.json()
    },
  })

  const { data: resultsData, isLoading: resultsLoading } = useQuery<{ results: ResearchResult[]; count: number }>({
    queryKey: ["research-v1-results", selectedRunId],
    queryFn: async () => {
      const r = await fetch(api(`/api/admin/parlay/research-v1/runs/${selectedRunId}/results?limit=200`), { credentials: "include" })
      if (!r.ok) throw new Error("Failed to load research results")
      return r.json()
    },
    enabled: selectedRunId != null,
  })

  const selectedRun = runsData?.runs.find((r) => r.runId === selectedRunId) ?? null

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FlaskConical className="h-6 w-6" />
          Parlay Builder Research
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Isolated from{" "}
          <Link href="/admin/parlay-builder" className="underline">
            production Parlay Builder
          </Link>{" "}
          history and decisions.
        </p>
      </div>

      <ResearchDisclaimerBanner />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Research Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {runsLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !runsData?.runs.length ? (
            <p className="text-sm text-muted-foreground">
              No research runs yet. Run{" "}
              <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
                src/scripts/runParlayBuilderResearchV1Backtest.ts
              </code>{" "}
              to produce one.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run ID</TableHead>
                  <TableHead>Cohort</TableHead>
                  <TableHead>Matches</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Deterministic</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runsData.runs.map((run) => (
                  <TableRow
                    key={run.runId}
                    className={`cursor-pointer ${selectedRunId === run.runId ? "bg-muted" : ""}`}
                    onClick={() => setSelectedRunId(run.runId)}
                  >
                    <TableCell className="font-mono text-xs">{run.runId}</TableCell>
                    <TableCell className="text-xs">
                      {new Date(run.cohortStart).toISOString().slice(0, 10)} – {new Date(run.cohortEnd).toISOString().slice(0, 10)}
                    </TableCell>
                    <TableCell>{run.cohortMatchCount}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{run.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {run.deterministicMatch == null ? (
                        "—"
                      ) : run.deterministicMatch ? (
                        <Badge>Match</Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" /> Mismatch
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedRun && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-mono">{selectedRun.runId}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 font-mono text-xs">
              <div>
                <div className="text-muted-foreground">Config fingerprint</div>
                <div className="truncate">{selectedRun.configFingerprint}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Cohort fingerprint</div>
                <div className="truncate">{selectedRun.cohortFingerprint}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Result-set fingerprint</div>
                <div className="truncate">{selectedRun.resultSetFingerprint ?? "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Decisions frozen</div>
                <div>{selectedRun.decisionsFrozenAt ? new Date(selectedRun.decisionsFrozenAt).toISOString() : "—"}</div>
              </div>
            </div>
            {selectedRun.summary != null && (
              <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto">{JSON.stringify(selectedRun.summary, null, 2)}</pre>
            )}
          </CardContent>
        </Card>
      )}

      {selectedRunId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Match-level results (first 200)</CardTitle>
          </CardHeader>
          <CardContent>
            {resultsLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Match</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Decision</TableHead>
                    <TableHead>Eligibility</TableHead>
                    <TableHead>PIT</TableHead>
                    <TableHead>Correct</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultsData?.results.map((r) => (
                    <TableRow key={r.historicalMatchId}>
                      <TableCell className="text-xs">{new Date(r.scheduledStartAt).toISOString().slice(0, 10)}</TableCell>
                      <TableCell className="text-xs">
                        {r.player1Name} vs {r.player2Name}
                        {r.surface ? ` (${r.surface})` : ""}
                      </TableCell>
                      <TableCell>{r.builderScore ?? "—"}</TableCell>
                      <TableCell>
                        <DecisionBadge decision={r.builderDecision} />
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.eligibility === "ELIGIBLE" ? "outline" : "secondary"}>{r.eligibility}</Badge>
                        {r.rejectionReason && <div className="text-[10px] text-muted-foreground mt-0.5">{r.rejectionReason}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.pitStatus === "VALID_PIT" ? "outline" : "destructive"}>{r.pitStatus}</Badge>
                      </TableCell>
                      <TableCell>
                        {r.outcomeCorrect == null ? "—" : r.outcomeCorrect ? <Badge>✓</Badge> : <Badge variant="destructive">✗</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
