import { type ReactElement, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "wouter"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Select } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Target, ArrowLeft, ShieldAlert, ChevronLeft, ChevronRight } from "lucide-react"

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")
const api = (path: string) => `${BASE}${path}`

// ── Types (mirror artifacts/api-server's adminShaping.ts response shapes) ──────

interface SideSummary {
  evaluatedSide: "PLAYER_1" | "PLAYER_2"
  selectedPlayerId: string
  selectedPlayerName: string
  decision: string | null
  selectedPlayerScore: number | null
  selectedPlayerRiskScore: number | null
}

interface PairSummary {
  pairId: string
  externalFixtureId: string
  fixtureProvider: string
  player1Id: string
  player1Name: string
  player2Id: string
  player2Name: string
  tournamentName: string | null
  surface: string | null
  scheduledStartAt: string
  status: string
  noDecisionReason: string | null
  builderPickedPlayerId: string | null
  builderPickedPlayerName: string | null
  builderCalibratedProbability: number | null
  crossSideAgreement: boolean | null
  crossSideDisagreementReason: string | null
  sides: { player1: SideSummary; player2: SideSummary }
  actualWinnerId: string | null
  resultType: string | null
  gradedCorrect: boolean | null
}

interface PairDetail {
  fixture: {
    externalFixtureId: string; provider: string
    player1: { id: string; name: string }; player2: { id: string; name: string }
    tournamentName: string | null; tournamentLevel: string | null; round: string | null
    surface: string | null; matchFormat: string | null; scheduledStartAt: string
  }
  lifecycle: {
    status: string; discoveredAt: string; decisionCutoffAt: string
    decisionAt: string | null; frozenAt: string | null; matchStartedAt: string | null
    outcomeAttachedAt: string | null; gradedAt: string | null; noDecisionReason: string | null
  }
  autonomousPrediction: {
    builderPickedPlayerId: string | null; builderPickedPlayerName: string | null
    builderCalibratedProbability: number | null
  }
  directionalEvaluations: {
    player1: SideSummary & { rawValidationScore: number | null; dataCoverage: number | null; factors: FactorRow[] }
    player2: SideSummary & { rawValidationScore: number | null; dataCoverage: number | null; factors: FactorRow[] }
  }
  integrity: {
    pairId: string; crossSideAgreement: boolean | null; crossSideDisagreementReason: string | null
    crossSideCheckedAt: string | null; snapshotFingerprint: string | null
    evidenceCutoff: string | null; evidenceTimestamps: { snapshotCreatedAt: string | null }
  }
  lineage: {
    builderVersion: string | null; builderConfigFingerprint: string | null
    builderLineageStatus: string | null; builderLineageReason: string | null
    calibrationModelId: number | null; lineageKey: string; sourceCommit: string
  }
  outcome: {
    actualWinnerId: string | null; resultType: string | null
    includedInAccuracy: boolean | null; gradedCorrect: boolean | null
  }
}

interface FactorRow {
  id: number; paperTradeId: string; factorKey: string; factorLabel: string
  score: number | null; weight: number; status: string; supportsSelected: boolean | null; detail: string | null
}

interface SummaryResponse {
  byStatus: Record<string, number>
  crossSideDisagreements: number
}

const UPCOMING_STATUSES = new Set(["DISCOVERED", "FROZEN", "NO_DECISION", "INELIGIBLE", "DATA_ERROR", "STARTED"])
const COMPLETED_STATUSES = new Set(["COMPLETED", "GRADED"])

const ALL_STATUSES = ["DISCOVERED", "FROZEN", "NO_DECISION", "INELIGIBLE", "DATA_ERROR", "STARTED", "COMPLETED", "GRADED"]

// ── Filters (9+ server-side filters, all forwarded verbatim as query params) ───

interface Filters {
  status: string
  evaluatedSide: string
  gradingStatus: string
  decision: string
  resultType: string
  crossSideAgreement: string
  surface: string
  tournamentName: string
  dateFrom: string
  dateTo: string
}

const EMPTY_FILTERS: Filters = {
  status: "", evaluatedSide: "", gradingStatus: "", decision: "", resultType: "",
  crossSideAgreement: "", surface: "", tournamentName: "", dateFrom: "", dateTo: "",
}

