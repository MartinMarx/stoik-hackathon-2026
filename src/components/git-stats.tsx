"use client";

import type { GitMetrics } from "@/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GitCommitHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

interface GitStatsProps {
  metrics: GitMetrics;
}

export function GitStats({ metrics }: GitStatsProps) {
  // Compute commits by hour (0-23)
  const hourCounts: number[] = Array.from({ length: 24 }, (_, i) => {
    return metrics.commitsByHour[i] ?? 0;
  });
  const maxHourCount = Math.max(...hourCounts, 1);

  // Compute contributor commit counts
  const contributorCounts: Record<string, number> = {};
  for (const commit of metrics.commits) {
    contributorCounts[commit.author] =
      (contributorCounts[commit.author] ?? 0) + 1;
  }
  const sortedContributors = Object.entries(contributorCounts)
    .sort(([, a], [, b]) => b - a);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitCommitHorizontal className="size-5 text-muted-foreground" />
          Git Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Commits</p>
            <p className="text-2xl font-bold tabular-nums">
              {metrics.totalCommits}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Contributors</p>
            <p className="text-2xl font-bold tabular-nums">
              {metrics.authors.length}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Additions</p>
            <p className="text-2xl font-bold tabular-nums text-green-600">
              +{metrics.additions.toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Deletions</p>
            <p className="text-2xl font-bold tabular-nums text-red-600">
              -{metrics.deletions.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Contributors list */}
        {sortedContributors.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-semibold">Contributors</h4>
            <div className="space-y-1.5">
              {sortedContributors.map(([author, count]) => (
                <div
                  key={author}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="truncate">{author}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {count} commits
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Commits by hour mini chart */}
        <div>
          <h4 className="mb-3 text-sm font-semibold">Commits by Hour</h4>
          <div className="flex items-end gap-[2px]" style={{ height: 64 }}>
            {hourCounts.map((count, hour) => {
              const heightPct = maxHourCount > 0 ? (count / maxHourCount) * 100 : 0;
              return (
                <div
                  key={hour}
                  className="group relative flex flex-1 flex-col items-center"
                  style={{ height: "100%" }}
                >
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className={cn(
                        "w-full rounded-t-sm transition-all",
                        count > 0
                          ? "bg-orange-500 hover:bg-orange-400"
                          : "bg-muted",
                      )}
                      style={{
                        height: `${Math.max(heightPct, count > 0 ? 8 : 2)}%`,
                      }}
                      title={`${hour}:00 - ${count} commits`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>0h</span>
            <span>6h</span>
            <span>12h</span>
            <span>18h</span>
            <span>23h</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
