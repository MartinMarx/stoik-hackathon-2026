"use client";

import { useState } from "react";
import type { AIReviewResult, FeatureComplianceResult } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Bot,
  BookOpen,
  Lightbulb,
  Sparkles,
  Star,
  Send,
  Loader2,
  Zap,
  Shield,
  Blocks,
  ListChecks,
  TestTube2,
  FileText,
  Accessibility,
  Palette,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { GAME_RULES_CHECKLIST } from "@/lib/game-rules";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AIAnalysisProps {
  review: AIReviewResult;
  teamId?: string;
  teamName?: string;
  score?: number;
  compliance?: FeatureComplianceResult[];
}

const statusConfig = {
  complete: {
    label: "Complete",
    className:
      "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  },
  partial: {
    label: "Partial",
    className:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  },
  missing: {
    label: "Missing",
    className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  },
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
  performance: {
    label: "Performance",
    icon: Zap,
    className:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  },
  security: {
    label: "Security",
    icon: Shield,
    className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
  structure: {
    label: "Structure",
    icon: Blocks,
    className:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  },
  testing: {
    label: "Testing",
    icon: TestTube2,
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  documentation: {
    label: "Docs",
    icon: FileText,
    className: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  },
  accessibility: {
    label: "A11y",
    icon: Accessibility,
    className:
      "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  },
  ux: {
    label: "UX",
    icon: Palette,
    className:
      "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
  },
  general: {
    label: "General",
    icon: Lightbulb,
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
};

function categorizeRecommendation(text: string): RecommendationCategory {
  const lower = text.toLowerCase();
  if (
    lower.includes("performance") ||
    lower.includes("optimize") ||
    lower.includes("cache") ||
    lower.includes("lazy") ||
    lower.includes("bundle") ||
    lower.includes("fast")
  )
    return "performance";
  if (
    lower.includes("security") ||
    lower.includes("auth") ||
    lower.includes("sanitiz") ||
    lower.includes("xss") ||
    lower.includes("csrf") ||
    lower.includes("vulnerab")
  )
    return "security";
  if (
    lower.includes("test") ||
    lower.includes("coverage") ||
    lower.includes("spec") ||
    lower.includes("jest") ||
    lower.includes("vitest")
  )
    return "testing";
  if (
    lower.includes("document") ||
    lower.includes("readme") ||
    lower.includes("comment") ||
    lower.includes("jsdoc")
  )
    return "documentation";
  if (
    lower.includes("accessib") ||
    lower.includes("aria") ||
    lower.includes("a11y") ||
    lower.includes("screen reader")
  )
    return "accessibility";
  if (
    lower.includes("structure") ||
    lower.includes("refactor") ||
    lower.includes("organiz") ||
    lower.includes("architect") ||
    lower.includes("modular") ||
    lower.includes("pattern")
  )
    return "structure";
  if (
    lower.includes("ux") ||
    lower.includes("ui") ||
    lower.includes("design") ||
    lower.includes("responsive") ||
    lower.includes("layout") ||
    lower.includes("user experience")
  )
    return "ux";
  return "general";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type StatusFilter = "all" | "complete" | "partial" | "missing";
type SourceFilter = "all" | "rule" | "bonus";

interface UnifiedRow {
  title: string;
  rule: string;
  source: "rule" | "bonus";
  status: "complete" | "partial" | "missing";
  confidence: number;
  details?: string;
  criteria?: string[];
}

export function AIAnalysis({
  review,
  teamId,
  teamName,
  score,
  compliance,
}: AIAnalysisProps) {
  const [sharingToSlack, setSharingToSlack] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

  if (!review) return null;

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
            recommendations: review.recommendations.slice(0, 5),
            score: score ?? 0,
          },
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to share recommendations");
      }

      const publicUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/public/teams/${teamId}`
          : "";
      toast.success("Recommendations shared", {
        description: "Recommendations posted to the team's Slack channel.",
        ...(publicUrl && {
          action: {
            label: "View team page",
            onClick: () => window.open(publicUrl, "_blank"),
          },
        }),
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

        {/* Unified Implementation Status */}
        {(() => {
          const ruleRows: UnifiedRow[] = review.rulesImplemented.map(
            (r, idx) => {
              const def =
                GAME_RULES_CHECKLIST.find((d) => d.id === r.ruleId) ??
                GAME_RULES_CHECKLIST[idx];
              return {
                title: def?.rule ?? r.rule,
                rule: def?.description ?? "",
                source: "rule" as const,
                status: r.status,
                confidence: r.confidence,
                details: r.details,
                criteria: def?.criteria,
              };
            },
          );

          const bonusRows: UnifiedRow[] = (compliance ?? []).map((f) => ({
            title: f.featureTitle,
            rule: f.featureDescription ?? "",
            source: "bonus" as const,
            status: f.status === "implemented" ? "complete" : f.status,
            confidence: f.confidence,
            details: f.details,
            criteria: f.criteria,
          }));

          const allRows = [...ruleRows, ...bonusRows];

          const afterSource =
            sourceFilter === "all"
              ? allRows
              : allRows.filter((r) => r.source === sourceFilter);

          const filteredRows =
            statusFilter === "all"
              ? afterSource
              : afterSource.filter((r) => r.status === statusFilter);

          const counts = {
            all: afterSource.length,
            complete: afterSource.filter((r) => r.status === "complete").length,
            partial: afterSource.filter((r) => r.status === "partial").length,
            missing: afterSource.filter((r) => r.status === "missing").length,
          };

          return (
            <div>
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <ListChecks className="size-4 text-muted-foreground" />
                Implementation Status
              </h4>

              <div className="mb-4 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Source
                  </span>
                  <ToggleGroup
                    type="single"
                    value={sourceFilter}
                    onValueChange={(v) => {
                      if (v) setSourceFilter(v as SourceFilter);
                    }}
                    size="sm"
                  >
                    <ToggleGroupItem value="all" className="gap-1.5 text-xs">
                      All ({allRows.length})
                    </ToggleGroupItem>
                    <ToggleGroupItem value="rule" className="gap-1.5 text-xs">
                      <BookOpen className="size-3" />
                      Game Rules ({ruleRows.length})
                    </ToggleGroupItem>
                    <ToggleGroupItem value="bonus" className="gap-1.5 text-xs">
                      <Sparkles className="size-3" />
                      Bonus ({bonusRows.length})
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Status
                  </span>
                  <Select
                    value={statusFilter}
                    onValueChange={(v) => setStatusFilter(v as StatusFilter)}
                  >
                    <SelectTrigger size="sm" className="w-[140px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All ({counts.all})</SelectItem>
                      <SelectItem value="complete">
                        Complete ({counts.complete})
                      </SelectItem>
                      <SelectItem value="partial">
                        Partial ({counts.partial})
                      </SelectItem>
                      <SelectItem value="missing">
                        Missing ({counts.missing})
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {filteredRows.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No items to display.
                </p>
              ) : (
                <TooltipProvider>
                  <Table className="table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">Source</TableHead>
                        <TableHead>Title &amp; rule</TableHead>
                        <TableHead className="min-w-[180px]">
                          Acceptance criteria
                        </TableHead>
                        <TableHead className="w-40">
                          Status &amp; confidence
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRows.map((row, i) => {
                        const config = statusConfig[row.status];
                        const confidencePct = Math.round(row.confidence * 100);
                        return (
                          <TableRow key={`${row.source}-${row.title}-${i}`}>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] px-1.5",
                                  row.source === "rule"
                                    ? "border-blue-200 text-blue-600 dark:border-blue-800 dark:text-blue-400"
                                    : "border-amber-200 text-amber-600 dark:border-amber-800 dark:text-amber-400",
                                )}
                              >
                                {row.source === "rule" ? "Rule" : "Bonus"}
                              </Badge>
                            </TableCell>
                            <TableCell className="whitespace-normal">
                              <p className="text-sm font-medium leading-snug">
                                {row.title}
                              </p>
                              {row.rule ? (
                                <p className="mt-0.5 text-xs text-muted-foreground leading-snug">
                                  {row.rule}
                                </p>
                              ) : null}
                            </TableCell>
                            <TableCell className="whitespace-normal">
                              {row.criteria && row.criteria.length > 0 ? (
                                <ul className="list-inside list-disc text-xs leading-snug text-muted-foreground">
                                  {row.criteria.map((c, j) => (
                                    <li key={j}>{c}</li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  —
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex cursor-help flex-wrap items-center gap-1.5">
                                    <Badge
                                      variant="secondary"
                                      className={cn(
                                        "text-xs",
                                        config.className,
                                      )}
                                    >
                                      {config.label}
                                    </Badge>
                                    <span className="tabular-nums text-xs font-medium text-muted-foreground">
                                      {confidencePct}%
                                    </span>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent
                                  side="left"
                                  className="max-w-sm whitespace-pre-wrap px-3 py-2 text-left text-sm"
                                >
                                  {row.details ?? "No LLM reasoning recorded."}
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TooltipProvider>
              )}
            </div>
          );
        })()}

        {/* Recommendations — redesigned with cards */}
        {review.recommendations.length > 0 && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h4 className="flex items-center gap-2 text-sm font-semibold">
                <Lightbulb className="size-4 text-yellow-500" />
                Recommendations ({Math.min(5, review.recommendations.length)})
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
              {review.recommendations.slice(0, 5).map((rec, i) => {
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
      </CardContent>
    </Card>
  );
}
