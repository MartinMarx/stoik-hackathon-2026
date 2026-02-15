import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { teams, scores, achievements } from "@/lib/db/schema";
import { getAchievementById } from "@/lib/achievements/definitions";
import type {
  LeaderboardEntry,
  UnlockedAchievement,
  ScoreBreakdown,
} from "@/types";

// ─── GET /api/leaderboard ───────────────────────────────────────────────────
// Returns ranked list of all teams with scores, achievements, and trends.

const EMPTY_BREAKDOWN: ScoreBreakdown = {
  implementation: { total: 0, rulesComplete: 0, rulesPartial: 0, creative: 0 },
  agentic: { total: 0, rules: 0, skills: 0, commands: 0 },
  codeQuality: { total: 0, typescript: 0, tests: 0, structure: 0 },
  gitActivity: { total: 0, commits: 0, contributors: 0, regularity: 0 },
  cursorUsage: { total: 0, prompts: 0, toolDiversity: 0, sessions: 0, models: 0 },
};

export async function GET() {
  try {
    // 1. Fetch all teams
    const allTeams = await db.select().from(teams);

    // 2. For each team, fetch latest 2 scores and all achievements in parallel
    const teamsData = await Promise.all(
      allTeams.map(async (team) => {
        const [latestScores, teamAchievements] = await Promise.all([
          // Get the 2 most recent scores for trend computation
          db
            .select()
            .from(scores)
            .where(eq(scores.teamId, team.id))
            .orderBy(desc(scores.recordedAt))
            .limit(2),

          // Get all achievements for this team
          db
            .select()
            .from(achievements)
            .where(eq(achievements.teamId, team.id)),
        ]);

        return { team, latestScores, teamAchievements };
      }),
    );

    // 3. Build entries with current scores (for current ranking)
    const currentEntries = teamsData.map(({ team, latestScores, teamAchievements }) => {
      const latestScore = latestScores[0] ?? null;
      const previousScore = latestScores[1] ?? null;

      // Map achievements to UnlockedAchievement with definitions
      const unlockedAchievements: UnlockedAchievement[] = [];
      for (const a of teamAchievements) {
        const def = getAchievementById(a.achievementId);
        if (!def) continue;
        unlockedAchievements.push({
          id: def.id,
          name: def.name,
          description: def.description,
          icon: def.icon,
          rarity: def.rarity,
          category: def.category,
          unlockedAt: a.unlockedAt.toISOString(),
          data: (a.data as Record<string, unknown>) ?? undefined,
        });
      }

      return {
        teamId: team.id,
        team: team.name,
        totalScore: latestScore?.total ?? 0,
        scoreBreakdown: (latestScore?.breakdown as ScoreBreakdown) ?? EMPTY_BREAKDOWN,
        achievements: unlockedAchievements,
        previousScore: previousScore?.total ?? null,
      };
    });

    // 4. Compute current ranks (sort by totalScore descending)
    const sortedCurrent = [...currentEntries].sort((a, b) => b.totalScore - a.totalScore);
    const currentRankMap = new Map<string, number>();
    sortedCurrent.forEach((entry, idx) => {
      currentRankMap.set(entry.teamId, idx + 1);
    });

    // 5. Compute previous ranks (based on previous scores)
    //    Only teams that had a previous score participate in the previous ranking.
    //    Teams without a previous score get no previousRank.
    const previousEntries = currentEntries
      .filter((e) => e.previousScore !== null)
      .map((e) => ({
        teamId: e.teamId,
        score: e.previousScore!,
      }));

    const sortedPrevious = [...previousEntries].sort((a, b) => b.score - a.score);
    const previousRankMap = new Map<string, number>();
    sortedPrevious.forEach((entry, idx) => {
      previousRankMap.set(entry.teamId, idx + 1);
    });

    // 6. Build final LeaderboardEntry[] with trend
    const leaderboard: LeaderboardEntry[] = sortedCurrent.map((entry, idx) => {
      const currentRank = idx + 1;
      const previousRank = previousRankMap.get(entry.teamId);

      let trend: "up" | "down" | "stable" = "stable";
      if (previousRank !== undefined) {
        if (currentRank < previousRank) {
          trend = "up"; // lower rank number = higher position = improved
        } else if (currentRank > previousRank) {
          trend = "down";
        }
      }

      return {
        rank: currentRank,
        team: entry.team,
        teamId: entry.teamId,
        totalScore: entry.totalScore,
        scoreBreakdown: entry.scoreBreakdown,
        achievements: entry.achievements,
        trend,
        ...(previousRank !== undefined ? { previousRank } : {}),
      };
    });

    return NextResponse.json(leaderboard);
  } catch (error) {
    console.error("GET /api/leaderboard error:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 },
    );
  }
}
