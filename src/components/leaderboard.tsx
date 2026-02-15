"use client";

import Link from "next/link";
import { Trophy } from "lucide-react";
import type { LeaderboardEntry } from "@/types";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const RANK_MEDALS: Record<number, string> = {
  1: "\u{1F947}",
  2: "\u{1F948}",
  3: "\u{1F949}",
};

const TREND_DISPLAY: Record<
  "up" | "down" | "stable",
  { icon: string; className: string }
> = {
  up: { icon: "\u2197\uFE0F", className: "text-green-500" },
  down: { icon: "\u2198\uFE0F", className: "text-red-500" },
  stable: { icon: "\u27A1\uFE0F", className: "text-muted-foreground" },
};

// Max possible score for progress bar scaling (100 base + potential bonus)
const MAX_SCORE = 120;

interface LeaderboardProps {
  entries: LeaderboardEntry[];
}

export function Leaderboard({ entries }: LeaderboardProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="size-5 text-yellow-500" />
          Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            No teams ranked yet
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="w-48">Score</TableHead>
                <TableHead className="w-16 text-center">Trend</TableHead>
                <TableHead className="w-32 text-right">Achievements</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => {
                const medal = RANK_MEDALS[entry.rank];
                const trend = TREND_DISPLAY[entry.trend];
                const progressValue = Math.min(
                  (entry.totalScore / MAX_SCORE) * 100,
                  100
                );
                const lastAchievements = entry.achievements.slice(-3);

                return (
                  <TableRow key={entry.teamId}>
                    {/* Rank */}
                    <TableCell className="font-medium">
                      {medal ? (
                        <span className="text-lg">{medal}</span>
                      ) : (
                        <span className="text-muted-foreground">
                          {entry.rank}
                        </span>
                      )}
                    </TableCell>

                    {/* Team Name */}
                    <TableCell>
                      <Link
                        href={`/teams/${entry.teamId}`}
                        className="font-medium hover:underline"
                      >
                        {entry.team}
                      </Link>
                    </TableCell>

                    {/* Score + Progress */}
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-semibold tabular-nums">
                          {entry.totalScore}
                        </span>
                        <Progress value={progressValue} className="h-1.5" />
                      </div>
                    </TableCell>

                    {/* Trend */}
                    <TableCell className="text-center">
                      <span
                        className={cn("text-sm", trend.className)}
                        title={
                          entry.previousRank
                            ? `Previously #${entry.previousRank}`
                            : "No previous rank"
                        }
                      >
                        {trend.icon}
                      </span>
                    </TableCell>

                    {/* Last 3 Achievements */}
                    <TableCell className="text-right">
                      {lastAchievements.length === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          None
                        </span>
                      ) : (
                        <TooltipProvider delayDuration={200}>
                          <div className="flex items-center justify-end gap-1">
                            {lastAchievements.map((achievement) => (
                              <Tooltip key={achievement.id}>
                                <TooltipTrigger asChild>
                                  <Badge
                                    variant="secondary"
                                    className="cursor-default px-1.5 py-0.5 text-xs"
                                  >
                                    {achievement.icon}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="font-medium">
                                    {achievement.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {achievement.description}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            ))}
                          </div>
                        </TooltipProvider>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
