import React, { useEffect, useState, useCallback } from "react";
import { cn } from "@frontend/lib/utils";
import { toast } from "sonner";
import { Button } from "@frontend/components/ui/button";
import { Badge } from "@frontend/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@frontend/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@frontend/components/ui/tabs";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Play,
  Copy,
  Clock,
  Cpu,
  Wifi,
  Database,
  Music2,
  Bot,
  Globe,
  ChevronDown,
  ChevronUp,
  ActivitySquare,
  History,
  RefreshCw,
} from "lucide-react";
import { DateTime } from "luxon";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HealthResult {
  id: string;
  name: string;
  group: string;
  ok: boolean;
  message: string;
  latencyMs: number;
  error?: string | null;
  aiSuggestion?: string | null;
}

interface HealthJob {
  id: string;
  trigger: string;
  status: string;
  passed: number;
  failed: number;
  total: number;
  durationMs?: number | null;
  startedAt: number | string;
  completedAt?: number | string | null;
}

interface HealthData {
  job: HealthJob | null;
  results: HealthResult[];
}

// ─── Utils ───────────────────────────────────────────────────────────────────

const GROUP_ICONS: Record<string, React.ReactNode> = {
  "Database & Storage": <Database className="size-5" />,
  "AI Providers": <Cpu className="size-5" />,
  "Hardware & WebSocket": <Wifi className="size-5" />,
  "AI Agents": <Bot className="size-5" />,
  "Spotify Integration": <Music2 className="size-5" />,
  "API & Database": <Globe className="size-5" />,
  "Dynamic Tests": <Globe className="size-5" />,
};

function groupResults(results: HealthResult[]): Record<string, HealthResult[]> {
  return results.reduce<Record<string, HealthResult[]>>((acc, r) => {
    const g = r.group ?? "Other";
    if (!acc[g]) acc[g] = [];
    acc[g].push(r);
    return acc;
  }, {});
}

function overallStatus(job: HealthJob | null): "operational" | "degraded" | "down" {
  if (!job) return "down";
  if (job.failed === 0) return "operational";
  if (job.passed > 0) return "degraded";
  return "down";
}

function statusColor(ok: boolean | undefined): string {
  if (ok === undefined) return "text-zinc-400";
  return ok ? "text-emerald-400" : "text-red-400";
}

function formatDuration(ms?: number | null): string {
  if (!ms) return "—";
  return ms > 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, icon, accent }: { label: string; value: React.ReactNode; icon: React.ReactNode; accent?: string }) {
  return (
    <Card className="border-white/10 bg-black/30 backdrop-blur-sm">
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1">{label}</p>
          <p className={cn("text-2xl font-bold", accent ?? "text-white")}>{value}</p>
        </div>
        <div className="text-muted-foreground">{icon}</div>
      </CardContent>
    </Card>
  );
}

function CheckRow({ result }: { result: HealthResult }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className={cn(
        "flex flex-col gap-1 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors cursor-pointer",
      )}
      onClick={() => setExpanded((e) => !e)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {result.ok
            ? <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
            : <XCircle className="size-4 shrink-0 text-red-500" />}
          <div>
            <p className="text-sm font-medium text-slate-100">{result.name}</p>
            <p className="text-[11px] text-muted-foreground">{result.message}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 ml-4 shrink-0">
          <span className="text-[11px] font-mono text-muted-foreground">{formatDuration(result.latencyMs)}</span>
          {expanded ? <ChevronUp className="size-3 text-muted-foreground" /> : <ChevronDown className="size-3 text-muted-foreground" />}
        </div>
      </div>
      {expanded && result.aiSuggestion && (
        <div className="ml-7 mt-2 text-[11px] text-amber-400 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
          <span className="font-bold">AI Suggestion: </span>{result.aiSuggestion}
        </div>
      )}
      {expanded && result.error && !result.aiSuggestion && (
        <div className="ml-7 mt-2 text-[11px] text-red-400 font-mono bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2 break-all">
          {result.error}
        </div>
      )}
    </div>
  );
}

function GroupCard({ group, results }: { group: string; results: HealthResult[] }) {
  const [open, setOpen] = useState(true);
  const passed = results.filter((r) => r.ok).length;
  const allOk = passed === results.length;
  const icon = GROUP_ICONS[group] ?? <Globe className="size-5" />;

  return (
    <Card className="border-white/10 bg-black/20 overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-xl border", allOk ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-red-500/30 bg-red-500/10 text-red-400")}>
            {icon}
          </div>
          <div className="text-left">
            <p className="font-semibold text-slate-100">{group}</p>
            <p className="text-[11px] text-muted-foreground">
              {results.length} check{results.length !== 1 ? "s" : ""} · {allOk ? "All Operational" : `${results.length - passed} Issue${results.length - passed !== 1 ? "s" : ""} Detected`}
            </p>
          </div>
        </div>
        {open ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="border-t border-white/5">
          {results.map((r) => <CheckRow key={r.id} result={r} />)}
        </div>
      )}
    </Card>
  );
}

