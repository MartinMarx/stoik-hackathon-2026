"use client";

import { useState } from "react";
import type { AIReviewResult } from "@/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Bot,
  Bug,
  Lightbulb,
  Star,
  Send,
  Loader2,
  Zap,
  Shield,
  Blocks,
  TestTube2,
  FileText,
  Accessibility,
  Palette,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AIAnalysisProps {
  review: AIReviewResult;
  teamId?: string;
  teamName?: string;
  score?: number;
}

const statusConfig = {
  complete: { label: "Complete", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  partial: { label: "Partial", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  missing: { label: "Missing", className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
};

const severityConfig = {
  low: { label: "Low", className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  medium: { label: "Medium", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  high: { label: "High", className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
};

// ---------------------------------------------------------------------------
// Recommendation category detection (simple heuristic)
// ---------------------------------------------------------------------------

type RecommendationCategory =
  | "performance"
  | "security"
  | "structure"
  | "testing"
  | "documentation"
  | "accessibility"
  | "ux"
  | "general";

const CATEGORY_CONFIG: Record<
  RecommendationCategory,
  { label: string; icon: typeof Zap; className: string }
> = {
  performance: { label: "Performance", icon: Zap, className: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
  security: { label: "Security", icon: Shield, className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  structure: { label: "Structure", icon: Blocks, className: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
  testing: { label: "Testing", icon: TestTube2, className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  documentation: { label: "Docs", icon: FileText, className: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" },
  accessibility: { label: "A11y", icon: Accessibility, className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" },
  ux: { label: "UX", icon: Palette, className: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300" },
  general: { label: "General", icon: Lightbulb, className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
};

function categorizeRecommendation(text: string): RecommendationCategory {
  const lower = text.toLowerCase();
  if (lower.includes("performance") || lower.includes("optimize") || lower.includes("cache") || lower.includes("lazy") || lower.includes("bundle") || lower.includes("fast"))
    return "performance";
  if (lower.includes("security") || lower.includes("auth") || lower.includes("sanitiz") || lower.includes("xss") || lower.includes("csrf") || lower.includes("vulnerab"))
    return "security";
  if (lower.includes("test") || lower.includes("coverage") || lower.includes("spec") || lower.includes("jest") || lower.includes("vitest"))
    return "testing";
  if (lower.includes("document") || lower.includes("readme") || lower.includes("comment") || lower.includes("jsdoc"))
    return "documentation";
  if (lower.includes("accessib") || lower.includes("aria") || lower.includes("a11y") || lower.includes("screen reader"))
    return "accessibility";
  if (lower.includes("structure") || lower.includes("refactor") || lower.includes("organiz") || lower.includes("architect") || lower.includes("modular") || lower.includes("pattern"))
    return "structure";
  if (lower.includes("ux") || lower.includes("ui") || lower.includes("design") || lower.includes("responsive") || lower.includes("layout") || lower.includes("user experience"))
    return "ux";
  return "general";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AIAnalysis({ review, teamId, teamName, score }: AIAnalysisProps) {
  const [sharingToSlack, setSharingToSlack] = useState(false);

  async function handleShareToSlack() {
    if (!teamId || !teamName) return;

    setSharingToSlack(true);
    try {
      const res = await fetch("/api/slack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "team-recommendations",
          data: {
            teamId,
            teamName,
            recommendations: review.recommendations,
            score: score ?? 0,
          },
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to share recommendations");
      }

      toast.success("Recommendations shared", {
        description: "Recommendations posted to the team's Slack channel.",
      });
    } catch (err) {
      toast.error("Share failed", {
        description:
          err instanceof Error ? err.message : "An unexpected error occurred.",
      });
    } finally {
      setSharingToSlack(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="size-5 text-muted-foreground" />
          AI Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Code Quality Score */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Star className="size-5 text-yellow-500" />
            <span className="text-sm font-semibold">Code Quality Score</span>
          </div>
          <div className="text-3xl font-bold tabular-nums">
            {review.codeQualityScore}
            <span className="text-base font-normal text-muted-foreground">
              /15
            </span>
          </div>
        </div>

        {/* Rules implementation table */}
        <div>
          <h4 className="mb-3 text-sm font-semibold">Rules Implementation</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {review.rulesImplemented.map((rule, i) => {
                const config = statusConfig[rule.status];
                return (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{rule.rule}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn("text-xs", config.className)}
                      >
                        {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Math.round(rule.confidence * 100)}%
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Bugs list */}
        {review.bugs.length > 0 && (
          <div>
            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Bug className="size-4 text-red-500" />
              Bugs Detected ({review.bugs.length})
            </h4>
            <div className="space-y-2">
              {review.bugs.map((bug, i) => {
                const sev = severityConfig[bug.severity];
                return (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-lg border p-3"
                  >
                    <Badge
                      variant="secondary"
                      className={cn("mt-0.5 text-xs", sev.className)}
                    >
                      {sev.label}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{bug.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {bug.file}
                        {bug.line ? `:${bug.line}` : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recommendations — redesigned with cards */}
        {review.recommendations.length > 0 && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h4 className="flex items-center gap-2 text-sm font-semibold">
                <Lightbulb className="size-4 text-yellow-500" />
                Recommendations ({review.recommendations.length})
              </h4>
              {teamId && teamName && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={sharingToSlack}
                  onClick={handleShareToSlack}
                  className="gap-2"
                >
                  {sharingToSlack ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Send className="size-3.5" />
                  )}
                  Share to Slack
                </Button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {review.recommendations.map((rec, i) => {
                const category = categorizeRecommendation(rec);
                const catConfig = CATEGORY_CONFIG[category];
                const CategoryIcon = catConfig.icon;

                return (
                  <div
                    key={i}
                    className="group relative flex gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
                  >
                    {/* Numbered badge */}
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-sm leading-relaxed">{rec}</p>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "inline-flex items-center gap-1 text-xs font-medium",
                          catConfig.className,
                        )}
                      >
                        <CategoryIcon className="size-3" />
                        {catConfig.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Bonus features */}
        {review.bonusFeatures.length > 0 && (
          <div>
            <h4 className="mb-3 text-sm font-semibold">
              Bonus Features Detected
            </h4>
            <div className="flex flex-wrap gap-2">
              {review.bonusFeatures.map((feature, i) => (
                <Badge key={i} variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                  {feature}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
