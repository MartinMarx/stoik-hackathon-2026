"use client";

import type { AIReviewResult } from "@/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Bot, Bug, Lightbulb, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface AIAnalysisProps {
  review: AIReviewResult;
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

export function AIAnalysis({ review }: AIAnalysisProps) {
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

        {/* Recommendations */}
        {review.recommendations.length > 0 && (
          <div>
            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Lightbulb className="size-4 text-yellow-500" />
              Recommendations
            </h4>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {review.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 block size-1.5 shrink-0 rounded-full bg-muted-foreground" />
                  {rec}
                </li>
              ))}
            </ul>
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