function JobHistoryRow({ job, onSelect }: { job: HealthJob; onSelect: () => void }) {
  const status = job.failed === 0 ? "operational" : job.passed > 0 ? "degraded" : "down";
  const ts = typeof job.startedAt === "number"
    ? DateTime.fromSeconds(job.startedAt).toLocaleString(DateTime.DATETIME_MED)
    : DateTime.fromISO(job.startedAt as string).toLocaleString(DateTime.DATETIME_MED);

  return (
    <tr
      className="border-b border-white/5 hover:bg-white/[0.02] cursor-pointer transition-colors"
      onClick={onSelect}
    >
      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{ts}</td>
      <td className="px-4 py-3">
        <Badge variant="outline" className="text-[10px] capitalize border-white/10">{job.trigger.replace("_", " ")}</Badge>
      </td>
      <td className="px-4 py-3 text-sm">
        <span className={status === "operational" ? "text-emerald-400" : status === "degraded" ? "text-amber-400" : "text-red-400"}>
          {status === "operational" ? "Operational" : status === "degraded" ? "Degraded" : "Down"}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-slate-300">{job.passed}/{job.total}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{formatDuration(job.durationMs)}</td>
    </tr>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function HealthDashboard() {
  const [current, setCurrent] = useState<HealthData | null>(null);
  const [jobs, setJobs] = useState<HealthJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [selectedJob, setSelectedJob] = useState<HealthData | null>(null);
  const [tab, setTab] = useState("current");

  const fetchLatest = useCallback(async () => {
    try {
      const res = await fetch("/api/health/latest");
      const data = await res.json() as HealthData;
      setCurrent(data);
    } catch (e: any) {
      toast.error("Failed to load health data", { description: e.message });
    }
  }, []);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/health/jobs?limit=20");
      const data = await res.json() as HealthJob[];
      setJobs(data);
    } catch {}
  }, []);

  useEffect(() => {
    Promise.all([fetchLatest(), fetchJobs()]).finally(() => setLoading(false));
  }, []);

  const handleRun = async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/health/run", { method: "POST" });
      const data = await res.json() as HealthData;
      setCurrent(data);
      setSelectedJob(null);
      setTab("current");
      await fetchJobs();
      toast.success("Health scan complete", {
        description: `${(data as any).passed ?? 0} passed · ${(data as any).failed ?? 0} failed`,
      });
    } catch (e: any) {
      toast.error("Health run failed", { description: e.message });
    } finally {
      setRunning(false);
    }
  };

  const handleJobSelect = async (jobId: string) => {
    try {
      const res = await fetch(`/api/health/jobs/${jobId}`);
      const data = await res.json() as HealthData;
      setSelectedJob(data);
      setTab("current");
    } catch {}
  };

  const handleCopyReport = () => {
    const display = selectedJob ?? current;
    if (!display?.results) return;
    const lines = display.results.map((r) => `[${r.ok ? "✓" : "✗"}] ${r.name} (${r.group}) — ${r.message} (${r.latencyMs}ms)`);
    navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Report copied to clipboard");
  };

  const display = selectedJob ?? current;
  const job = display?.job ?? null;
  const results = display?.results ?? [];
  const grouped = groupResults(results);
  const status = overallStatus(job);
  const totalDuration = results.reduce((s, r) => s + r.latencyMs, 0);

  const ts = job?.startedAt
    ? typeof job.startedAt === "number"
      ? DateTime.fromSeconds(job.startedAt).toLocaleString(DateTime.DATETIME_MED)
      : DateTime.fromISO(job.startedAt as string).toLocaleString(DateTime.DATETIME_MED)
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground gap-3">
        <RefreshCw className="size-5 animate-spin" />
        <span>Loading health data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Health</h1>
          <p className="text-muted-foreground mt-1">Comprehensive diagnostics across all platform domains.</p>
        </div>
        <div className="flex items-center gap-3">
          {ts && <span className="text-xs text-muted-foreground">{ts}</span>}
          <Button variant="outline" size="sm" className="gap-2 border-white/10" onClick={handleCopyReport}>
            <Copy className="size-3.5" /> Copy Report
          </Button>
          <Button size="sm" className="gap-2 bg-white text-black hover:bg-white/90 font-bold" onClick={handleRun} disabled={running}>
            {running ? <RefreshCw className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
            Run Checks
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Overall Status" icon={<ActivitySquare className="size-5" />} value={
          <span className={cn(
            status === "operational" && "text-emerald-400",
            status === "degraded" && "text-amber-400",
            status === "down" && "text-red-400",
          )}>
            {status === "operational" ? "✓ Operational" : status === "degraded" ? "⚠ Degraded" : "✗ Down"}
          </span>
        } />
        <StatCard label="Tests Passed" icon={<CheckCircle2 className="size-5 text-emerald-500" />} value={
          <span>{job?.passed ?? 0}<span className="text-muted-foreground text-lg font-normal">/{job?.total ?? 0}</span></span>
        } accent="text-emerald-400" />
        <StatCard label="Critical Failures" icon={<XCircle className="size-5 text-red-500" />} value={job?.failed ?? 0} accent={(job?.failed ?? 0) > 0 ? "text-red-400" : "text-white"} />
        <StatCard label="Total Duration" icon={<Clock className="size-5" />} value={formatDuration(job?.durationMs ?? totalDuration)} />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="current" className="gap-2 data-[state=active]:bg-white data-[state=active]:text-black">
            <ActivitySquare className="size-3.5" /> Current Run
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="size-3.5" /> History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="mt-4 space-y-3">
          {results.length === 0 ? (
            <Card className="border-white/10 bg-black/20">
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-4">
                <AlertCircle className="size-8" />
                <p>No health data yet. Click <strong>Run Checks</strong> to start.</p>
              </CardContent>
            </Card>
          ) : (
            Object.entries(grouped).map(([group, groupResults]) => (
              <GroupCard key={group} group={group} results={groupResults} />
            ))
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card className="border-white/10 bg-black/20 overflow-hidden">
            {jobs.length === 0 ? (
              <CardContent className="py-12 text-center text-muted-foreground">No history yet.</CardContent>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-[11px] uppercase tracking-widest text-muted-foreground">
                      <th className="px-4 py-3 text-left">Time</th>
                      <th className="px-4 py-3 text-left">Trigger</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Passed</th>
                      <th className="px-4 py-3 text-left">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((j) => (
                      <JobHistoryRow key={j.id} job={j} onSelect={() => handleJobSelect(j.id)} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
