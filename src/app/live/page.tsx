"use client";

import { useEffect, useState, useCallback } from "react";
import { Maximize, Minimize, Zap } from "lucide-react";
import type { LeaderboardEntry, TimelineEvent } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LiveLeaderboard } from "@/components/live-leaderboard";
import { LiveAchievementFeed } from "@/components/live-achievement-feed";
import { Countdown } from "@/components/countdown";

const POLL_INTERVAL = 15_000;

export default function LivePage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ---- Data fetching --------------------------------------------------------

  const fetchData = useCallback(async () => {
    try {
      const [leaderboardRes, eventsRes] = await Promise.all([
        fetch("/api/leaderboard"),
        fetch("/api/events?limit=20&type=achievement"),
      ]);

      if (leaderboardRes.ok) {
        const data: LeaderboardEntry[] = await leaderboardRes.json();
        setEntries(data);
      }

      if (eventsRes.ok) {
        const data: { events: TimelineEvent[]; total: number } =
          await eventsRes.json();
        setEvents(data.events);
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
      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <header className="flex shrink-0 items-center justify-between border-b border-border/40 bg-background/80 px-6 py-3 backdrop-blur-sm">
        {/* Left: countdown */}
        <Countdown />

        {/* Center: title */}
        <div className="flex items-center gap-3">
          <Zap className="size-7 text-yellow-400" />
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
            Hackathon Live
          </h1>
          <Zap className="size-7 text-yellow-400" />
        </div>

        {/* Right: fullscreen toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleFullscreen}
          className="size-10"
          title="Toggle fullscreen (F)"
        >
          {isFullscreen ? (
            <Minimize className="size-5" />
          ) : (
            <Maximize className="size-5" />
          )}
        </Button>
      </header>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <main className="flex min-h-0 flex-1">
        {/* Left: leaderboard (60%) */}
        <section className="flex w-[60%] flex-col overflow-hidden border-r border-border/40 p-4 lg:p-6">
          <LiveLeaderboard entries={entries} />
        </section>

        {/* Right: achievement feed (40%) */}
        <section
          className={cn(
            "flex w-[40%] flex-col overflow-hidden p-4 lg:p-6",
          )}
        >
          <LiveAchievementFeed events={events} />
        </section>
      </main>
    </div>
  );
}
