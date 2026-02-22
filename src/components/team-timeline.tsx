"use client";

import { useEffect, useRef, useCallback } from "react";
import type { TimelineEvent } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  GitCommitHorizontal,
  Trophy,
  CheckCircle,
  BarChart3,
  ArrowUpDown,
  Clock,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TeamTimelineProps {
  events: TimelineEvent[];
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}

const eventTypeConfig: Record<
  string,
  { icon: React.ReactNode; color: string; label: string }
> = {
  commit: {
    icon: <GitCommitHorizontal className="size-4" />,
    color: "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300",
    label: "Commit",
  },
  achievement: {
    icon: <Trophy className="size-4" />,
    color:
      "bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-300",
    label: "Achievement",
  },
  feature_completed: {
    icon: <CheckCircle className="size-4" />,
    color: "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300",
    label: "Feature",
  },
  analysis: {
    icon: <BarChart3 className="size-4" />,
    color:
      "bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300",
    label: "Analysis",
  },
  score_change: {
    icon: <ArrowUpDown className="size-4" />,
    color: "bg-cyan-100 text-cyan-600 dark:bg-cyan-900 dark:text-cyan-300",
    label: "Score",
  },
};

function getEventDescription(event: TimelineEvent): string {
  const data = event.data;
  switch (event.type) {
    case "commit": {
      const message = (data.message as string) ?? "New commit";
      const sha = (data.sha as string) ?? "";
      return sha ? `${message} (${sha.slice(0, 7)})` : message;
    }
    case "achievement": {
      const name = (data.name as string) ?? "Achievement";
      const rarity = (data.rarity as string) ?? "";
      return rarity ? `Unlocked "${name}" (${rarity})` : `Unlocked "${name}"`;
    }
    case "feature_completed": {
      const title = (data.featureTitle as string) ?? "Feature";
      const status = (data.status as string) ?? "completed";
      return `${title} - ${status}`;
    }
    case "analysis": {
      const triggeredBy = (data.triggeredBy as string) ?? "unknown";
      return `Analysis completed (${triggeredBy})`;
    }
    case "score_change": {
      const total = (data.total as number) ?? 0;
      return `Score updated to ${total} points`;
    }
    default:
      return event.type;
  }
}

/** Delta from previous score; uses event.points (stored delta) or derives from list when previous score_change is in the same list. */
function getScoreChangeDelta(
  events: TimelineEvent[],
  index: number,
  event: TimelineEvent,
): number | null {
  if (event.type !== "score_change") return null;
  const currentTotal = (event.data.total as number) ?? 0;
  const nextScoreChange = events
    .slice(index + 1)
    .find((e) => e.type === "score_change");
  const previousTotal =
    nextScoreChange != null && typeof nextScoreChange.data.total === "number"
      ? nextScoreChange.data.total
      : null;
  if (previousTotal !== null) {
    return Math.round(currentTotal) - previousTotal;
  }
  return event.points;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TeamTimeline({
  events,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}: TeamTimelineProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || !onLoadMore) return;
    onLoadMore();
  }, [hasMore, loadingMore, onLoadMore]);

  useEffect(() => {
    if (!onLoadMore || !hasMore) return;
    const root = scrollContainerRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { root, rootMargin: "80px", threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [onLoadMore, hasMore, loadMore]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="size-5 text-muted-foreground" />
          Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No events yet.
          </p>
        ) : (
          <div
            ref={scrollContainerRef}
            className="relative max-h-[480px] overflow-y-auto pr-1"
          >
            <div className="relative space-y-0">
              <div className="absolute left-[17px] top-2 bottom-2 w-px bg-border" />

              {events.map((event, index) => {
                const config = eventTypeConfig[event.type] ?? {
                  icon: <BarChart3 className="size-4" />,
                  color: "bg-muted text-muted-foreground",
                  label: event.type,
                };
                const scoreDelta =
                  event.type === "score_change"
                    ? getScoreChangeDelta(events, index, event)
                    : null;
                const achievementPoints =
                  event.type === "achievement" &&
                  event.points != null &&
                  event.points !== 0
                    ? event.points
                    : null;

                return (
                  <div
                    key={event.id}
                    className="relative flex items-start gap-4 py-3"
                  >
                    <div
                      className={cn(
                        "relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full",
                        config.color,
                      )}
                    >
                      {config.icon}
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium">
                          {getEventDescription(event)}
                        </p>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatTime(event.createdAt)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {config.label}
                        </span>
                        {achievementPoints !== null && (
                          <span className="text-xs font-medium text-green-600">
                            +{achievementPoints} pts
                          </span>
                        )}
                        {scoreDelta !== null && (
                          <span
                            className={cn(
                              "text-xs font-medium",
                              scoreDelta > 0
                                ? "text-green-600"
                                : scoreDelta < 0
                                  ? "text-red-600"
                                  : "text-muted-foreground",
                            )}
                          >
                            {scoreDelta !== 0
                              ? `${scoreDelta > 0 ? "+" : ""}${scoreDelta} pts`
                              : "No score change"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {hasMore && (
              <div
                ref={sentinelRef}
                className="flex min-h-12 items-center justify-center py-2"
              >
                {loadingMore && (
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
