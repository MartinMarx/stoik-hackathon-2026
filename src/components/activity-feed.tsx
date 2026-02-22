"use client";

import {
  Activity,
  GitCommit,
  Trophy,
  Star,
  BarChart3,
  TrendingUp,
} from "lucide-react";
import type { TimelineEvent } from "@/types";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const EVENT_CONFIG: Record<
  TimelineEvent["type"],
  { icon: typeof GitCommit; className: string; label: string }
> = {
  commit: {
    icon: GitCommit,
    className: "text-blue-500 bg-blue-500/10",
    label: "Commit",
  },
  achievement: {
    icon: Trophy,
    className: "text-yellow-500 bg-yellow-500/10",
    label: "Achievement",
  },
  feature_completed: {
    icon: Star,
    className: "text-green-500 bg-green-500/10",
    label: "Feature",
  },
  analysis: {
    icon: BarChart3,
    className: "text-purple-500 bg-purple-500/10",
    label: "Analysis",
  },
  score_change: {
    icon: TrendingUp,
    className: "text-orange-500 bg-orange-500/10",
    label: "Score",
  },
};

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(dateStr).toLocaleDateString();
}

function getEventDescription(event: TimelineEvent): string {
  const data = event.data;

  switch (event.type) {
    case "commit": {
      const message =
        typeof data.message === "string" ? data.message : "pushed a commit";
      return message.length > 60 ? message.substring(0, 60) + "..." : message;
    }
    case "achievement": {
      const name =
        typeof data.achievementName === "string"
          ? data.achievementName
          : "an achievement";
      return `Unlocked "${name}"`;
    }
    case "feature_completed": {
      const title =
        typeof data.featureTitle === "string" ? data.featureTitle : "a feature";
      return `Completed "${title}"`;
    }
    case "analysis":
      return "Analysis completed";
    case "score_change": {
      const delta =
        typeof data.delta === "number"
          ? data.delta
          : event.points !== null
            ? event.points
            : null;
      if (delta !== null) {
        if (delta > 0) return `Score +${delta}`;
        if (delta < 0) return `Score ${delta}`;
        return "No score change";
      }
      return "Score updated";
    }
    default:
      return "Event recorded";
  }
}

interface ActivityFeedProps {
  events: TimelineEvent[];
}

export function ActivityFeed({ events }: ActivityFeedProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="size-5 text-blue-500" />
          Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            No activity yet
          </p>
        ) : (
          <div className="max-h-[480px] overflow-y-auto pr-1">
            <div className="relative space-y-0">
              {/* Vertical timeline line */}
              <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

              {events.map((event) => {
                const config = EVENT_CONFIG[event.type];
                const Icon = config.icon;

                return (
                  <div key={event.id} className="relative flex gap-3 py-2.5">
                    {/* Icon dot */}
                    <div
                      className={cn(
                        "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full",
                        config.className,
                      )}
                    >
                      <Icon className="size-3.5" />
                    </div>

                    {/* Content */}
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0"
                        >
                          {event.teamName}
                        </Badge>
                        {event.type === "score_change" &&
                          event.points !== null && (
                            <span
                              className={cn(
                                "text-xs font-medium",
                                event.points > 0
                                  ? "text-green-500"
                                  : event.points < 0
                                    ? "text-red-500"
                                    : "text-muted-foreground",
                              )}
                            >
                              {event.points !== 0
                                ? `${event.points > 0 ? "+" : ""}${event.points} pts`
                                : "No score change"}
                            </span>
                          )}
                      </div>
                      <p className="text-sm text-foreground leading-snug">
                        {getEventDescription(event)}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(event.createdAt)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
