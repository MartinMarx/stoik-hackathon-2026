"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, Layers, Trophy, Users } from "lucide-react";
import type {
  LeaderboardEntry,
  TimelineEvent,
  HackathonFeature,
} from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Leaderboard } from "@/components/leaderboard";
import { ActivityFeed } from "@/components/activity-feed";
import { FeaturesBoard } from "@/components/features-board";
import { ScoreVelocity } from "@/components/score-velocity";
import { useAnalysisEventsContext } from "@/components/analysis-provider";
import { SUBSCRIBE_ANY_TEAM } from "@/hooks/use-analysis-events";

// ─── Types for API responses ─────────────────────────────────────────────────

interface EventsResponse {
  events: TimelineEvent[];
  total: number;
}

interface ScoreVelocityData {
  team: string;
  scores: { time: string; score: number }[];
}

// ─── Dashboard Page ──────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { subscribeRefetch } = useAnalysisEventsContext();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [features, setFeatures] = useState<HackathonFeature[]>([]);
  const [scoreVelocity, setScoreVelocity] = useState<ScoreVelocityData[]>([]);
  const [lastAnalysisTime, setLastAnalysisTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [leaderboardRes, eventsRes, featuresRes, scoreEventsRes] =
        await Promise.all([
          fetch("/api/leaderboard"),
          fetch("/api/events?limit=30"),
          fetch("/api/features"),
          fetch("/api/events?type=score_change&limit=100"),
        ]);

      // Parse responses
      const [leaderboardData, eventsData, featuresData, scoreEventsData] =
        await Promise.all([
          leaderboardRes.ok
            ? (leaderboardRes.json() as Promise<LeaderboardEntry[]>)
            : Promise.resolve([] as LeaderboardEntry[]),
          eventsRes.ok
            ? (eventsRes.json() as Promise<EventsResponse>)
            : Promise.resolve({ events: [], total: 0 } as EventsResponse),
          featuresRes.ok
            ? (featuresRes.json() as Promise<HackathonFeature[]>)
            : Promise.resolve([] as HackathonFeature[]),
          scoreEventsRes.ok
            ? (scoreEventsRes.json() as Promise<EventsResponse>)
            : Promise.resolve({ events: [], total: 0 } as EventsResponse),
        ]);

      setLeaderboard(leaderboardData);
      setEvents(eventsData.events);
      setFeatures(featuresData);

      // Build score velocity from dedicated score_change events
      const velocityMap = new Map<string, { time: string; score: number }[]>();

      for (const event of scoreEventsData.events) {
        const teamName =
          event.teamName ??
          leaderboardData.find((e) => e.teamId === event.teamId)?.team ??
          "Unknown";

        const score =
          typeof event.data.total === "number"
            ? event.data.total
            : typeof event.data.totalScore === "number"
              ? event.data.totalScore
              : typeof event.data.score === "number"
                ? event.data.score
                : null;

        if (score === null) continue;

        const existing = velocityMap.get(teamName) ?? [];
        existing.push({ time: event.createdAt, score });
        velocityMap.set(teamName, existing);
      }

      const velocityData: ScoreVelocityData[] = [];
      for (const [team, scores] of velocityMap) {
        const sorted = scores.sort(
          (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
        );
        velocityData.push({ team, scores: sorted });
      }
      setScoreVelocity(velocityData);

      // Find latest analysis event for the stat card
      const latestAnalysis = eventsData.events.find(
        (e) => e.type === "analysis",
      );
      setLastAnalysisTime(latestAnalysis?.createdAt ?? null);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    return subscribeRefetch(SUBSCRIBE_ANY_TEAM, fetchData);
  }, [subscribeRefetch, fetchData]);

  // ─── Computed stats ──────────────────────────────────────────────────────────

  const totalTeams = leaderboard.length;
  const totalFeatures = features.length;
  const lastAnalysisDisplay = lastAnalysisTime
    ? formatRelativeTime(lastAnalysisTime)
    : "Never";

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Real-time hackathon overview
        </p>
      </div>

      {/* Top row: Quick stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total Teams"
          value={String(totalTeams)}
          icon={<Users className="size-4 text-muted-foreground" />}
        />
        <StatCard
          title="Total Features"
          value={String(totalFeatures)}
          icon={<Layers className="size-4 text-muted-foreground" />}
        />
        <StatCard
          title="Latest Analysis"
          value={lastAnalysisDisplay}
          icon={<Clock className="size-4 text-muted-foreground" />}
        />
      </div>

      {/* Middle row: Leaderboard (wider) + Activity Feed */}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Leaderboard entries={leaderboard} />
        </div>
        <div className="lg:col-span-2">
          <ActivityFeed events={events} />
        </div>
      </div>

      {/* Bottom row: Features Board + Score Velocity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <FeaturesBoard features={features} />
        <ScoreVelocity data={scoreVelocity} />
      </div>
    </div>
  );
}

// ─── StatCard ────────────────────────────────────────────────────────────────

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

// ─── DashboardSkeleton ───────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-1 h-4 w-64" />
      </div>

      {/* Stat cards skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Middle row skeleton */}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom row skeleton */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(dateStr).toLocaleDateString();
}
