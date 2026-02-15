"use client";

import type { CursorMetricsData, CursorStructure } from "@/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  MessageSquare,
  Zap,
  Monitor,
  Brain,
  Plug,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CursorMetricsProps {
  metrics: CursorMetricsData;
  structure: CursorStructure;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}

function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold tabular-nums">{value}</p>
      </div>
    </div>
  );
}

export function CursorMetrics({ metrics, structure }: CursorMetricsProps) {
  // Sort tool use breakdown by count descending, take top 8
  const sortedTools = Object.entries(metrics.toolUseBreakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8);

  const maxToolCount = sortedTools.length > 0 ? sortedTools[0][1] : 1;

  const avgResponseTimeSec = metrics.avgResponseTimeMs
    ? (metrics.avgResponseTimeMs / 1000).toFixed(1) + "s"
    : "N/A";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Monitor className="size-5 text-muted-foreground" />
          Cursor Usage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            icon={<MessageSquare className="size-4" />}
            label="Total Prompts"
            value={metrics.totalPrompts.toLocaleString()}
          />
          <StatCard
            icon={<Zap className="size-4" />}
            label="Total Events"
            value={metrics.totalEvents.toLocaleString()}
          />
          <StatCard
            icon={<Monitor className="size-4" />}
            label="Sessions"
            value={metrics.totalSessions}
          />
          <StatCard
            icon={<Brain className="size-4" />}
            label="Models Used"
            value={metrics.modelsUsed.length}
          />
          <StatCard
            icon={<Plug className="size-4" />}
            label="MCP Executions"
            value={metrics.mcpExecutionsCount}
          />
          <StatCard
            icon={<Clock className="size-4" />}
            label="Avg Response"
            value={avgResponseTimeSec}
          />
        </div>

        {/* Structure summary */}
        <div>
          <h4 className="mb-2 text-sm font-semibold">Cursor Structure</h4>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>
              <span className="font-medium text-foreground">
                {structure.rulesCount}
              </span>{" "}
              rules
            </span>
            <span>
              <span className="font-medium text-foreground">
                {structure.skillsCount}
              </span>{" "}
              skills
            </span>
            <span>
              <span className="font-medium text-foreground">
                {structure.commandsCount}
              </span>{" "}
              commands
            </span>
          </div>
        </div>

        {/* Tool use breakdown */}
        {sortedTools.length > 0 && (
          <div>
            <h4 className="mb-3 text-sm font-semibold">
              Tool Use Breakdown
            </h4>
            <div className="space-y-2">
              {sortedTools.map(([tool, count]) => {
                const pct = (count / maxToolCount) * 100;
                return (
                  <div key={tool} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate font-medium">{tool}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {count}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-cyan-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
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
