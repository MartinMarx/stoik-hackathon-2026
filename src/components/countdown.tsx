"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface CountdownProps {
  targetTime?: string;
}

function padZero(n: number): string {
  return String(n).padStart(2, "0");
}

export function Countdown({ targetTime }: CountdownProps) {
  const [remaining, setRemaining] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
    totalMs: number;
  } | null>(null);

  useEffect(() => {
    if (!targetTime) return;

    const target = new Date(targetTime).getTime();

    const tick = () => {
      const now = Date.now();
      const diff = Math.max(0, target - now);

      const totalSeconds = Math.floor(diff / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      setRemaining({ hours, minutes, seconds, totalMs: diff });
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetTime]);

  // No target time: show LIVE badge
  if (!targetTime) {
    return (
      <div className="flex items-center gap-2">
        <span className="relative flex size-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex size-3 rounded-full bg-red-500" />
        </span>
        <Badge
          variant="destructive"
          className="px-3 py-1 text-sm font-bold tracking-widest"
        >
          LIVE
        </Badge>
      </div>
    );
  }

  // Countdown finished
  if (remaining && remaining.totalMs <= 0) {
    return (
      <div className="flex items-center gap-2">
        <span className="relative flex size-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex size-3 rounded-full bg-red-500" />
        </span>
        <span className="font-mono text-2xl font-bold tracking-wider text-red-500 lg:text-3xl">
          TIME UP
        </span>
      </div>
    );
  }

  const isUrgent = remaining !== null && remaining.totalMs < 3600_000;

  return (
    <div className="flex items-center gap-3">
      {isUrgent && (
        <span className="relative flex size-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex size-3 rounded-full bg-red-500" />
        </span>
      )}
      <span
        className={cn(
          "font-mono text-2xl font-bold tracking-wider lg:text-3xl",
          isUrgent && "animate-pulse text-red-500",
        )}
      >
        {remaining
          ? `${padZero(remaining.hours)}:${padZero(remaining.minutes)}:${padZero(remaining.seconds)}`
          : "--:--:--"}
      </span>
    </div>
  );
}
