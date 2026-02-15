"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { TimelineEvent } from "@/types";
import type { AchievementRarity } from "@/types";
import { cn } from "@/lib/utils";
import { Trophy, Sparkles } from "lucide-react";

// ── Constants ────────────────────────────────────────────────────────────────

const NOTIFICATION_DURATION: Record<AchievementRarity, number> = {
  common: 10_000,
  rare: 10_000,
  epic: 12_000,
  legendary: 15_000,
};

const RARITY_CONFIG: Record<
  AchievementRarity,
  {
    label: string;
    labelColor: string;
    borderStyle: string;
    glowColor: string;
    bgGradient: string;
    animation?: string;
  }
> = {
  common: {
    label: "Common",
    labelColor: "text-zinc-400",
    borderStyle: "border-white/10",
    glowColor: "transparent",
    bgGradient: "from-white/[0.02] to-transparent",
  },
  rare: {
    label: "Rare",
    labelColor: "text-blue-400",
    borderStyle: "border-blue-400/30",
    glowColor: "rgba(96, 165, 250, 0.15)",
    bgGradient: "from-blue-500/10 via-blue-400/5 to-transparent",
    animation: "glow-pulse 3s ease-in-out infinite",
  },
  epic: {
    label: "Epic",
    labelColor: "text-purple-400",
    borderStyle: "border-purple-400/40",
    glowColor: "rgba(168, 85, 247, 0.2)",
    bgGradient: "from-purple-500/10 via-violet-400/5 to-transparent",
    animation: "pulse-border 2s ease-in-out infinite",
  },
  legendary: {
    label: "Legendary",
    labelColor: "text-yellow-400",
    borderStyle: "border-yellow-400/50",
    glowColor: "rgba(250, 204, 21, 0.25)",
    bgGradient: "from-yellow-500/10 via-amber-500/5 to-transparent",
    animation: "legendary-border 3s ease-in-out infinite",
  },
};

// ── Types ────────────────────────────────────────────────────────────────────

interface AchievementNotification {
  eventId: string;
  teamName: string;
  achievementName: string;
  achievementIcon: string;
  rarity: AchievementRarity;
  expiresAt: number;
  createdAt: number;
}

// ── Time formatting ──────────────────────────────────────────────────────────

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

// ── Component ────────────────────────────────────────────────────────────────

interface LiveAchievementFeedProps {
  events: TimelineEvent[];
}

