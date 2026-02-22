"use client";

import type { ScoreBreakdown } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Trophy } from "lucide-react";

interface ScoreBreakdownProps {
  breakdown: ScoreBreakdown;
}

const categories = [
  {
    key: "implementation",
    label: "Implementation",
    max: 40,
    color: "bg-blue-500",
    subLabels: [
      { key: "rulesComplete", label: "Rules complete" },
      { key: "rulesPartial", label: "Rules partial" },
      { key: "creative", label: "Creative" },
    ],
  },
  {
    key: "codeQuality",
    label: "Code Quality",
    max: 20,
    color: "bg-green-500",
    subLabels: [
      { key: "typescript", label: "TypeScript" },
      { key: "tests", label: "Tests" },
      { key: "structure", label: "Structure" },
    ],
  },
  {
    key: "gitActivity",
    label: "Git Activity",
    max: 10,
    color: "bg-orange-500",
    subLabels: [
      { key: "commits", label: "Commits" },
      { key: "contributors", label: "Contributors" },
      { key: "regularity", label: "Regularity" },
    ],
  },
  {
    key: "cursorActivity",
    label: "Agentic",
    max: 30,
    color: "bg-purple-500",
    subLabels: [
      { key: "rules", label: "Rules" },
      { key: "skills", label: "Skills" },
      { key: "commands", label: "Commands" },
      { key: "prompts", label: "Prompts" },
      { key: "toolDiversity", label: "Tools" },
      { key: "sessions", label: "Sessions" },
      { key: "models", label: "Models" },
    ],
  },
] as const;

export function ScoreBreakdown({ breakdown }: ScoreBreakdownProps) {
  if (!breakdown) return null;

  const totalMax = categories.reduce((sum, c) => sum + c.max, 0);
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
        {categories.map(({ key, label, max, color, subLabels }) => {
          const cat = breakdown[key];
          const score = Math.round(cat?.total ?? 0);
          const pct = Math.min((score / max) * 100, 100);
          const subParts =
            cat && subLabels
              ? subLabels
                  .map(
                    (s) =>
                      `${s.label}: ${Math.round((cat as Record<string, number>)[s.key] ?? 0)}`,
                  )
                  .join(", ")
              : null;
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
              {subParts && (
                <p className="text-xs text-muted-foreground">{subParts}</p>
              )}
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
          <span className="text-lg font-bold tabular-nums">
            {totalScore + bonusTotal + achievementBonusTotal}
            <span className="text-sm font-normal text-muted-foreground">
              /{totalMax}
              {bonusTotal > 0 && ` +${bonusTotal}`}
              {achievementBonusTotal > 0 && ` +${achievementBonusTotal}`}
            </span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