function buildQuery(filters: Filters, limit: number, offset: number): string {
  const params = new URLSearchParams()
  params.set("limit", String(limit))
  params.set("offset", String(offset))
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value)
  }
  return params.toString()
}

// ── Small shared bits ────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }): ReactElement {
  const variant =
    status === "GRADED" || status === "FROZEN" ? "default"
    : status === "INELIGIBLE" || status === "DATA_ERROR" ? "destructive"
    : "secondary"
  return <Badge variant={variant}>{status}</Badge>
}

function DecisionBadge({ decision }: { decision: string | null }): ReactElement {
  if (!decision) return <Badge variant="outline">—</Badge>
  const variant = decision === "KEEP" ? "default" : decision === "REMOVE" ? "destructive" : "secondary"
  return <Badge variant={variant}>{decision}</Badge>
}

// The one visual rule every row/section must honor: the autonomous pick is rendered in its
// own distinctly-labeled slot, never inside or adjacent to a KEEP/BORDERLINE/REMOVE badge.
function BuilderPickCell({ name, id, probability }: { name: string | null; id: string | null; probability: number | null }): ReactElement {
  if (!id) return <span className="text-xs text-muted-foreground">No pick (see status)</span>
  return (
    <div className="flex items-center gap-1.5">
      <Target className="h-3.5 w-3.5 text-primary shrink-0" />
      <span className="font-medium text-sm">{name}</span>
      {probability != null && <span className="text-xs text-muted-foreground">({probability}%)</span>}
    </div>
  )
}

function ParlayPaperTradingDisclaimerBanner(): ReactElement {
  return (
    <Alert className="border-sky-500/50 bg-sky-500/10">
      <Target className="h-4 w-4" />
      <AlertTitle className="font-mono">LIVE_PRODUCTION_PAPER_TRADING</AlertTitle>
      <AlertDescription>
        Prospective, double-sided evaluations of real upcoming fixtures using the production
        Builder (<code className="font-mono text-xs">computeBuilderScoreBothSides</code>). This is
        a read-only view — nothing here can be edited. The "Builder Pick" is the Builder's single
        autonomous prediction for who wins; each side's "Decision" (KEEP/BORDERLINE/REMOVE) is a
        separate per-side validation label and must never be read as the prediction itself.
      </AlertDescription>
    </Alert>
  )
}

// ── Summary cards (9 named counts) ──────────────────────────────────────────

