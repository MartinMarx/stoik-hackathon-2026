"use client";

import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, ArrowDown, Minus, Crown, Loader2 } from "lucide-react";
import type { LeaderboardEntry } from "@/types";
import { cn } from "@/lib/utils";

// ── Constants ────────────────────────────────────────────────────────────────

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const RANK_GRADIENTS: Record<number, { border: string; bg: string; glow: string; badge: string }> = {
  1: {
    border: "from-yellow-400 via-amber-300 to-yellow-500",
    bg: "from-yellow-500/10 via-amber-500/5 to-transparent",
    glow: "0 0 40px rgba(250, 204, 21, 0.15), 0 0 80px rgba(250, 204, 21, 0.05)",
    badge: "from-yellow-400 to-amber-500",
  },
  2: {
    border: "from-slate-300 via-gray-200 to-slate-400",
    bg: "from-slate-300/8 via-gray-200/4 to-transparent",
    glow: "0 0 30px rgba(203, 213, 225, 0.1), 0 0 60px rgba(203, 213, 225, 0.03)",
    badge: "from-slate-300 to-gray-400",
  },
  3: {
    border: "from-orange-400 via-amber-600 to-orange-500",
    bg: "from-orange-500/8 via-amber-600/4 to-transparent",
    glow: "0 0 25px rgba(251, 146, 60, 0.1), 0 0 50px rgba(251, 146, 60, 0.03)",
    badge: "from-orange-400 to-amber-600",
  },
};

// ── Component ────────────────────────────────────────────────────────────────

interface LiveLeaderboardProps {
  entries: LeaderboardEntry[];
}

