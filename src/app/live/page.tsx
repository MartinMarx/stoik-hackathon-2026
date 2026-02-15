"use client";

import { useEffect, useState, useCallback } from "react";
import { Maximize, Minimize, Zap, Radio } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { LeaderboardEntry, TimelineEvent } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LiveLeaderboard } from "@/components/live-leaderboard";
import { LiveAchievementFeed } from "@/components/live-achievement-feed";
import { LiveActivityFeed } from "@/components/live-activity-feed";
import { Countdown } from "@/components/countdown";

const POLL_INTERVAL = 15_000;

export default function LivePage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [achievementEvents, setAchievementEvents] = useState<TimelineEvent[]>(
    [],
  );
  const [activityEvents, setActivityEvents] = useState<TimelineEvent[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ---- Data fetching --------------------------------------------------------

  const fetchData = useCallback(async () => {
    try {
      const [leaderboardRes, achievementsRes, activityRes] = await Promise.all([
        fetch("/api/leaderboard"),
        fetch("/api/events?limit=20&type=achievement"),
        fetch("/api/events?limit=15&type=score_change"),
      ]);

      if (leaderboardRes.ok) {
        const data: LeaderboardEntry[] = await leaderboardRes.json();
        setEntries(data);
      }

      if (achievementsRes.ok) {
        const data: { events: TimelineEvent[]; total: number } =
          await achievementsRes.json();
        setAchievementEvents(data.events);
      }

      if (activityRes.ok) {
        const data: { events: TimelineEvent[]; total: number } =
          await activityRes.json();
        setActivityEvents(data.events);
      }
    } catch (err) {
      console.error("Live page fetch error:", err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ---- Fullscreen -----------------------------------------------------------

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen API not supported or denied
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // ---- Keyboard shortcut: F to toggle fullscreen ----------------------------

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "f" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleFullscreen]);

  // ---- Render ---------------------------------------------------------------

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="relative shrink-0 overflow-hidden border-b border-white/[0.06]">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-950/80 via-[#0a0a0f] to-purple-950/80" />
        <div className="absolute inset-0 bg-[#0a0a0f]/60" />

        {/* Subtle bottom glow line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />

        <div className="relative flex items-center justify-between px-6 py-3 lg:px-8 lg:py-4">
          {/* Left: Countdown */}
          <div className="flex-1">
            <Countdown />
          </div>

          {/* Center: Title */}
          <div className="flex items-center gap-4">
            <Zap className="size-7 text-yellow-400 lg:size-8" style={{ filter: "drop-shadow(0 0 8px rgba(250, 204, 21, 0.4))" }} />
            <div className="flex flex-col items-center">
              <h1 className="bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-2xl font-black tracking-tight text-transparent lg:text-4xl">
                Hackathon Live
              </h1>
            </div>
            <Zap className="size-7 text-yellow-400 lg:size-8" style={{ filter: "drop-shadow(0 0 8px rgba(250, 204, 21, 0.4))" }} />
          </div>

          {/* Right: LIVE indicator + Fullscreen */}
          <div className="flex flex-1 items-center justify-end gap-3">
            {/* Live indicator */}
            <div className="flex items-center gap-2 rounded-full bg-red-500/10 px-3 py-1.5">
              <span className="relative flex size-2.5">
                <span
                  className="absolute inline-flex h-full w-full rounded-full bg-red-500"
                  style={{ animation: "live-dot 1.5s ease-in-out infinite" }}
                />
                <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
              </span>
              <Radio className="size-4 text-red-400" />
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-red-400">
                Live
              </span>
            </div>

            {/* Fullscreen toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              className="size-10 text-white/40 hover:bg-white/[0.06] hover:text-white/80"
              title="Toggle fullscreen (F)"
            >
              {isFullscreen ? (
                <Minimize className="size-5" />
              ) : (
                <Maximize className="size-5" />
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <main className="flex min-h-0 flex-1">
        {/* Left: Leaderboard (55%) */}
        <section className="flex w-full flex-col overflow-hidden border-r border-white/[0.04] p-4 md:w-[55%] lg:p-6">
          <LiveLeaderboard entries={entries} />
        </section>

        {/* Right panel (45%) - split into activity + achievements */}
        <section className="hidden w-[45%] flex-col md:flex">
          {/* Top: Recent Activity */}
          <div className="flex flex-1 flex-col overflow-hidden border-b border-white/[0.04] p-4 lg:p-6">
            <LiveActivityFeed events={activityEvents} />
          </div>

          {/* Bottom: Achievement Feed */}
          <div className="flex flex-1 flex-col overflow-hidden p-4 lg:p-6">
            <LiveAchievementFeed events={achievementEvents} />
          </div>
        </section>
      </main>
    </div>
  );
}
