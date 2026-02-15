"use client";

import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, Activity } from "lucide-react";
import type { TimelineEvent } from "@/types";

// ── Time formatting ──────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000,
  );
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

// ── Component ────────────────────────────────────────────────────────────────

interface LiveActivityFeedProps {
  events: TimelineEvent[];
}

export function LiveActivityFeed({ events }: LiveActivityFeedProps) {
  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden">
      <h2 className="flex shrink-0 items-center gap-3 text-lg font-semibold uppercase tracking-[0.15em] text-white/40 lg:text-xl">
        <span className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent" />
        <Activity className="size-5 text-emerald-400/60 lg:size-5" />
        Recent Activity
        <span className="h-px flex-1 bg-gradient-to-l from-white/20 to-transparent" />
      </h2>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1 scrollbar-thin">
        <AnimatePresence mode="popLayout" initial={false}>
          {events.slice(0, 10).map((event) => {
            const points = event.points;
            const data = event.data;
            const description =
              typeof data.description === "string"
                ? data.description
                : typeof data.message === "string"
                  ? data.message
                  : points
                    ? `Score updated to ${typeof data.newScore === "number" ? data.newScore : "?"}`
                    : "Score change";

            return (
              <motion.div
                key={event.id}
                layout
                initial={{ opacity: 0, x: 40, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, scale: 0.95 }}
                transition={{
                  layout: { type: "spring", stiffness: 300, damping: 30 },
                  opacity: { duration: 0.3 },
                }}
                className="relative overflow-hidden rounded-lg border border-white/[0.06] bg-[#12121a]/80 backdrop-blur-sm"
              >
                <div className="flex items-center gap-3 p-3">
                  {/* Points badge */}
                  {points !== null && points > 0 && (
                    <div className="flex shrink-0 items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1">
                      <TrendingUp className="size-3.5 text-emerald-400" />
                      <span className="font-mono text-sm font-bold text-emerald-400">
                        +{points}
                      </span>
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-xs font-bold uppercase tracking-wider text-white/40">
                      {event.teamName}
                    </span>
                    <span className="truncate text-sm text-white/70">
                      {description}
                    </span>
                  </div>

                  {/* Time */}
                  <span className="shrink-0 text-xs text-white/20">
                    {timeAgo(event.createdAt)}
                  </span>
                </div>

                {/* Subtle left accent */}
                <div className="absolute bottom-0 left-0 top-0 w-[2px] bg-gradient-to-b from-emerald-400/30 to-transparent" />
              </motion.div>
            );
          })}
        </AnimatePresence>

        {events.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <Activity className="size-10 text-white/[0.08]" />
            <p className="text-center text-sm font-medium text-white/25">
              Score changes will appear here
              <br />
              as teams get analyzed
            </p>
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="inline-block size-1.5 rounded-full bg-white/20"
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
