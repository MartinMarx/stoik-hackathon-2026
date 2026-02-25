"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Trophy,
  GitCommit,
  Cpu,
  Clock,
  Code2,
  TrendingUp,
  BarChart3,
  Users,
  Flame,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import cursorData from "@/lib/cursor-data.json";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const PARIS_TZ = "Europe/Paris";

function getYesterday8pmParis() {
  const now = new Date();
  const parisStr = now.toLocaleString("en-US", { timeZone: PARIS_TZ });
  const parisNow = new Date(parisStr);

  const target = new Date(parisNow);
  target.setDate(target.getDate() - 1);
  target.setHours(20, 0, 0, 0);

  const offsetMs = now.getTime() - parisNow.getTime();
  return new Date(target.getTime() + offsetMs);
}

interface AnalysisData {
  totalTeams: number;
  totalAchievements: number;
  totalCommits: number;
  totalLinesChanged: number;
  totalAdditions: number;
  totalDeletions: number;
  rarityBreakdown: {
    common: number;
    rare: number;
    epic: number;
    legendary: number;
  };
  achievementPopularity: { name: string; icon: string; count: number }[];
  scoreEvolution: { team: string; points: { time: string; score: number }[] }[];
  commitsByHour: Record<string, number>;
  peakCodingHour: number;
  busiestTeam: { name: string; events: number } | null;
}

function formatParisTime(timeStr: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TZ,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timeStr));
}

function formatHourParis(hour: number) {
  return `${hour}h`;
}

function formatNumber(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n);
}

function extractFirstName(email: string) {
  const local = email.split("@")[0];
  const parts = local.split(".");
  return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
}

// -- Token data from cursor-data.json --
const tokenEntries = Object.entries(cursorData as Record<string, number>)
  .map(([email, tokens]) => ({ name: extractFirstName(email), tokens }))
  .sort((a, b) => b.tokens - a.tokens);

const top5Tokens = tokenEntries.slice(0, 5);
const totalTokens = tokenEntries.reduce((sum, e) => sum + e.tokens, 0);

