"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Loader2, AlertCircle, RefreshCw, Medal } from "lucide-react";

import type { TeamAnalysis } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import { ScoreBreakdown } from "@/components/score-breakdown";
import { AchievementWall } from "@/components/achievement-wall";
import { CursorMetrics } from "@/components/cursor-metrics";
import { GitStats } from "@/components/git-stats";

function getRankBadge(score: number): { label: string; className: string } {
  if (score >= 90) return { label: "S", className: "bg-yellow-500 text-white" };
  if (score >= 75) return { label: "A", className: "bg-green-500 text-white" };
  if (score >= 60) return { label: "B", className: "bg-blue-500 text-white" };
  if (score >= 40) return { label: "C", className: "bg-orange-500 text-white" };
  return { label: "D", className: "bg-red-500 text-white" };
}

function PublicTeamSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}

export default function PublicTeamPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = React.use(params);

  const [analysis, setAnalysis] = useState<TeamAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/analyze/${teamId}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError("No analysis found for this team yet.");
          setLoading(false);
          return;
        }
        throw new Error(`Failed to load team data`);
      }

      const data = await res.json();
      const result = data.result;
      if (!result || !result.totalScore) {
        setError("Analysis is still running. Results will appear shortly.");
        setLoading(false);
        return;
      }
      setAnalysis(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh while analysis is running
  useEffect(() => {
    if (!error?.includes("still running")) return;
    const interval = setInterval(() => fetchData(), 5000);
    return () => clearInterval(interval);
  }, [error, fetchData]);

  if (loading) return <PublicTeamSkeleton />;

  if (error || !analysis) {
    const isRunning = error?.includes("still running");
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        {isRunning ? (
          <Loader2 className="size-12 animate-spin text-muted-foreground" />
        ) : (
          <AlertCircle className="size-12 text-muted-foreground" />
        )}
        <h2 className="text-lg font-semibold">
          {isRunning ? "Analysis in progress..." : "Team data unavailable"}
        </h2>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          {isRunning
            ? "Hang tight — results will appear automatically when ready."
            : error ?? "No analysis data available."}
        </p>
        {!isRunning && (
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="mr-2 size-4" />
            Try Again
          </Button>
        )}
      </div>
    );
  }

  const rank = getRankBadge(analysis.totalScore);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">
            {analysis.team}
          </h1>
          <Badge className={cn("text-sm font-bold", rank.className)}>
            {rank.label}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Score: {analysis.totalScore} pts
        </p>
      </div>

      {/* Score Breakdown + Achievements (unlocked only) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ScoreBreakdown breakdown={analysis.score} />
        <AchievementWall
          unlocked={analysis.achievements}
          teamId={analysis.teamId}
          showLocked={false}
        />
      </div>

      {/* Cursor Metrics + Git Stats */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CursorMetrics
          metrics={analysis.cursorMetrics}
          structure={analysis.cursor}
        />
        <GitStats metrics={analysis.git} />
      </div>
    </div>
  );
}
