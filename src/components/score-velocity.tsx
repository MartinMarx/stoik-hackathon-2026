"use client";

import { TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Chart colors mapped to CSS custom properties (chart-1 through chart-5)
const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

interface ScoreDataPoint {
  time: string;
  score: number;
}

interface ScoreVelocityData {
  team: string;
  scores: ScoreDataPoint[];
}

interface ScoreVelocityProps {
  data: ScoreVelocityData[];
}

function formatTime(timeStr: string): string {
  try {
    const date = new Date(timeStr);
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return timeStr;
  }
}

export function ScoreVelocity({ data }: ScoreVelocityProps) {
  const hasData = data.length > 0 && data.some((d) => d.scores.length > 0);

  // Transform data into recharts format: [{ time, "Team A": 10, "Team B": 15 }, ...]
  const chartData: Record<string, string | number>[] = [];

  if (hasData) {
    // Gather all unique timestamps across all teams
    const timeSet = new Set<string>();
    for (const teamData of data) {
      for (const point of teamData.scores) {
        timeSet.add(point.time);
      }
    }

    // Sort timestamps chronologically
    const sortedTimes = Array.from(timeSet).sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime()
    );

    // Build per-team lookup for quick score resolution
    const teamScoreMaps = new Map<string, Map<string, number>>();
    for (const teamData of data) {
      const scoreMap = new Map<string, number>();
      for (const point of teamData.scores) {
        scoreMap.set(point.time, point.score);
      }
      teamScoreMaps.set(teamData.team, scoreMap);
    }

    // Build chart data rows
    for (const time of sortedTimes) {
      const row: Record<string, string | number> = { time };
      for (const teamData of data) {
        const scoreMap = teamScoreMaps.get(teamData.team);
        const score = scoreMap?.get(time);
        if (score !== undefined) {
          row[teamData.team] = score;
        }
      }
      chartData.push(row);
    }
  }

  // Find max score for Y axis domain
  let maxScore = 0;
  for (const teamData of data) {
    for (const point of teamData.scores) {
      if (point.score > maxScore) {
        maxScore = point.score;
      }
    }
  }
  // Round up to nearest 10 for a cleaner axis
  const yMax = Math.ceil((maxScore || 100) / 10) * 10;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="size-5 text-emerald-500" />
          Score Velocity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            No score data yet
          </p>
        ) : (
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border"
                />
                <XAxis
                  dataKey="time"
                  tickFormatter={formatTime}
                  className="text-xs"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  stroke="var(--border)"
                />
                <YAxis
                  domain={[0, yMax]}
                  className="text-xs"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  stroke="var(--border)"
                />
                <RechartsTooltip
                  labelFormatter={(label) => formatTime(String(label))}
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "var(--foreground)",
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "12px" }}
                  iconType="circle"
                  iconSize={8}
                />
                {data.map((teamData, idx) => (
                  <Line
                    key={teamData.team}
                    type="monotone"
                    dataKey={teamData.team}
                    stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
