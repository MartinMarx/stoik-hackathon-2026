import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teams, analyses } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getUnlockedAchievementsForTeam } from "@/lib/achievements/resolve";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  try {
    const { teamId } = await params;

    const [latest] = await db
      .select()
      .from(analyses)
      .where(and(eq(analyses.teamId, teamId), eq(analyses.status, "completed")))
      .orderBy(desc(analyses.completedAt))
      .limit(1);

    if (!latest) {
      return NextResponse.json(
        { error: "No analysis found for this team" },
        { status: 404 },
      );
    }

    const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
    const result = latest.result as Record<string, unknown> | null;

    let resultPayload = result;
    if (result && typeof result === "object") {
      const achievements = await getUnlockedAchievementsForTeam(teamId);

      resultPayload = {
        team: result.team,
        teamId: result.teamId,
        totalScore: result.totalScore,
        score: result.score,
        achievements,
        cursorMetrics: result.cursorMetrics,
        cursor: result.cursor,
        git: result.git,
      };
    }

    const payload = {
      ...latest,
      memberNames: team?.memberNames ?? [],
      result: resultPayload,
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error(
      "[public-analyze] GET /api/public/analyze/[teamId] error:",
      error,
    );
    return NextResponse.json(
      { error: "Failed to fetch analysis" },
      { status: 500 },
    );
  }
}
