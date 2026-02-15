"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { TimelineEvent } from "@/types";
import type { AchievementRarity } from "@/types";
import { cn } from "@/lib/utils";
import { Trophy } from "lucide-react";

// ── Constants ────────────────────────────────────────────────────────────────

const NOTIFICATION_DURATION = 10_000; // 10 seconds

const RARITY_STYLES: Record<
  AchievementRarity,
  { border: string; shadow: string; label: string; labelClass: string }
> = {
  common: {
    border: "border-zinc-400/40",
    shadow: "",
    label: "Common",
    labelClass: "text-zinc-400",
  },
  rare: {
    border: "border-blue-400/60",
    shadow: "shadow-[0_0_20px_rgba(96,165,250,0.25)]",
    label: "Rare",
    labelClass: "text-blue-400",
  },
  epic: {
    border: "border-purple-400/60",
    shadow: "shadow-[0_0_25px_rgba(192,132,252,0.3)]",
    label: "Epic",
    labelClass: "text-purple-400",
  },
  legendary: {
    border: "border-yellow-400/70",
    shadow: "shadow-[0_0_30px_rgba(250,204,21,0.35)]",
    label: "Legendary",
    labelClass: "text-yellow-400",
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

      newNotifications.push({
        eventId: event.id,
        teamName: event.teamName,
        achievementName,
        achievementIcon,
        rarity,
        expiresAt: now + NOTIFICATION_DURATION,
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
    <div className="flex h-full flex-col gap-2 overflow-hidden">
      <h2 className="flex shrink-0 items-center gap-2 text-xl font-semibold tracking-tight text-muted-foreground lg:text-2xl">
        <Trophy className="size-5 text-yellow-400 lg:size-6" />
        Achievements
      </h2>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
        <AnimatePresence mode="popLayout">
          {notifications.map((notification) => {
            const style = RARITY_STYLES[notification.rarity];

            return (
              <motion.div
                key={notification.eventId}
                layout
                initial={{ opacity: 0, x: 80, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 80, scale: 0.9 }}
                transition={{
                  layout: { type: "spring", stiffness: 300, damping: 30 },
                  opacity: { duration: 0.35 },
                  scale: { type: "spring", stiffness: 400, damping: 25 },
                }}
                className={cn(
                  "relative overflow-hidden rounded-xl border-2 bg-card/80 p-4 backdrop-blur-sm lg:p-5",
                  style.border,
                  style.shadow,
                )}
              >
                {/* Rarity glow background effect */}
                {notification.rarity === "legendary" && (
                  <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/5 via-amber-500/10 to-yellow-500/5" />
                )}
                {notification.rarity === "epic" && (
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-violet-500/8 to-purple-500/5" />
                )}

                <div className="relative flex items-start gap-4">
                  {/* Large emoji icon */}
                  <div className="flex shrink-0 items-center justify-center">
                    <span className="text-4xl lg:text-5xl">
                      {notification.achievementIcon}
                    </span>
                  </div>

                  {/* Text content */}
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                      {notification.teamName}
                    </span>
                    <span className="truncate text-lg font-bold lg:text-xl">
                      {notification.achievementName}
                    </span>
                    <span
                      className={cn(
                        "text-xs font-semibold uppercase tracking-widest",
                        style.labelClass,
                      )}
                    >
                      {style.label}
                    </span>
                  </div>
                </div>

                {/* Expiry progress bar */}
                <ExpiryBar expiresAt={notification.expiresAt} />
              </motion.div>
            );
          })}
        </AnimatePresence>

        {notifications.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <Trophy className="size-12 opacity-20" />
            <p className="text-lg">Waiting for achievements...</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Expiry progress bar ──────────────────────────────────────────────────────

function ExpiryBar({ expiresAt }: { expiresAt: number }) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const startTime = expiresAt - NOTIFICATION_DURATION;
    const totalDuration = NOTIFICATION_DURATION;

    const tick = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const remaining = Math.max(0, 100 - (elapsed / totalDuration) * 100);
      setProgress(remaining);
    };

    tick();
    const interval = setInterval(tick, 50);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <div className="mt-3 h-0.5 w-full overflow-hidden rounded-full bg-muted/30">
      <div
        className="h-full rounded-full bg-foreground/20 transition-[width] duration-100 ease-linear"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
