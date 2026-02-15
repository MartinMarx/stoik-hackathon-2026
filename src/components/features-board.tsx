"use client";

import { Sparkles } from "lucide-react";
import type { HackathonFeature } from "@/types";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const DIFFICULTY_COLORS: Record<
  HackathonFeature["difficulty"],
  string
> = {
  easy: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20",
  medium:
    "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
  hard: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20",
};

const STATUS_VARIANTS: Record<
  HackathonFeature["status"],
  { className: string; label: string }
> = {
  draft: {
    className: "bg-muted text-muted-foreground",
    label: "Draft",
  },
  announced: {
    className:
      "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
    label: "Announced",
  },
  archived: {
    className: "bg-muted/50 text-muted-foreground/60",
    label: "Archived",
  },
};

interface FeaturesBoardProps {
  features: HackathonFeature[];
}

export function FeaturesBoard({ features }: FeaturesBoardProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-5 text-violet-500" />
          Features
        </CardTitle>
      </CardHeader>
      <CardContent>
        {features.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            No features yet
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {features.map((feature) => {
              const difficultyStyle = DIFFICULTY_COLORS[feature.difficulty];
              const statusConfig = STATUS_VARIANTS[feature.status];

              return (
                <div
                  key={feature.id}
                  className={cn(
                    "rounded-lg border p-3 transition-colors",
                    "hover:bg-accent/50"
                  )}
                >
                  {/* Header: title + badges */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="text-sm font-medium leading-snug line-clamp-2">
                      {feature.title}
                    </h4>
                    <Badge
                      variant="outline"
                      className={cn(
                        "shrink-0 text-[10px] px-1.5 py-0",
                        statusConfig.className
                      )}
                    >
                      {statusConfig.label}
                    </Badge>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                    {feature.description}
                  </p>

                  {/* Points + Difficulty */}
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {feature.points} pts
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] px-1.5 py-0",
                        difficultyStyle
                      )}
                    >
                      {feature.difficulty}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