export function LiveAchievementFeed({ events }: LiveAchievementFeedProps) {
  const [notifications, setNotifications] = useState<
    AchievementNotification[]
  >([]);
  const seenIdsRef = useRef<Set<string>>(new Set());

  // Process incoming events and create notifications for new ones
  useEffect(() => {
    const now = Date.now();
    const newNotifications: AchievementNotification[] = [];

    for (const event of events) {
      if (seenIdsRef.current.has(event.id)) continue;
      if (event.type !== "achievement") continue;

      seenIdsRef.current.add(event.id);

      const data = event.data;
      const achievementName =
        typeof data.achievementName === "string"
          ? data.achievementName
          : typeof data.name === "string"
            ? data.name
            : "Achievement Unlocked";
      const achievementIcon =
        typeof data.achievementIcon === "string"
          ? data.achievementIcon
          : typeof data.icon === "string"
            ? data.icon
            : "\u{1F3C6}";
      const rarity =
        typeof data.rarity === "string" &&
        ["common", "rare", "epic", "legendary"].includes(data.rarity)
          ? (data.rarity as AchievementRarity)
          : "common";

      const duration = NOTIFICATION_DURATION[rarity];

      newNotifications.push({
        eventId: event.id,
        teamName: event.teamName,
        achievementName,
        achievementIcon,
        rarity,
        expiresAt: now + duration,
        createdAt: new Date(event.createdAt).getTime(),
      });
    }

    if (newNotifications.length > 0) {
      setNotifications((prev) => [...newNotifications, ...prev]);
    }
  }, [events]);

  // Timer to expire old notifications
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setNotifications((prev) => prev.filter((n) => n.expiresAt > now));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden">
      <h2 className="flex shrink-0 items-center gap-3 text-lg font-semibold uppercase tracking-[0.15em] text-white/40 lg:text-xl">
        <span className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent" />
        <Trophy className="size-5 text-yellow-400/60 lg:size-5" />
        Achievements
        <span className="h-px flex-1 bg-gradient-to-l from-white/20 to-transparent" />
      </h2>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1 scrollbar-thin">
        <AnimatePresence mode="popLayout">
          {notifications.map((notification) => {
            const config = RARITY_CONFIG[notification.rarity];
            const isLegendary = notification.rarity === "legendary";
            const isEpic = notification.rarity === "epic";

            return (
              <motion.div
                key={notification.eventId}
                layout
                initial={{ opacity: 0, scale: 0.3, filter: "blur(12px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.8, filter: "blur(4px)", x: 60 }}
                transition={{
                  layout: { type: "spring", stiffness: 300, damping: 30 },
                  opacity: { duration: 0.4 },
                  scale: { type: "spring", stiffness: 350, damping: 22 },
                  filter: { duration: 0.4 },
                }}
                className="relative will-change-transform"
              >
                {/* Outer glow wrapper for legendary */}
                <div
                  className={cn(
                    "relative overflow-hidden rounded-xl",
                    isLegendary && "p-[2px]",
                    isEpic && "p-[1.5px]",
                  )}
                  style={
                    isLegendary
                      ? {
                          background:
                            "linear-gradient(135deg, #facc15, #f59e0b, #fbbf24, #facc15)",
                          animation: "legendary-border 3s ease-in-out infinite",
                        }
                      : isEpic
                        ? {
                            background:
                              "linear-gradient(135deg, #a855f7, #8b5cf6, #a855f7)",
                            animation: "pulse-border 2s ease-in-out infinite",
                          }
                        : undefined
                  }
                >
                  <div
                    className={cn(
                      "relative overflow-hidden rounded-xl border bg-[#12121a]/90 backdrop-blur-sm",
                      !isLegendary && !isEpic && config.borderStyle,
                      (isLegendary || isEpic) && "border-transparent",
                      isLegendary && "py-1",
                    )}
                    style={{
                      boxShadow:
                        config.glowColor !== "transparent"
                          ? `0 0 25px ${config.glowColor}, 0 0 50px ${config.glowColor}40`
                          : undefined,
                    }}
                  >
                    {/* Background gradient */}
                    <div
                      className={cn(
                        "absolute inset-0 bg-gradient-to-r",
                        config.bgGradient,
                      )}
                    />

                    {/* Sparkle decorations for epic/legendary */}
                    {(isLegendary || isEpic) && (
                      <>
                        <Sparkles
                          className={cn(
                            "absolute right-3 top-2 size-4",
                            isLegendary ? "text-yellow-400/40" : "text-purple-400/40",
                          )}
                          style={{
                            animation: "sparkle 2s ease-in-out infinite",
                          }}
                        />
                        <Sparkles
                          className={cn(
                            "absolute bottom-3 right-8 size-3",
                            isLegendary ? "text-amber-400/30" : "text-violet-400/30",
                          )}
                          style={{
                            animation: "sparkle 2.5s ease-in-out 0.5s infinite",
                          }}
                        />
                      </>
                    )}

                    <div className="relative flex items-start gap-3 p-3.5 lg:p-4">
                      {/* Large emoji icon with glow */}
                      <div
                        className="flex shrink-0 items-center justify-center rounded-lg bg-white/[0.04] p-2"
                        style={
                          config.glowColor !== "transparent"
                            ? {
                                boxShadow: `0 0 15px ${config.glowColor}`,
                              }
                            : undefined
                        }
                      >
                        <span
                          className={cn(
                            isLegendary
                              ? "text-4xl lg:text-5xl"
                              : "text-3xl lg:text-4xl",
                          )}
                        >
                          {notification.achievementIcon}
                        </span>
                      </div>

                      {/* Text content */}
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold uppercase tracking-wider text-white/50">
                            {notification.teamName}
                          </span>
                          <TimeAgo timestamp={notification.createdAt} />
                        </div>
                        <span
                          className={cn(
                            "truncate font-bold",
                            isLegendary
                              ? "text-lg text-yellow-200 lg:text-xl"
                              : "text-base lg:text-lg",
                          )}
                        >
                          {notification.achievementName}
                        </span>
                        <span
                          className={cn(
                            "text-xs font-bold uppercase tracking-[0.2em]",
                            config.labelColor,
                          )}
                        >
                          {config.label}
                        </span>
                      </div>
                    </div>

                    {/* Expiry progress bar */}
                    <ExpiryBar
                      expiresAt={notification.expiresAt}
                      rarity={notification.rarity}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {notifications.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <div className="relative">
              <Trophy className="size-14 text-white/[0.08]" />
              <Sparkles
                className="absolute -right-1 -top-1 size-5 text-yellow-400/20"
                style={{ animation: "sparkle 3s ease-in-out infinite" }}
              />
            </div>
            <p className="text-center text-base font-medium text-white/25">
              Achievements will appear here
              <br />
              as teams unlock them
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

// ── Time ago display ─────────────────────────────────────────────────────────

function TimeAgo({ timestamp }: { timestamp: number }) {
  const [text, setText] = useState(() => timeAgo(timestamp));

  useEffect(() => {
    const interval = setInterval(() => {
      setText(timeAgo(timestamp));
    }, 10_000);
    return () => clearInterval(interval);
  }, [timestamp]);

  return (
    <span className="shrink-0 text-xs text-white/25">
      {text}
    </span>
  );
}

// ── Expiry progress bar ──────────────────────────────────────────────────────

function ExpiryBar({
  expiresAt,
  rarity,
}: {
  expiresAt: number;
  rarity: AchievementRarity;
}) {
  const [progress, setProgress] = useState(100);
  const duration = NOTIFICATION_DURATION[rarity];

  useEffect(() => {
    const startTime = expiresAt - duration;
    const totalDuration = duration;

    const tick = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const remaining = Math.max(0, 100 - (elapsed / totalDuration) * 100);
      setProgress(remaining);
    };

    tick();
    const interval = setInterval(tick, 50);
    return () => clearInterval(interval);
  }, [expiresAt, duration]);

  const barColor =
    rarity === "legendary"
      ? "bg-gradient-to-r from-yellow-400/40 to-amber-500/40"
      : rarity === "epic"
        ? "bg-gradient-to-r from-purple-400/40 to-violet-500/40"
        : rarity === "rare"
          ? "bg-gradient-to-r from-blue-400/30 to-cyan-400/30"
          : "bg-white/10";

  return (
    <div className="h-0.5 w-full overflow-hidden bg-white/[0.03]">
      <div
        className={cn("h-full transition-[width] duration-100 ease-linear", barColor)}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