export default function AnalysisPage() {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);

  const cutoff = useMemo(() => getYesterday8pmParis(), []);

  useEffect(() => {
    fetch("/api/public/analysis")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const {
    chartData: scoreChartData,
    teams: scoreTeams,
    blurPct,
  } = useMemo(
    () => buildScoreChart(data?.scoreEvolution ?? [], cutoff),
    [data?.scoreEvolution, cutoff],
  );

  if (loading) return <AnalysisSkeleton />;
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <p>Failed to load analysis data.</p>
      </div>
    );
  }

  // Build coding hours chart (0-23h)
  const codingHoursData = Array.from({ length: 24 }, (_, h) => ({
    hour: formatHourParis(h),
    commits: Number(data.commitsByHour[h] ?? 0),
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="bg-linear-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-3xl font-black tracking-tight text-transparent sm:text-4xl">
          Hackathon Analytics
        </h1>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Achievements Unlocked"
          value={formatNumber(data.totalAchievements)}
          icon={<Trophy className="size-4 text-amber-500" />}
        />
        <StatCard
          title="Total Commits"
          value={formatNumber(data.totalCommits)}
          icon={<GitCommit className="size-4 text-emerald-500" />}
        />
        <StatCard
          title="AI Tokens Consumed"
          value={formatNumber(totalTokens)}
          icon={<Cpu className="size-4 text-indigo-500" />}
        />
      </div>

      {/* Score Evolution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="size-5 text-emerald-500" />
            Score Evolution
          </CardTitle>
        </CardHeader>
        <CardContent>
          {scoreChartData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No score data yet
            </p>
          ) : (
            <div className="relative h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={scoreChartData}
                  margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                  />
                  <XAxis
                    dataKey="time"
                    tickFormatter={formatParisTime}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    stroke="var(--border)"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    stroke="var(--border)"
                  />
                  <RechartsTooltip
                    labelFormatter={(l) => formatParisTime(String(l))}
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
                  {scoreTeams.map((team, idx) => (
                    <Line
                      key={team}
                      type="monotone"
                      dataKey={team}
                      stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 3 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>

              {/* Diagonal stripes overlay for data after the cutoff */}
              {blurPct > 0 && (
                <div
                  className="pointer-events-none absolute top-0 bottom-0 z-10 flex items-center justify-center overflow-hidden"
                  style={{
                    right: 0,
                    width: `${blurPct}%`,
                  }}
                >
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `repeating-linear-gradient(
                        -45deg,
                        oklch(0.15 0 0),
                        oklch(0.15 0 0) 8px,
                        oklch(0.2 0.015 270) 8px,
                        oklch(0.2 0.015 270) 16px
                      )`,
                    }}
                  />
                  <span className="relative z-10 rounded-md border border-border bg-background/90 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
                    Results hidden until reveal
                  </span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Two-column: Coding Hours + Top Token Users */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Coding Hours Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-5 text-blue-500" />
              Coding Hours (Paris)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={codingHoursData}
                  margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                  />
                  <XAxis
                    dataKey="hour"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    stroke="var(--border)"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    stroke="var(--border)"
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "var(--foreground)",
                    }}
                  />
                  <Bar dataKey="commits" radius={[4, 4, 0, 0]}>
                    {codingHoursData.map((entry, idx) => (
                      <Cell
                        key={idx}
                        fill={
                          entry.hour === formatHourParis(data.peakCodingHour)
                            ? "var(--chart-5)"
                            : "var(--chart-2)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top 5 Token Users */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-5 text-indigo-500" />
              Top 5 Token Consumers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={top5Tokens}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                  />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    stroke="var(--border)"
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={80}
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    stroke="var(--border)"
                  />
                  <RechartsTooltip
                    formatter={(value: number) => [
                      formatNumber(value),
                      "Tokens",
                    ]}
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "var(--foreground)",
                    }}
                  />
                  <Bar dataKey="tokens" radius={[0, 4, 4, 0]}>
                    {top5Tokens.map((_, idx) => (
                      <Cell
                        key={idx}
                        fill={CHART_COLORS[idx % CHART_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fun stats */}
      <div>
        <h2 className="mb-4 text-lg font-semibold tracking-tight">Fun Stats</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FunStatCard
            icon={<Flame className="size-5 text-orange-500" />}
            label="Peak Coding Hour"
            value={`${formatHourParis(data.peakCodingHour)} (Paris)`}
          />
          <FunStatCard
            icon={<Code2 className="size-5 text-green-500" />}
            label="Lines Changed"
            value={formatNumber(data.totalLinesChanged)}
            sub={`+${formatNumber(data.totalAdditions)} / -${formatNumber(data.totalDeletions)}`}
          />
          {data.busiestTeam && (
            <FunStatCard
              icon={<BarChart3 className="size-5 text-cyan-500" />}
              label="Busiest Team"
              value={data.busiestTeam.name}
              sub={`${formatNumber(data.busiestTeam.events)} events`}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// -- Helper components --

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function FunStatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          {icon}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-lg font-bold">{value}</div>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function AnalysisSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-2 h-4 w-48" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[350px] w-full" />
        </CardContent>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[280px] w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[280px] w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// -- Chart data builder --

function buildScoreChart(
  teamData: { team: string; points: { time: string; score: number }[] }[],
  cutoff: Date,
) {
  if (teamData.length === 0)
    return {
      chartData: [] as Record<string, string | number>[],
      teams: [] as string[],
      blurPct: 0,
    };

  const teams = teamData.map((t) => t.team);
  const timeSet = new Set<string>();
  for (const t of teamData) {
    for (const p of t.points) timeSet.add(p.time);
  }

  const sortedTimes = Array.from(timeSet).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime(),
  );

  const lastScore = new Map<string, number>();
  const chartData: Record<string, string | number>[] = [];

  for (const time of sortedTimes) {
    const row: Record<string, string | number> = { time };
    for (const t of teamData) {
      const p = t.points.find((pt) => pt.time === time);
      if (p) lastScore.set(t.team, p.score);
      const s = lastScore.get(t.team);
      if (s !== undefined) row[t.team] = s;
    }
    chartData.push(row);
  }

  const cutoffMs = cutoff.getTime();
  const afterCutoffCount = sortedTimes.filter(
    (t) => new Date(t).getTime() >= cutoffMs,
  ).length;
  const blurPct =
    sortedTimes.length > 0
      ? Math.round((afterCutoffCount / sortedTimes.length) * 100)
      : 0;

  return { chartData, teams, blurPct };
}
