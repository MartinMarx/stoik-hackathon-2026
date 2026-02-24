"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  CheckCircle2,
  Loader2,
  RefreshCw,
  XCircle,
  Ban,
  Clock,
  ExternalLink,
  StopCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnalysisEventsContext } from "@/components/analysis-provider";
import { SUBSCRIBE_ANY_TEAM } from "@/hooks/use-analysis-events";

type AnalysisRow = {
  id: string;
  teamId: string;
  teamName: string;
  triggeredBy: string;
  commitSha: string;
  status: string;
  result: unknown;
  createdAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
};

const POLL_INTERVAL_MS = 5000;
const STATUS_CONFIG: Record<
  string,
  { icon: typeof Loader2; className: string; label: string }
> = {
  pending: {
    icon: Clock,
    className: "bg-muted text-muted-foreground",
    label: "Pending",
  },
  running: {
    icon: Loader2,
    className: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    label: "Running",
  },
  completed: {
    icon: CheckCircle2,
    className: "bg-green-500/15 text-green-600 dark:text-green-400",
    label: "Completed",
  },
  failed: {
    icon: XCircle,
    className: "bg-destructive/15 text-destructive",
    label: "Failed",
  },
  cancelled: {
    icon: Ban,
    className: "bg-muted text-muted-foreground",
    label: "Cancelled",
  },
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function getResultSummary(result: unknown, status: string): string {
  if (result == null) return status === "failed" ? "—" : "";
  const r = result as Record<string, unknown>;
  if (typeof r.error === "string") return r.error;
  if (typeof r.totalScore === "number") return `Score: ${r.totalScore}`;
  return "";
}

export default function AnalysesPage() {
  const { subscribeRefetch } = useAnalysisEventsContext();
  const [rows, setRows] = useState<AnalysisRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingIds, setCancellingIds] = useState<Set<string>>(new Set());

  const fetchAnalyses = useCallback(async () => {
    try {
      const res = await fetch("/api/analyses?limit=100");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = (await res.json()) as AnalysisRow[];
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Fetch analyses:", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const cancelAnalysis = useCallback(async (id: string) => {
    setCancellingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/analyses/${id}/cancel`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to cancel");
      setRows((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status: "cancelled",
                completedAt: new Date().toISOString(),
              }
            : r,
        ),
      );
    } catch (err) {
      console.error("Cancel analysis:", err);
    } finally {
      setCancellingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  useEffect(() => {
    fetchAnalyses();
  }, [fetchAnalyses]);

  useEffect(() => {
    return subscribeRefetch(SUBSCRIBE_ANY_TEAM, fetchAnalyses);
  }, [subscribeRefetch, fetchAnalyses]);

  useEffect(() => {
    const hasActive = rows.some(
      (r) => r.status === "pending" || r.status === "running",
    );
    if (!hasActive) return;
    const t = setInterval(fetchAnalyses, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [rows, fetchAnalyses]);

  const runningCount = rows.filter((r) => r.status === "running").length;
  const pendingCount = rows.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analyses</h1>
          <p className="text-muted-foreground text-sm">
            All analysis runs: running, pending, and recent history.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setLoading(true);
            fetchAnalyses();
          }}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

      {(runningCount > 0 || pendingCount > 0) && (
        <div className="flex flex-wrap gap-2">
          {runningCount > 0 && (
            <Badge variant="secondary" className="gap-1">
              <Loader2 className="size-3 animate-spin" />
              {runningCount} running
            </Badge>
          )}
          {pendingCount > 0 && (
            <Badge variant="outline" className="gap-1">
              <Clock className="size-3" />
              {pendingCount} pending
            </Badge>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="size-4" />
            Analysis runs
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading && rows.length === 0 ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Triggered by</TableHead>
                  <TableHead>Commit</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-muted-foreground text-center py-8"
                    >
                      No analyses yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => {
                    const config =
                      STATUS_CONFIG[r.status] ?? STATUS_CONFIG.pending;
                    const Icon = config.icon;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(r.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={`gap-1 font-normal ${config.className}`}
                          >
                            {r.status === "running" ? (
                              <Icon className="size-3 animate-spin" />
                            ) : (
                              <Icon className="size-3" />
                            )}
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/teams/${r.teamId}`}
                            className="text-primary hover:underline font-medium"
                          >
                            {r.teamName}
                          </Link>
                        </TableCell>
                        <TableCell className="capitalize">
                          {r.triggeredBy}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {r.commitSha.slice(0, 7)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {r.startedAt ? formatRelative(r.startedAt) : "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {r.completedAt ? formatRelative(r.completedAt) : "—"}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground text-xs">
                          {getResultSummary(r.result, r.status)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {(r.status === "running" ||
                              r.status === "pending") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-muted-foreground hover:text-destructive"
                                title="Cancel analysis"
                                disabled={cancellingIds.has(r.id)}
                                onClick={() => cancelAnalysis(r.id)}
                              >
                                {cancellingIds.has(r.id) ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <StopCircle className="size-4" />
                                )}
                              </Button>
                            )}
                            <Link
                              href={`/teams/${r.teamId}`}
                              className="text-muted-foreground hover:text-foreground"
                              title="Open team"
                            >
                              <ExternalLink className="size-4" />
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
