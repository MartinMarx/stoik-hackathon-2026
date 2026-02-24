"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  AlertCircle,
  Trophy,
  ExternalLink,
  ChevronDown,
  MessageCircle,
  Globe,
} from "lucide-react";

import type { TeamAnalysis, TeamMemberName, TimelineEvent } from "@/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { ScoreBreakdown } from "@/components/score-breakdown";
import { AchievementWall } from "@/components/achievement-wall";
import { CursorMetrics } from "@/components/cursor-metrics";
import { GitStats } from "@/components/git-stats";
import { AIAnalysis } from "@/components/ai-analysis";
import { TeamTimeline } from "@/components/team-timeline";
import { useAnalysisEventsContext } from "@/components/analysis-provider";

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
// Links dropdown (repo, public page, Slack, app)
// ---------------------------------------------------------------------------

function TeamLinksDropdown({
  teamId,
  repoUrl,
  slackChannelId,
  appUrl,
}: {
  teamId: string;
  repoUrl: string | null;
  slackChannelId: string | null;
  appUrl: string | null;
}) {
  const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/public/teams/${teamId}`;
  const slackUrl = slackChannelId
    ? `https://app.slack.com/app_redirect?channel=${slackChannelId}`
    : null;
  const isAbsoluteAppUrl =
    !!appUrl && (appUrl.startsWith("http://") || appUrl.startsWith("https://"));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          Links
          <ChevronDown className="ml-2 size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {repoUrl ? (
          <DropdownMenuItem asChild>
            <a href={repoUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 size-4" />
              Open repo
            </a>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem asChild>
          <a href={publicUrl} target="_blank" rel="noopener noreferrer">
            <Globe className="mr-2 size-4" />
            Public team page
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild disabled={!slackUrl}>
          {slackUrl ? (
            <a href={slackUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="mr-2 size-4" />
              Open private Slack channel
            </a>
          ) : (
            <span>
              <MessageCircle className="mr-2 size-4" />
              Open private Slack channel
            </span>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem asChild disabled={!isAbsoluteAppUrl}>
          {isAbsoluteAppUrl && appUrl ? (
            <a href={appUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 size-4" />
              Open app
            </a>
          ) : (
            <span>
              <ExternalLink className="mr-2 size-4" />
              Open app
            </span>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function GiveAwardDialog({
  teamId,
  unlockedAchievementIds = [],
  onAwarded,
}: {
  teamId: string;
  unlockedAchievementIds?: string[];
  onAwarded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [customList, setCustomList] = useState<
    { id: string; name: string; icon: string }[]
  >([]);
  const [loadingList, setLoadingList] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");

  const alreadyEarned = new Set(unlockedAchievementIds);
  const available = customList.filter(
    (def) => !alreadyEarned.has(`custom:${def.id}`),
  );
  const selectedIdValid =
    !selectedId || available.some((def) => def.id === selectedId);

  React.useEffect(() => {
    if (!selectedIdValid) setSelectedId("");
  }, [selectedIdValid]);

  React.useEffect(() => {
    if (!open) return;
    setLoadingList(true);
    fetch("/api/custom-achievements")
      .then((r) => r.json())
      .then((list: { id: string; name: string; icon: string }[]) => {
        setCustomList(Array.isArray(list) ? list : []);
        setSelectedId("");
      })
      .catch(() => setCustomList([]))
      .finally(() => setLoadingList(false));
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/achievements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customDefinitionId: selectedId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to award");
      }
      toast.success("Award given");
      setOpen(false);
      onAwarded();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to give award");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Trophy className="mr-2 size-4" />
          Give award
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Give award</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Custom achievement</label>
            <Select value={selectedId} onValueChange={setSelectedId} required>
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={loadingList ? "Loading..." : "Select one"}
                />
              </SelectTrigger>
              <SelectContent>
                {available.map((def) => (
                  <SelectItem key={def.id} value={def.id}>
                    {def.icon} {def.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {available.length === 0 && !loadingList && (
              <p className="text-xs text-muted-foreground">
                No custom achievements yet. Add one from the Achievements page.
              </p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !selectedId || !selectedIdValid}
            >
              {submitting ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              Give award
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
  const { analyzingTeams, subscribeRefetch } = useAnalysisEventsContext();

  const [analysis, setAnalysis] = useState<TeamAnalysis | null>(null);
  const [repoUrl, setRepoUrl] = useState<string | null>(null);
  const [slackChannelId, setSlackChannelId] = useState<string | null>(null);
  const [appUrl, setAppUrl] = useState<string | null>(null);
  const [memberNames, setMemberNames] = useState<TeamMemberName[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [eventsTotal, setEventsTotal] = useState(0);
  const [eventsLoadingMore, setEventsLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runTriggered, setRunTriggered] = useState(false);

  const EVENTS_PAGE_SIZE = 20;

  const analyzing = runTriggered || analyzingTeams.has(teamId);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [analysisRes, eventsRes] = await Promise.all([
        fetch(`/api/analyze/${teamId}`),
        fetch(`/api/events?team=${teamId}&limit=${EVENTS_PAGE_SIZE}&offset=0`),
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
      setRepoUrl(analysisData.repoUrl ?? null);
      setSlackChannelId(analysisData.slackChannelId ?? null);
      setAppUrl(analysisData.appUrl ?? null);
      setMemberNames(
        Array.isArray(analysisData.memberNames) ? analysisData.memberNames : [],
      );
      const result = analysisData.result;
      if (!result || !result.totalScore) {
        setError("Analysis is still running. Results will appear shortly.");
        setLoading(false);
        return;
      }
      setAnalysis(result);

      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        setEvents(eventsData.events ?? []);
        setEventsTotal(eventsData.total ?? 0);
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

  useEffect(() => {
    return subscribeRefetch(teamId, () => {
      fetchData();
      setRunTriggered(false);
    });
  }, [teamId, subscribeRefetch, fetchData]);

  const loadMoreEvents = useCallback(async () => {
    if (eventsLoadingMore) return;
    setEventsLoadingMore(true);
    try {
      const res = await fetch(
        `/api/events?team=${teamId}&limit=${EVENTS_PAGE_SIZE}&offset=${events.length}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      const next = (data.events ?? []) as TimelineEvent[];
      setEvents((prev) => [...prev, ...next]);
    } finally {
      setEventsLoadingMore(false);
    }
  }, [teamId, events.length, eventsLoadingMore]);

  async function handleRunAnalysis() {
    setRunTriggered(true);
    try {
      const res = await fetch(`/api/analyze/${teamId}`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Analysis failed");
      }
    } catch (err) {
      toast.error("Analysis failed", {
        description:
          err instanceof Error ? err.message : "An unexpected error occurred.",
      });
      setRunTriggered(false);
    }
  }

  if (loading) {
    return <TeamDetailSkeleton />;
  }

  if (error || !analysis) {
    const isRunning = analyzing || error?.includes("still running");
    if (isRunning) {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="icon-sm">
                  <ArrowLeft className="size-4" />
                </Button>
              </Link>
              <h1 className="text-2xl font-bold tracking-tight">
                Team Details
              </h1>
            </div>
            <Button onClick={handleRunAnalysis} disabled>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Run Analysis
            </Button>
          </div>
          <div
            className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-3 text-sm text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="size-4 shrink-0 animate-spin" />
            <span>
              Analysis in progress — we're crunching the numbers. This page will
              refresh automatically.
            </span>
          </div>
          <TeamDetailSkeleton />
        </div>
      );
    }
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
        <div className="flex flex-col items-center justify-center gap-4 py-24">
          <AlertCircle className="size-12 text-muted-foreground" />
          <h2 className="text-lg font-semibold">No analysis yet</h2>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            {error ??
              "Run an analysis to see this team's scores, achievements, and metrics."}
          </p>
          <Button onClick={handleRunAnalysis} disabled={analyzing}>
            <RefreshCw className="mr-2 size-4" />
            Run Analysis
          </Button>
        </div>
      </div>
    );
  }

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
            <h1 className="text-2xl font-bold tracking-tight">
              {analysis.team}
            </h1>
            {memberNames.length > 0 ? (
              <p className="text-sm text-muted-foreground">
                {memberNames
                  .map((m) =>
                    [m.firstName, m.lastName].filter(Boolean).join(" "),
                  )
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
              )}{" "}
              &middot; Last analyzed:{" "}
              {new Date(analysis.analyzedAt).toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TeamLinksDropdown
            teamId={teamId}
            repoUrl={repoUrl}
            slackChannelId={slackChannelId}
            appUrl={appUrl}
          />
          <GiveAwardDialog
            teamId={teamId}
            unlockedAchievementIds={(analysis.achievements ?? []).map(
              (a: { id: string }) => a.id,
            )}
            onAwarded={fetchData}
          />
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

      {/* Top row: Score Breakdown + Achievements */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ScoreBreakdown breakdown={analysis.score} />
        <AchievementWall
          unlocked={analysis.achievements}
          teamId={analysis.teamId}
          showLocked={true}
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
        score={Math.round(analysis.totalScore)}
        compliance={analysis.featuresCompliance}
      />

      {/* Timeline */}
      <TeamTimeline
        events={events}
        hasMore={events.length < eventsTotal}
        loadingMore={eventsLoadingMore}
        onLoadMore={loadMoreEvents}
      />
    </div>
  );
}
