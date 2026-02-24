"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Loader2, AlertCircle, RefreshCw, Medal } from "lucide-react";

import type { TeamAnalysis, TeamMemberName } from "@/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { ScoreBreakdown } from "@/components/score-breakdown";
import { AchievementWall } from "@/components/achievement-wall";
import { CursorMetrics } from "@/components/cursor-metrics";
import { GitStats } from "@/components/git-stats";
import { useAnalysisEventsContext } from "@/components/analysis-provider";

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
  const { analyzingTeams, subscribeRefetch } = useAnalysisEventsContext();

  const [analysis, setAnalysis] = useState<TeamAnalysis | null>(null);
  const [memberNames, setMemberNames] = useState<TeamMemberName[]>([]);
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
      setMemberNames(Array.isArray(data.memberNames) ? data.memberNames : []);
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

  useEffect(() => {
    return subscribeRefetch(teamId, fetchData);
  }, [teamId, subscribeRefetch, fetchData]);

  if (loading) return <PublicTeamSkeleton />;

  if (error || !analysis) {
    const isRunning =
      analyzingTeams.has(teamId) || error?.includes("still running");
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
            : (error ?? "No analysis data available.")}
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{analysis.team}</h1>
        {memberNames.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            {memberNames
              .map((m) => [m.firstName, m.lastName].filter(Boolean).join(" "))
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          Score:{" "}
          {Math.round(
            analysis.totalScore -
              (analysis.score?.achievementBonus?.total ?? 0),
          )}{" "}
          pts
          {(analysis.score?.achievementBonus?.total ?? 0) > 0 && (
            <span className="text-amber-500">
              {" "}
              (+{analysis.score.achievementBonus!.total} from achievements)
            </span>
          )}
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
