"use client";

import type { ScoreBreakdown } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

interface ScoreBreakdownProps {
  breakdown: ScoreBreakdown;
}

const categories = [
  {
    key: "implementation",
    label: "Implementation",
    max: 35,
    color: "bg-blue-500",
  },
  { key: "agentic", label: "Agentic", max: 25, color: "bg-purple-500" },
  { key: "codeQuality", label: "Code Quality", max: 15, color: "bg-green-500" },
  {
    key: "gitActivity",
    label: "Git Activity",
    max: 10,
    color: "bg-orange-500",
  },
  { key: "cursorUsage", label: "Cursor Usage", max: 15, color: "bg-cyan-500" },
] as const;

export function ScoreBreakdown({ breakdown }: ScoreBreakdownProps) {
  if (!breakdown) return null;

  const totalMax = categories.reduce((sum, c) => sum + c.max, 0);
  const totalScore = Math.round(
    categories.reduce((sum, c) => sum + (breakdown[c.key]?.total ?? 0), 0),
  );
  const bonusTotal = Math.round(breakdown.bonusFeatures?.total ?? 0);

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
          const score = Math.round(breakdown[key]?.total ?? 0);
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

        {bonusTotal > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Bonus Features</span>
              <span className="tabular-nums text-muted-foreground">
                +{bonusTotal}
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-yellow-500 transition-all"
                style={{ width: `${Math.min(bonusTotal * 10, 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between border-t pt-4">
          <span className="text-sm font-semibold">Total</span>
          <span className="text-lg font-bold tabular-nums">
            {totalScore + bonusTotal}
            <span className="text-sm font-normal text-muted-foreground">
              /{totalMax}
              {bonusTotal > 0 && ` +${bonusTotal}`}
            </span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
