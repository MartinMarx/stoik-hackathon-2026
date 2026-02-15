import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { teams, scores, features, achievements } from "@/lib/db/schema";
import { sendLeaderboard } from "@/lib/slack/client";
import { getAchievementById } from "@/lib/achievements/definitions";
import { WebClient } from "@slack/web-api";
import type {
  LeaderboardEntry,
  ScoreBreakdown,
  UnlockedAchievement,
} from "@/types";

// ─── POST /api/slack ────────────────────────────────────────────────────────
// Wraps Slack client functions for admin dashboard buttons.
// Body: { action: "leaderboard" | "announcement", data?: any }

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body as {
      action?: string;
      data?: Record<string, unknown>;
    };

    if (!action || typeof action !== "string") {
      return NextResponse.json(
        { error: "action is required and must be a string" },
        { status: 400 },
      );
    }

    switch (action) {
      case "leaderboard":
        return await handleLeaderboard();

      case "announcement":
        return await handleAnnouncement(data);

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Expected "leaderboard" or "announcement".` },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error("POST /api/slack error:", error);
    return NextResponse.json(
      { error: "Failed to process Slack action" },
      { status: 500 },
    );
  }
}

// ─── Leaderboard ────────────────────────────────────────────────────────────

async function handleLeaderboard(): Promise<NextResponse> {
  // 1. Fetch all teams
  const allTeams = await db.select().from(teams);

  // 2. For each team, get latest score and achievements
  const teamsWithScores = await Promise.all(
    allTeams.map(async (team) => {
      const [latestScore] = await db
        .select()
        .from(scores)
        .where(eq(scores.teamId, team.id))
        .orderBy(desc(scores.recordedAt))
        .limit(1);

      const teamAchievements = await db
        .select()
        .from(achievements)
        .where(eq(achievements.teamId, team.id));

      return {
        team,
        latestScore: latestScore ?? null,
        achievements: teamAchievements,
      };
    }),
  );

  // 3. Sort by score descending
  teamsWithScores.sort((a, b) => {
    const scoreA = a.latestScore?.total ?? -1;
    const scoreB = b.latestScore?.total ?? -1;
    return scoreB - scoreA;
  });

  // 4. Build LeaderboardEntry array
  const entries: LeaderboardEntry[] = teamsWithScores.map((item, index) => {
    const unlockedAchievements: UnlockedAchievement[] = [];
    for (const a of item.achievements) {
      const def = getAchievementById(a.achievementId);
      if (!def) continue;
      unlockedAchievements.push({
        ...def,
        unlockedAt: a.unlockedAt.toISOString(),
        data: (a.data as Record<string, unknown>) ?? undefined,
      });
    }

    return {
      rank: index + 1,
      team: item.team.name,
      teamId: item.team.id,
      totalScore: item.latestScore?.total ?? 0,
      scoreBreakdown: (item.latestScore?.breakdown as ScoreBreakdown) ?? {
        implementation: { total: 0, rulesComplete: 0, rulesPartial: 0, creative: 0 },
        agentic: { total: 0, rules: 0, skills: 0, commands: 0 },
        codeQuality: { total: 0, typescript: 0, tests: 0, structure: 0 },
        gitActivity: { total: 0, commits: 0, contributors: 0, regularity: 0 },
        cursorUsage: { total: 0, prompts: 0, toolDiversity: 0, sessions: 0, models: 0 },
      },
      achievements: unlockedAchievements,
      trend: "stable" as const,
    };
  });

  // 5. Compute maxScore = 100 (base) + sum of announced feature points
  const announcedFeatures = await db
    .select({ points: features.points })
    .from(features)
    .where(eq(features.status, "announced"));

  const featurePointsTotal = announcedFeatures.reduce(
    (acc, f) => acc + f.points,
    0,
  );
  const maxScore = 100 + featurePointsTotal;

  // 6. Send to Slack
  await sendLeaderboard(entries, maxScore);

  return NextResponse.json({
    success: true,
    message: `Leaderboard sent to Slack with ${entries.length} teams (max score: ${maxScore})`,
  });
}

// ─── Announcement ───────────────────────────────────────────────────────────

async function handleAnnouncement(
  data?: Record<string, unknown>,
): Promise<NextResponse> {
  if (!data || typeof data.message !== "string" || data.message.trim().length === 0) {
    return NextResponse.json(
      { error: "data.message is required and must be a non-empty string" },
      { status: 400 },
    );
  }

  const slackToken = process.env.SLACK_BOT_TOKEN;
  const channelId = process.env.SLACK_CHANNEL_ID;

  if (!slackToken || !channelId) {
    return NextResponse.json(
      { error: "Slack environment variables (SLACK_BOT_TOKEN, SLACK_CHANNEL_ID) are not configured" },
      { status: 500 },
    );
  }

  const slack = new WebClient(slackToken);

  await slack.chat.postMessage({
    channel: channelId,
    text: data.message as string,
  });

  return NextResponse.json({
    success: true,
    message: "Announcement sent to Slack",
  });
}
