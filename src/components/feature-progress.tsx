"use client";

import { useState } from "react";
import type { FeatureComplianceResult } from "@/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeatureProgressProps {
  compliance: FeatureComplianceResult[];
}

const statusConfig = {
  implemented: { label: "Implemented", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  partial: { label: "Partial", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  missing: { label: "Missing", className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
};

type FilterValue = "all" | "implemented" | "partial" | "missing";

export function FeatureProgress({ compliance }: FeatureProgressProps) {
  const [filter, setFilter] = useState<FilterValue>("all");

  const filtered =
    filter === "all"
      ? compliance
      : compliance.filter((f) => f.status === filter);

  const counts = {
    all: compliance.length,
    implemented: compliance.filter((f) => f.status === "implemented").length,
    partial: compliance.filter((f) => f.status === "partial").length,
    missing: compliance.filter((f) => f.status === "missing").length,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListChecks className="size-5 text-muted-foreground" />
          Feature Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs
          value={filter}
          onValueChange={(v) => setFilter(v as FilterValue)}
        >
          <TabsList>
            <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
            <TabsTrigger value="implemented">
              Implemented ({counts.implemented})
            </TabsTrigger>
            <TabsTrigger value="partial">
              Partial ({counts.partial})
            </TabsTrigger>
            <TabsTrigger value="missing">
              Missing ({counts.missing})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No features to display.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Feature</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((feature) => {
                const config = statusConfig[feature.status];
                return (
                  <TableRow key={feature.featureId}>
                    <TableCell className="font-medium">
                      {feature.featureTitle}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn("text-xs", config.className)}
                      >
                        {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              feature.confidence >= 0.8
                                ? "bg-green-500"
                                : feature.confidence >= 0.5
                                  ? "bg-yellow-500"
                                  : "bg-red-500",
                            )}
                            style={{
                              width: `${Math.round(feature.confidence * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="tabular-nums text-xs text-muted-foreground">
                          {Math.round(feature.confidence * 100)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                      {feature.details ?? "-"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
