"use client";

import type { ScoreBreakdown } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Trophy } from "lucide-react";

interface ScoreBreakdownProps {
  breakdown: ScoreBreakdown;
  maxScore?: number;
}

const categories = [
  {
    key: "implementation",
    label: "Implementation",
    max: 40,
    color: "bg-blue-500",
  },
  { key: "codeQuality", label: "Code Quality", max: 20, color: "bg-green-500" },
  {
    key: "gitActivity",
    label: "Git Activity",
    max: 10,
    color: "bg-orange-500",
  },
  { key: "cursorActivity", label: "Agentic", max: 30, color: "bg-purple-500" },
] as const;

export function ScoreBreakdown({ breakdown, maxScore }: ScoreBreakdownProps) {
  if (!breakdown) return null;

  const baseMax = categories.reduce((sum, c) => sum + c.max, 0);
  const bonusAnnounced = breakdown.bonusFeatures?.announced ?? 0;
  const totalMax = maxScore ?? baseMax + bonusAnnounced;
  const totalScore = Math.round(
    categories.reduce((sum, c) => sum + (breakdown[c.key]?.total ?? 0), 0),
  );
  const bonusTotal = Math.round(breakdown.bonusFeatures?.total ?? 0);
  const achievementBonusTotal = breakdown.achievementBonus?.total ?? 0;
  const achievementCount = breakdown.achievementBonus?.count ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="size-5 text-muted-foreground" />
          Score Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {categories.map(({ key, label, max, color }) => {
          const cat = breakdown[key];
          const score = Math.round(cat?.total ?? 0);
          const pct = Math.min((score / max) * 100, 100);
          return (
            <div key={key} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {score}/{max}
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${color}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}

        {bonusAnnounced > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Bonus Features</span>
              <span className="tabular-nums text-muted-foreground">
                {bonusTotal}/{bonusAnnounced}
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-yellow-500 transition-all"
                style={{
                  width: `${Math.min((bonusTotal / bonusAnnounced) * 100, 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {achievementCount > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 font-medium">
              <Trophy className="size-4 text-amber-500" />
              Achievements
            </span>
            <span className="tabular-nums text-muted-foreground">
              +{achievementBonusTotal}
              <span className="ml-1 font-normal">
                from {achievementCount} achievement
                {achievementCount !== 1 ? "s" : ""}
              </span>
            </span>
          </div>
        )}

        <div className="flex items-center justify-between border-t pt-4">
          <span className="text-sm font-semibold">Total</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold tabular-nums">
              {totalScore + bonusTotal}
              <span className="text-sm font-normal text-muted-foreground">
                /{totalMax}
              </span>
            </span>
            {achievementBonusTotal > 0 && (
              <span className="text-sm font-medium tabular-nums text-amber-500">
                +{achievementBonusTotal}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
