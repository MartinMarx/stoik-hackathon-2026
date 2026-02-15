"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface CountdownProps {
  targetTime?: string;
}

function padZero(n: number): string {
  return String(n).padStart(2, "0");
}

function DigitBox({
  value,
  urgent,
}: {
  value: string;
  urgent: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-lg px-2.5 py-1.5 font-mono text-3xl font-black tabular-nums tracking-wider lg:rounded-xl lg:px-3 lg:py-2 lg:text-4xl",
        urgent
          ? "bg-red-500/20 text-red-400"
          : "bg-white/[0.06] text-white",
      )}
      style={{
        backdropFilter: "blur(12px)",
        minWidth: "2.5rem",
        textAlign: "center",
      }}
    >
      {value}
    </span>
  );
}

function ColonSeparator({ urgent }: { urgent: boolean }) {
  return (
    <span
      className={cn(
        "mx-0.5 font-mono text-3xl font-black lg:text-4xl",
        urgent ? "text-red-400" : "text-white/50",
      )}
      style={{
        animation: "colon-pulse 1.5s ease-in-out infinite",
      }}
    >
      :
    </span>
  );
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
      <div className="flex items-center gap-3">
        <span className="relative flex size-3">
          <span
            className="absolute inline-flex h-full w-full rounded-full bg-red-500"
            style={{ animation: "live-dot 1.5s ease-in-out infinite" }}
          />
          <span className="relative inline-flex size-3 rounded-full bg-red-500" />
        </span>
        <span className="rounded-md bg-red-500/20 px-3 py-1 font-mono text-sm font-bold tracking-[0.2em] text-red-400">
          LIVE
        </span>
      </div>
    );
  }

  // Countdown finished - TIME'S UP
  if (remaining && remaining.totalMs <= 0) {
    return (
      <div className="flex items-center gap-3">
        <span className="relative flex size-3">
          <span
            className="absolute inline-flex h-full w-full rounded-full bg-red-500"
            style={{ animation: "live-dot 0.8s ease-in-out infinite" }}
          />
          <span className="relative inline-flex size-3 rounded-full bg-red-500" />
        </span>
        <span
          className="font-mono text-3xl font-black tracking-wider text-red-500 lg:text-4xl"
          style={{
            animation: "times-up-pulse 1.5s ease-in-out infinite",
          }}
        >
          TIME&apos;S UP
        </span>
      </div>
    );
  }

  const isUrgent = remaining !== null && remaining.totalMs < 3600_000;
  const hoursStr = remaining ? padZero(remaining.hours) : "--";
  const minutesStr = remaining ? padZero(remaining.minutes) : "--";
  const secondsStr = remaining ? padZero(remaining.seconds) : "--";

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-xl px-2 py-1 lg:px-3 lg:py-1.5",
        isUrgent && "bg-red-500/10",
      )}
      style={
        isUrgent
          ? { animation: "urgent-glow 2s ease-in-out infinite" }
          : undefined
      }
    >
      {isUrgent && (
        <span className="relative mr-2 flex size-3">
          <span
            className="absolute inline-flex h-full w-full rounded-full bg-red-500"
            style={{ animation: "live-dot 1s ease-in-out infinite" }}
          />
          <span className="relative inline-flex size-3 rounded-full bg-red-500" />
        </span>
      )}

      <DigitBox value={hoursStr[0]} urgent={isUrgent} />
      <DigitBox value={hoursStr[1]} urgent={isUrgent} />
      <ColonSeparator urgent={isUrgent} />
      <DigitBox value={minutesStr[0]} urgent={isUrgent} />
      <DigitBox value={minutesStr[1]} urgent={isUrgent} />
      <ColonSeparator urgent={isUrgent} />
      <DigitBox value={secondsStr[0]} urgent={isUrgent} />
      <DigitBox value={secondsStr[1]} urgent={isUrgent} />
    </div>
  );
}
