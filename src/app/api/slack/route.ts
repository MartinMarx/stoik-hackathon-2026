import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { teams, scores, features } from "@/lib/db/schema";
import {
  sendLeaderboard,
  sendTeamRecommendations,
  sendToChannel,
} from "@/lib/slack/client";
import { getUnlockedAchievementsForTeam } from "@/lib/achievements/resolve";
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

      case "team-recommendations":
        return await handleTeamRecommendations(data);

      default:
        return NextResponse.json(
          {
            error: `Unknown action: ${action}. Expected "leaderboard", "announcement", or "team-recommendations".`,
          },
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
      const [scoresRows, unlockedAchievements] = await Promise.all([
        db
          .select()
          .from(scores)
          .where(eq(scores.teamId, team.id))
          .orderBy(desc(scores.recordedAt))
          .limit(1),
        getUnlockedAchievementsForTeam(team.id),
      ]);
      const latestScore = scoresRows[0] ?? null;
      return {
        team,
        latestScore,
        unlockedAchievements,
      };
    }),
  );

  teamsWithScores.sort((a, b) => {
    const scoreA = a.latestScore?.total ?? -1;
    const scoreB = b.latestScore?.total ?? -1;
    return scoreB - scoreA;
  });

  const entries: LeaderboardEntry[] = teamsWithScores.map((item, index) => {
    return {
      rank: index + 1,
      team: item.team.name,
      teamId: item.team.id,
      totalScore: item.latestScore?.total ?? 0,
      scoreBreakdown: (item.latestScore?.breakdown as ScoreBreakdown) ?? {
        implementation: {
          total: 0,
          rulesComplete: 0,
          rulesPartial: 0,
          creative: 0,
        },
        agentic: { total: 0, rules: 0, skills: 0, commands: 0 },
        codeQuality: { total: 0, typescript: 0, tests: 0, structure: 0 },
        gitActivity: { total: 0, commits: 0, contributors: 0, regularity: 0 },
        cursorUsage: {
          total: 0,
          prompts: 0,
          toolDiversity: 0,
          sessions: 0,
          models: 0,
        },
      },
      achievements: item.unlockedAchievements,
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
  if (
    !data ||
    typeof data.message !== "string" ||
    data.message.trim().length === 0
  ) {
    return NextResponse.json(
      { error: "data.message is required and must be a non-empty string" },
      { status: 400 },
    );
  }

  const slackToken = process.env.SLACK_BOT_TOKEN;
  const channelId = process.env.SLACK_CHANNEL_ID;

  if (!slackToken || !channelId) {
    return NextResponse.json(
      {
        error:
          "Slack environment variables (SLACK_BOT_TOKEN, SLACK_CHANNEL_ID) are not configured",
      },
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

// ─── Team Recommendations ───────────────────────────────────────────────────

async function handleTeamRecommendations(
  data?: Record<string, unknown>,
): Promise<NextResponse> {
  if (!data || typeof data.teamId !== "string") {
    return NextResponse.json(
      { error: "data.teamId is required" },
      { status: 400 },
    );
  }

  const { teamId, teamName, recommendations, score } = data as {
    teamId: string;
    teamName: string;
    recommendations: string[];
    score: number;
  };

  if (!Array.isArray(recommendations) || recommendations.length === 0) {
    return NextResponse.json(
      { error: "data.recommendations must be a non-empty array of strings" },
      { status: 400 },
    );
  }

  const topRecommendations = recommendations.slice(0, 5);

  // Look up the team's Slack channel
  const [team] = await db
    .select({ slackChannelId: teams.slackChannelId, name: teams.name })
    .from(teams)
    .where(eq(teams.id, teamId));

  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const displayName = teamName || team.name;

  if (team.slackChannelId) {
    await sendTeamRecommendations(
      team.slackChannelId,
      displayName,
      topRecommendations,
      score ?? 0,
    );
  } else {
    const globalChannel = process.env.SLACK_CHANNEL_ID;
    if (!globalChannel) {
      return NextResponse.json(
        { error: "No team channel configured and SLACK_CHANNEL_ID is not set" },
        { status: 500 },
      );
    }
    await sendTeamRecommendations(
      globalChannel,
      displayName,
      topRecommendations,
      score ?? 0,
    );
  }

  return NextResponse.json({
    success: true,
    message: team.slackChannelId
      ? `Recommendations sent to team channel`
      : `Recommendations sent to global channel (no team channel configured)`,
  });
}