export function LiveLeaderboard({ entries }: LiveLeaderboardProps) {
  const maxScore = Math.max(...entries.map((e) => e.totalScore), 1);
  const prevScoresRef = useRef<Record<string, number>>({});
  const [deltas, setDeltas] = useState<Record<string, number>>({});

  // Track score changes for delta display
  useEffect(() => {
    const newDeltas: Record<string, number> = {};
    for (const entry of entries) {
      const prev = prevScoresRef.current[entry.teamId];
      if (prev !== undefined && entry.totalScore > prev) {
        newDeltas[entry.teamId] = entry.totalScore - prev;
      }
      prevScoresRef.current[entry.teamId] = entry.totalScore;
    }
    if (Object.keys(newDeltas).length > 0) {
      setDeltas(newDeltas);
      // Clear deltas after animation
      const timeout = setTimeout(() => setDeltas({}), 3000);
      return () => clearTimeout(timeout);
    }
  }, [entries]);

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden">
      <h2 className="flex shrink-0 items-center gap-3 text-lg font-semibold uppercase tracking-[0.15em] text-white/40 lg:text-xl">
        <span className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent" />
        Leaderboard
        <span className="h-px flex-1 bg-gradient-to-l from-white/20 to-transparent" />
      </h2>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1 scrollbar-thin">
        <AnimatePresence mode="popLayout">
          {entries.map((entry, i) => {
            const barPercent = Math.min(
              (entry.totalScore / maxScore) * 100,
              100,
            );
            const barColor = CHART_COLORS[i % CHART_COLORS.length];
            const isTopThree = entry.rank >= 1 && entry.rank <= 3;
            const rankStyle = RANK_GRADIENTS[entry.rank];
            const lastAchievements = entry.achievements.slice(-6);
            const delta = deltas[entry.teamId];

            return (
              <motion.div
                key={entry.teamId}
                layout
                initial={{ opacity: 0, x: -60, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -60, scale: 0.95 }}
                transition={{
                  layout: { type: "spring", stiffness: 250, damping: 28, mass: 0.8 },
                  opacity: { duration: 0.4 },
                  scale: { type: "spring", stiffness: 300, damping: 25 },
                }}
                className="relative will-change-transform"
              >
                {/* Gradient border wrapper for top 3 */}
                <div
                  className={cn(
                    "relative overflow-hidden rounded-2xl",
                    isTopThree && "p-[1.5px]",
                  )}
                  style={
                    isTopThree && rankStyle
                      ? {
                          background: `linear-gradient(135deg, ${rankStyle.border.includes("yellow") ? "#facc15, #f59e0b, #facc15" : rankStyle.border.includes("slate") ? "#cbd5e1, #e5e7eb, #94a3b8" : "#fb923c, #d97706, #fb923c"})`,
                          boxShadow: rankStyle.glow,
                        }
                      : undefined
                  }
                >
                  <div
                    className={cn(
                      "relative overflow-hidden rounded-2xl border bg-[#12121a]/90 backdrop-blur-sm",
                      isTopThree
                        ? "border-transparent"
                        : "border-white/[0.06]",
                      entry.rank === 1 && "min-h-[120px] lg:min-h-[140px]",
                    )}
                  >
                    {/* Inner gradient glow for top 3 */}
                    {isTopThree && rankStyle && (
                      <div
                        className={cn(
                          "absolute inset-0 bg-gradient-to-r opacity-100",
                          rankStyle.bg,
                        )}
                      />
                    )}

                    {/* Card content */}
                    <div className="relative flex items-center gap-4 p-4 lg:gap-5 lg:p-5">
                      {/* Rank badge */}
                      <div className="flex w-14 shrink-0 flex-col items-center justify-center gap-1 lg:w-16">
                        {entry.rank === 1 && (
                          <Crown
                            className="size-6 text-yellow-400 lg:size-7"
                            style={{ animation: "crown-float 3s ease-in-out infinite" }}
                          />
                        )}
                        <div
                          className={cn(
                            "flex size-10 items-center justify-center rounded-xl font-mono text-xl font-black lg:size-12 lg:text-2xl",
                            isTopThree && rankStyle
                              ? "text-white"
                              : "bg-white/[0.06] text-white/50",
                          )}
                          style={
                            isTopThree && rankStyle
                              ? {
                                  background: `linear-gradient(135deg, ${rankStyle.badge.includes("yellow") ? "#facc15, #d97706" : rankStyle.badge.includes("slate") ? "#cbd5e1, #94a3b8" : "#fb923c, #b45309"})`,
                                }
                              : undefined
                          }
                        >
                          {entry.rank}
                        </div>
                      </div>

                      {/* Team info */}
                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        {/* Name + Score row */}
                        <div className="flex items-center justify-between gap-3">
                          <span
                            className={cn(
                              "truncate font-bold tracking-tight",
                              entry.rank === 1
                                ? "text-2xl lg:text-3xl"
                                : isTopThree
                                  ? "text-xl lg:text-2xl"
                                  : "text-lg lg:text-xl",
                            )}
                          >
                            {entry.team}
                          </span>

                          <div className="flex shrink-0 items-center gap-2">
                            {/* Points delta */}
                            <AnimatePresence>
                              {delta && (
                                <motion.span
                                  initial={{ opacity: 0, y: 10, scale: 0.5 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: -20, scale: 0.5 }}
                                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                                  className="font-mono text-lg font-bold text-emerald-400 lg:text-xl"
                                  style={{ animation: "float-up 2.5s ease-out forwards 0.5s" }}
                                >
                                  +{delta}
                                </motion.span>
                              )}
                            </AnimatePresence>

                            {/* Score */}
                            <span
                              className={cn(
                                "shrink-0 font-mono font-black tabular-nums",
                                entry.rank === 1
                                  ? "text-4xl lg:text-[56px]"
                                  : isTopThree
                                    ? "text-3xl lg:text-4xl"
                                    : "text-2xl lg:text-3xl",
                                isTopThree ? "text-white" : "text-white/80",
                              )}
                            >
                              {entry.totalScore}
                            </span>
                          </div>
                        </div>

                        {/* Animated score bar with shimmer */}
                        <div className="relative h-3 w-full overflow-hidden rounded-full bg-white/[0.06] lg:h-4">
                          <motion.div
                            className="relative h-full rounded-full"
                            style={{
                              background: `linear-gradient(90deg, ${barColor}, ${barColor}dd)`,
                            }}
                            initial={{ width: 0 }}
                            animate={{ width: `${barPercent}%` }}
                            transition={{
                              type: "spring",
                              stiffness: 80,
                              damping: 18,
                              mass: 0.8,
                            }}
                          >
                            {/* Shimmer sweep effect */}
                            <div
                              className="absolute inset-0 overflow-hidden rounded-full"
                              style={{ willChange: "transform" }}
                            >
                              <div
                                className="absolute inset-0 w-full"
                                style={{
                                  background:
                                    "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)",
                                  animation: "shimmer 2.5s ease-in-out infinite",
                                  willChange: "transform",
                                }}
                              />
                            </div>
                          </motion.div>
                        </div>

                        {/* Achievements row + trend */}
                        <div className="flex items-center justify-between">
                          {/* Achievement icons */}
                          <div className="flex items-center gap-1.5">
                            {lastAchievements.length > 0 ? (
                              lastAchievements.map((a) => (
                                <span
                                  key={a.id}
                                  className="inline-flex items-center justify-center rounded-md bg-white/[0.04] px-1 py-0.5 text-base lg:text-lg"
                                  title={a.name}
                                  style={{
                                    textShadow: "0 0 8px rgba(255,255,255,0.3)",
                                  }}
                                >
                                  {a.icon}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs italic text-white/20">
                                No achievements yet
                              </span>
                            )}
                            {entry.achievements.length > 6 && (
                              <span className="ml-1 rounded-md bg-white/[0.04] px-1.5 py-0.5 text-xs font-medium text-white/40">
                                +{entry.achievements.length - 6}
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
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {entries.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <Loader2
              className="size-10 text-white/20"
              style={{ animation: "spin 2s linear infinite" }}
            />
            <p className="text-lg font-medium text-white/30">
              Waiting for teams to join the arena...
            </p>
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="inline-block size-2 rounded-full bg-white/30"
                  style={{
                    animation: `waiting-dot 1.4s ease-in-out ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
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
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-400"
      >
        <ArrowUp className="size-4 lg:size-5" />
        {previousRank !== undefined && (
          <span className="text-xs font-bold">from #{previousRank}</span>
        )}
      </motion.div>
    );
  }

  if (trend === "down") {
    return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-red-400"
      >
        <ArrowDown className="size-4 lg:size-5" />
        {previousRank !== undefined && (
          <span className="text-xs font-bold">from #{previousRank}</span>
        )}
      </motion.div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-white/20">
      <Minus className="size-4 lg:size-5" />
    </div>
  );
}