function SummaryCards({ summary }: { summary: SummaryResponse | undefined }): ReactElement {
  const total = summary ? Object.values(summary.byStatus).reduce((a, b) => a + b, 0) : 0
  const cards: { label: string; value: number }[] = [
    { label: "Total pairs", value: total },
    ...ALL_STATUSES.map((s) => ({ label: s, value: summary?.byStatus[s] ?? 0 })),
    { label: "Cross-side disagreements", value: summary?.crossSideDisagreements ?? 0 },
  ]
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="p-3">
            <div className="text-2xl font-bold">{c.value}</div>
            <div className="text-xs text-muted-foreground">{c.label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ── Filter bar ───────────────────────────────────────────────────────────────

function FilterBar({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }): ReactElement {
  const set = (key: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...filters, [key]: e.target.value })

  return (
    <Card>
      <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Status</label>
          <Select value={filters.status} onChange={set("status")}>
            <option value="">Any</option>
            {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Evaluated side</label>
          <Select value={filters.evaluatedSide} onChange={set("evaluatedSide")}>
            <option value="">Any</option>
            <option value="PLAYER_1">Player 1</option>
            <option value="PLAYER_2">Player 2</option>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Grading</label>
          <Select value={filters.gradingStatus} onChange={set("gradingStatus")}>
            <option value="">Any</option>
            <option value="graded">Graded</option>
            <option value="ungraded">Ungraded</option>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Decision</label>
          <Select value={filters.decision} onChange={set("decision")}>
            <option value="">Any</option>
            <option value="KEEP">KEEP</option>
            <option value="BORDERLINE">BORDERLINE</option>
            <option value="REMOVE">REMOVE</option>
            <option value="DATA_UNAVAILABLE">DATA_UNAVAILABLE</option>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Result type</label>
          <Select value={filters.resultType} onChange={set("resultType")}>
            <option value="">Any</option>
            <option value="normal">Normal</option>
            <option value="retired">Retired</option>
            <option value="cancelled">Cancelled</option>
            <option value="walkover">Walkover</option>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Cross-side agreement</label>
          <Select value={filters.crossSideAgreement} onChange={set("crossSideAgreement")}>
            <option value="">Any</option>
            <option value="true">Agree</option>
            <option value="false">Disagree</option>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Surface</label>
          <Input value={filters.surface} onChange={set("surface")} placeholder="Hard" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Tournament</label>
          <Input value={filters.tournamentName} onChange={set("tournamentName")} placeholder="US Open" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">From</label>
          <Input type="date" value={filters.dateFrom} onChange={set("dateFrom")} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">To</label>
          <Input type="date" value={filters.dateTo} onChange={set("dateTo")} />
        </div>
        <div className="flex items-end">
          <Button variant="outline" size="sm" onClick={() => onChange(EMPTY_FILTERS)}>Clear filters</Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Pairs table (shared by Upcoming / Completed tabs) ───────────────────────

function PairsTable({ pairs, onSelect }: { pairs: PairSummary[]; onSelect: (pairId: string) => void }): ReactElement {
  if (pairs.length === 0) {
    return <p className="text-sm text-muted-foreground p-4">No paper trades match the current filters.</p>
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Match</TableHead>
          <TableHead>Builder Pick</TableHead>
          <TableHead>P1 Decision</TableHead>
          <TableHead>P2 Decision</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Agreement</TableHead>
          <TableHead>Correct</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pairs.map((p) => (
          <TableRow key={p.pairId} className="cursor-pointer" onClick={() => onSelect(p.pairId)}>
            <TableCell className="text-xs">{new Date(p.scheduledStartAt).toISOString().slice(0, 16).replace("T", " ")}</TableCell>
            <TableCell className="text-xs">
              {p.player1Name} vs {p.player2Name}
              {p.tournamentName ? <div className="text-[10px] text-muted-foreground">{p.tournamentName}{p.surface ? ` · ${p.surface}` : ""}</div> : null}
            </TableCell>
            <TableCell>
              <BuilderPickCell name={p.builderPickedPlayerName} id={p.builderPickedPlayerId} probability={p.builderCalibratedProbability} />
            </TableCell>
            <TableCell><DecisionBadge decision={p.sides.player1.decision} /></TableCell>
            <TableCell><DecisionBadge decision={p.sides.player2.decision} /></TableCell>
            <TableCell><StatusBadge status={p.status} /></TableCell>
            <TableCell>
              {p.crossSideAgreement == null ? "—" : p.crossSideAgreement ? (
                <Badge variant="outline">Agree</Badge>
              ) : (
                <Badge variant="destructive" className="gap-1"><ShieldAlert className="h-3 w-3" />{p.crossSideDisagreementReason ?? "Disagree"}</Badge>
              )}
            </TableCell>
            <TableCell>
              {p.gradedCorrect == null ? "—" : p.gradedCorrect ? <Badge>✓</Badge> : <Badge variant="destructive">✗</Badge>}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

// ── Detail view ───────────────────────────────────────────────────────────────

function DirectionalEvaluationCard({ label, side }: { label: string; side: PairDetail["directionalEvaluations"]["player1"] }): ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{label}: {side.selectedPlayerName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Decision (validation label, not a prediction):</span>
          <DecisionBadge decision={side.decision} />
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div><span className="text-muted-foreground">Selected score</span><div>{side.selectedPlayerScore ?? "—"}</div></div>
          <div><span className="text-muted-foreground">Selected risk</span><div>{side.selectedPlayerRiskScore ?? "—"}</div></div>
          <div><span className="text-muted-foreground">Raw validation score</span><div>{side.rawValidationScore ?? "—"}</div></div>
          <div><span className="text-muted-foreground">Data coverage</span><div>{side.dataCoverage != null ? `${side.dataCoverage}%` : "—"}</div></div>
        </div>
        {side.factors.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Factor</TableHead><TableHead>Score</TableHead><TableHead>Weight</TableHead><TableHead>Supports</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {side.factors.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="text-xs">{f.factorLabel}</TableCell>
                  <TableCell className="text-xs">{f.score ?? "—"}</TableCell>
                  <TableCell className="text-xs">{f.weight}</TableCell>
                  <TableCell className="text-xs">{f.supportsSelected == null ? "—" : f.supportsSelected ? "✓" : "✗"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function PairDetailView({ pairId, onBack }: { pairId: string; onBack: () => void }): ReactElement {
  const { data, isLoading, error } = useQuery<{ detail: PairDetail }>({
    queryKey: ["paper-trading-detail", pairId],
    queryFn: async () => {
      const r = await fetch(api(`/api/admin/parlay-paper-trading/pairs/${pairId}`), { credentials: "include" })
      if (!r.ok) throw new Error("Failed to load paper trade detail")
      return r.json()
    },
  })

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
        <ArrowLeft className="h-4 w-4" /> Back to list
      </Button>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}

      {data?.detail && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {data.detail.fixture.player1.name} vs {data.detail.fixture.player2.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-1">
              <div className="text-muted-foreground">
                {data.detail.fixture.tournamentName ?? "—"}
                {data.detail.fixture.round ? ` · ${data.detail.fixture.round}` : ""}
                {data.detail.fixture.surface ? ` · ${data.detail.fixture.surface}` : ""}
              </div>
              <div>Scheduled: {new Date(data.detail.fixture.scheduledStartAt).toISOString()}</div>
              <div className="font-mono">{data.detail.fixture.externalFixtureId} ({data.detail.fixture.provider})</div>
            </CardContent>
          </Card>

          {/* THE autonomous prediction — a physically separate card, never merged with either
              side's decision, per the "BUILDER PICK != VALIDATION DECISION" requirement. */}
          <Card className="border-primary/40">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" /> Builder Pick (autonomous prediction)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.detail.autonomousPrediction.builderPickedPlayerId ? (
                <div className="flex items-center gap-3">
                  <span className="text-lg font-semibold">{data.detail.autonomousPrediction.builderPickedPlayerName}</span>
                  {data.detail.autonomousPrediction.builderCalibratedProbability != null && (
                    <Badge variant="outline">{data.detail.autonomousPrediction.builderCalibratedProbability}% calibrated</Badge>
                  )}
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">No pick — {data.detail.lifecycle.noDecisionReason ?? data.detail.lifecycle.status}</span>
              )}
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <DirectionalEvaluationCard label="Player 1 evaluation" side={data.detail.directionalEvaluations.player1} />
            <DirectionalEvaluationCard label="Player 2 evaluation" side={data.detail.directionalEvaluations.player2} />
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Lifecycle</CardTitle></CardHeader>
              <CardContent className="text-xs space-y-1">
                <div>Status: <StatusBadge status={data.detail.lifecycle.status} /></div>
                <div>Discovered: {data.detail.lifecycle.discoveredAt}</div>
                <div>Decision cutoff: {data.detail.lifecycle.decisionCutoffAt}</div>
                <div>Frozen: {data.detail.lifecycle.frozenAt ?? "—"}</div>
                <div>Match started: {data.detail.lifecycle.matchStartedAt ?? "—"}</div>
                <div>Outcome attached: {data.detail.lifecycle.outcomeAttachedAt ?? "—"}</div>
                <div>Graded: {data.detail.lifecycle.gradedAt ?? "—"}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Integrity &amp; lineage</CardTitle></CardHeader>
              <CardContent className="text-xs space-y-1">
                <div>Cross-side agreement: {data.detail.integrity.crossSideAgreement == null ? "—" : data.detail.integrity.crossSideAgreement ? "Yes" : `No (${data.detail.integrity.crossSideDisagreementReason})`}</div>
                <div>Evidence cutoff: {data.detail.integrity.evidenceCutoff ?? "—"}</div>
                <div className="truncate">Snapshot fingerprint: {data.detail.integrity.snapshotFingerprint ?? "—"}</div>
                <div>Builder version: {data.detail.lineage.builderVersion ?? "—"}</div>
                <div className="truncate">Config fingerprint: {data.detail.lineage.builderConfigFingerprint ?? "—"}</div>
                <div>Lineage status: {data.detail.lineage.builderLineageStatus ?? "—"}</div>
                <div className="truncate">Lineage key: {data.detail.lineage.lineageKey}</div>
                <div className="truncate">Source commit: {data.detail.lineage.sourceCommit}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Outcome</CardTitle></CardHeader>
              <CardContent className="text-xs space-y-1">
                <div>Actual winner: {data.detail.outcome.actualWinnerId ?? "—"}</div>
                <div>Result type: {data.detail.outcome.resultType ?? "—"}</div>
                <div>Included in accuracy: {data.detail.outcome.includedInAccuracy == null ? "—" : data.detail.outcome.includedInAccuracy ? "Yes" : "No (void)"}</div>
                <div>Graded correct: {data.detail.outcome.gradedCorrect == null ? "—" : data.detail.outcome.gradedCorrect ? "✓ Correct" : "✗ Incorrect"}</div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

// ── Page root ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 50

export default function AdminParlayPaperTrading(): ReactElement {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [offset, setOffset] = useState(0)
  const [selectedPairId, setSelectedPairId] = useState<string | null>(null)

  const { data: summaryData } = useQuery<SummaryResponse>({
    queryKey: ["paper-trading-summary"],
    queryFn: async () => {
      const r = await fetch(api("/api/admin/parlay-paper-trading/summary"), { credentials: "include" })
      if (!r.ok) throw new Error("Failed to load summary")
      return r.json()
    },
  })

  const query = useMemo(() => buildQuery(filters, PAGE_SIZE, offset), [filters, offset])
  const { data: pairsData, isLoading: pairsLoading } = useQuery<{ count: number; pairs: PairSummary[] }>({
    queryKey: ["paper-trading-pairs", query],
    queryFn: async () => {
      const r = await fetch(api(`/api/admin/parlay-paper-trading/pairs?${query}`), { credentials: "include" })
      if (!r.ok) throw new Error("Failed to load paper trades")
      return r.json()
    },
  })

  const upcoming = (pairsData?.pairs ?? []).filter((p) => UPCOMING_STATUSES.has(p.status))
  const completed = (pairsData?.pairs ?? []).filter((p) => COMPLETED_STATUSES.has(p.status))

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Target className="h-6 w-6" />
          Builder Paper Trading
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Prospective, double-sided paper trades of the production{" "}
          <Link href="/admin/parlay-builder" className="underline">Parlay Builder</Link>. Isolated from{" "}
          <Link href="/admin/parlay-research-v1" className="underline">Parlay Research (V1)</Link>{" "}
          (counterfactual backtest) and the Prediction Engine's own paper trading.
        </p>
      </div>

      <ParlayPaperTradingDisclaimerBanner />

      <SummaryCards summary={summaryData} />

      {selectedPairId ? (
        <PairDetailView pairId={selectedPairId} onBack={() => setSelectedPairId(null)} />
      ) : (
        <>
          <FilterBar filters={filters} onChange={(f) => { setFilters(f); setOffset(0) }} />

          <Card>
            <CardContent className="p-0">
              {pairsLoading ? (
                <p className="text-sm text-muted-foreground p-4">Loading…</p>
              ) : (
                <Tabs defaultValue="upcoming">
                  <TabsList className="m-4">
                    <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
                    <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
                  </TabsList>
                  <TabsContent value="upcoming">
                    <PairsTable pairs={upcoming} onSelect={setSelectedPairId} />
                  </TabsContent>
                  <TabsContent value="completed">
                    <PairsTable pairs={completed} onSelect={setSelectedPairId} />
                  </TabsContent>
                </Tabs>
              )}
              <div className="flex items-center justify-between p-4 border-t">
                <span className="text-xs text-muted-foreground">
                  Showing {pairsData?.count ?? 0} pair(s) starting at offset {offset}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
                    <ChevronLeft className="h-4 w-4" /> Prev
                  </Button>
                  <Button variant="outline" size="sm" disabled={(pairsData?.count ?? 0) < PAGE_SIZE} onClick={() => setOffset(offset + PAGE_SIZE)}>
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
