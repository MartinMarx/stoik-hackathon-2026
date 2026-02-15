"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Medal,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

import type { TeamAnalysis, TimelineEvent } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import { ScoreBreakdown } from "@/components/score-breakdown";
import { AchievementWall } from "@/components/achievement-wall";
import { CursorMetrics } from "@/components/cursor-metrics";
import { GitStats } from "@/components/git-stats";
import { AIAnalysis } from "@/components/ai-analysis";
import { FeatureProgress } from "@/components/feature-progress";
import { TeamTimeline } from "@/components/team-timeline";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRankBadge(score: number): { label: string; className: string } {
  if (score >= 90) return { label: "S", className: "bg-yellow-500 text-white" };
  if (score >= 75) return { label: "A", className: "bg-green-500 text-white" };
  if (score >= 60) return { label: "B", className: "bg-blue-500 text-white" };
  if (score >= 40) return { label: "C", className: "bg-orange-500 text-white" };
  return { label: "D", className: "bg-red-500 text-white" };
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function TeamDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-8 w-8 rounded" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
      <Skeleton className="h-96" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function TeamDetailError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <AlertCircle className="size-12 text-muted-foreground" />
      <h2 className="text-lg font-semibold">Failed to load team data</h2>
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" onClick={onRetry}>
        <RefreshCw className="mr-2 size-4" />
        Try Again
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TeamDetailPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = React.use(params);

  const [analysis, setAnalysis] = useState<TeamAnalysis | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [analysisRes, eventsRes] = await Promise.all([
        fetch(`/api/analyze/${teamId}`),
        fetch(`/api/events?team=${teamId}&limit=50`),
      ]);

      if (!analysisRes.ok) {
        if (analysisRes.status === 404) {
          setError("No analysis found for this team. Run an analysis first.");
          setLoading(false);
          return;
        }
        throw new Error(`Analysis fetch failed: ${analysisRes.status}`);
      }

      const analysisData = await analysisRes.json();
      // The analysis result is stored in the `result` field of the analyses table row
      const teamAnalysis: TeamAnalysis = analysisData.result ?? analysisData;
      setAnalysis(teamAnalysis);

      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        setEvents(eventsData.events ?? []);
      }
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

  async function handleRunAnalysis() {
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/analyze/${teamId}`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Analysis failed");
      }
      const data = await res.json();
      toast.success("Analysis triggered", {
        description: `Analysis started for ${data.team ?? "team"}. Refresh in a moment to see results.`,
      });
      // Refetch after a delay to pick up results
      setTimeout(() => fetchData(), 5000);
    } catch (err) {
      toast.error("Analysis failed", {
        description:
          err instanceof Error ? err.message : "An unexpected error occurred.",
      });
    } finally {
      setAnalyzing(false);
    }
  }

  if (loading) {
    return <TeamDetailSkeleton />;
  }

  if (error || !analysis) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon-sm">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Team Details</h1>
        </div>
        <TeamDetailError
          message={error ?? "No analysis data available."}
          onRetry={fetchData}
        />
        <div className="flex justify-center">
          <Button onClick={handleRunAnalysis} disabled={analyzing}>
            {analyzing ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 size-4" />
            )}
            Run Analysis
          </Button>
        </div>
      </div>
    );
  }

  const rank = getRankBadge(analysis.totalScore);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon-sm">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
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
              Score: {analysis.totalScore} pts &middot; Last analyzed:{" "}
              {new Date(analysis.analyzedAt).toLocaleString()}
            </p>
          </div>
        </div>
        <Button onClick={handleRunAnalysis} disabled={analyzing}>
          {analyzing ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 size-4" />
          )}
          Run Analysis
        </Button>
      </div>

      {/* Top row: Score Breakdown + Achievements */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ScoreBreakdown breakdown={analysis.score} />
        <AchievementWall
          unlocked={analysis.achievements}
          teamId={analysis.teamId}
        />
      </div>

      {/* Middle row: Cursor Metrics + Git Stats */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CursorMetrics
          metrics={analysis.cursorMetrics}
          structure={analysis.cursor}
        />
        <GitStats metrics={analysis.git} />
      </div>

      {/* AI Analysis (full width) */}
      <AIAnalysis
        review={analysis.aiReview}
        teamId={analysis.teamId}
        teamName={analysis.team}
        score={analysis.totalScore}
      />

      {/* Bottom: Feature Progress + Timeline */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <FeatureProgress compliance={analysis.featuresCompliance} />
        <TeamTimeline events={events} />
      </div>
    </div>
  );
}
