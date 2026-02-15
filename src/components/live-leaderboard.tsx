"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import type { LeaderboardEntry } from "@/types";
import { cn } from "@/lib/utils";

// ── Constants ────────────────────────────────────────────────────────────────

const RANK_MEDALS: Record<number, string> = {
  1: "\u{1F947}",
  2: "\u{1F948}",
  3: "\u{1F949}",
};

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

// Max possible score for bar scaling
const MAX_SCORE = 120;

// ── Component ────────────────────────────────────────────────────────────────

interface LiveLeaderboardProps {
  entries: LeaderboardEntry[];
}

export function LiveLeaderboard({ entries }: LiveLeaderboardProps) {
  const maxScore = Math.max(
    ...entries.map((e) => e.totalScore),
    MAX_SCORE,
  );

  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden">
      <h2 className="shrink-0 text-xl font-semibold tracking-tight text-muted-foreground lg:text-2xl">
        Leaderboard
      </h2>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
        <AnimatePresence mode="popLayout">
          {entries.map((entry, i) => {
            const barPercent = Math.min(
              (entry.totalScore / maxScore) * 100,
              100,
            );
            const barColor = CHART_COLORS[i % CHART_COLORS.length];
            const medal = RANK_MEDALS[entry.rank];
            const lastAchievements = entry.achievements.slice(-5);

            return (
              <motion.div
                key={entry.teamId}
                layout
                initial={{ opacity: 0, x: -40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 40 }}
                transition={{
                  layout: { type: "spring", stiffness: 300, damping: 30 },
                  opacity: { duration: 0.3 },
                }}
                className={cn(
                  "relative rounded-xl border border-border/50 bg-card/60 p-4 backdrop-blur-sm lg:p-5",
                  entry.rank <= 3 && "border-yellow-500/20 bg-card/80",
                )}
              >
                <div className="flex items-center gap-4">
                  {/* Rank */}
                  <div className="flex w-14 shrink-0 items-center justify-center lg:w-16">
                    {medal ? (
                      <span className="text-4xl lg:text-5xl">{medal}</span>
                    ) : (
                      <span className="text-2xl font-bold text-muted-foreground lg:text-3xl">
                        {entry.rank}
                      </span>
                    )}
                  </div>

                  {/* Team info */}
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    {/* Name + Score row */}
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-lg font-bold lg:text-xl">
                        {entry.team}
                      </span>
                      <span className="shrink-0 font-mono text-2xl font-bold tabular-nums lg:text-3xl">
                        {entry.totalScore}
                      </span>
                    </div>

                    {/* Animated score bar */}
                    <div className="h-3 w-full overflow-hidden rounded-full bg-muted/50 lg:h-4">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: barColor }}
                        initial={{ width: 0 }}
                        animate={{ width: `${barPercent}%` }}
                        transition={{
                          type: "spring",
                          stiffness: 100,
                          damping: 20,
                          mass: 0.8,
                        }}
                      />
                    </div>

                    {/* Achievements row + trend */}
                    <div className="flex items-center justify-between">
                      {/* Achievement icons */}
                      <div className="flex items-center gap-1.5">
                        {lastAchievements.length > 0 ? (
                          lastAchievements.map((a) => (
                            <span
                              key={a.id}
                              className="text-base lg:text-lg"
                              title={a.name}
                            >
                              {a.icon}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            No achievements yet
                          </span>
                        )}
                        {entry.achievements.length > 5 && (
                          <span className="text-xs text-muted-foreground">
                            +{entry.achievements.length - 5}
                          </span>
                        )}
                      </div>

                      {/* Trend indicator */}
                      <TrendIndicator
                        trend={entry.trend}
                        previousRank={entry.previousRank}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {entries.length === 0 && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-lg text-muted-foreground">
              Waiting for teams...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Trend indicator ──────────────────────────────────────────────────────────

function TrendIndicator({
  trend,
  previousRank,
}: {
  trend: "up" | "down" | "stable";
  previousRank?: number;
}) {
  if (trend === "up") {
    return (
      <div className="flex items-center gap-1 text-green-400">
        <ArrowUp className="size-4 lg:size-5" />
        {previousRank !== undefined && (
          <span className="text-xs font-medium">from #{previousRank}</span>
        )}
      </div>
    );
  }

  if (trend === "down") {
    return (
      <div className="flex items-center gap-1 text-red-400">
        <ArrowDown className="size-4 lg:size-5" />
        {previousRank !== undefined && (
          <span className="text-xs font-medium">from #{previousRank}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-muted-foreground">
      <Minus className="size-4 lg:size-5" />
    </div>
  );
}
