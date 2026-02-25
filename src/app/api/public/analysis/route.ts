import { NextResponse } from "next/server";
import { eq, desc, count } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  teams,
  achievements,
  events,
  analyses,
} from "@/lib/db/schema";
import { getAchievementById } from "@/lib/achievements/definitions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [
      allTeams,
      achievementRows,
      totalAchievementsResult,
      eventRows,
      analysisRows,
    ] = await Promise.all([
      db.select({ id: teams.id, name: teams.name }).from(teams),

      db
        .select({
          achievementId: achievements.achievementId,
          cnt: count(),
        })
        .from(achievements)
        .groupBy(achievements.achievementId),

      db
        .select({ count: count() })
        .from(achievements),

      db
        .select({
          teamId: events.teamId,
          type: events.type,
          data: events.data,
          createdAt: events.createdAt,
        })
        .from(events)
        .orderBy(events.createdAt),

      db
        .selectDistinctOn([analyses.teamId], {
          teamId: analyses.teamId,
          result: analyses.result,
        })
        .from(analyses)
        .where(eq(analyses.status, "completed"))
        .orderBy(analyses.teamId, desc(analyses.completedAt)),
    ]);

    const totalAchievements = totalAchievementsResult[0]?.count ?? 0;
    const teamNameMap = new Map(allTeams.map((t) => [t.id, t.name]));

    // Achievement breakdown by rarity + most popular
    const rarityCount = { common: 0, rare: 0, epic: 0, legendary: 0 };
    const achievementPopularity: { name: string; icon: string; count: number }[] = [];

    for (const row of achievementRows) {
      const def = getAchievementById(row.achievementId);
      if (def) {
        const r = def.rarity as keyof typeof rarityCount;
        if (r in rarityCount) rarityCount[r] += Number(row.cnt);
        achievementPopularity.push({
          name: def.name,
          icon: def.icon,
          count: Number(row.cnt),
        });
      }
    }

    achievementPopularity.sort((a, b) => b.count - a.count);

    // Score evolution: extract score from score_change events per team
    const teamScoreHistory = new Map<string, { time: string; score: number }[]>();

    for (const row of eventRows) {
      if (row.type !== "score_change") continue;
      const teamName = teamNameMap.get(row.teamId) ?? "Unknown";
      const eventData = row.data as Record<string, unknown> | null;
      const score =
        typeof eventData?.total === "number" ? eventData.total : null;
      if (score === null) continue;

      if (!teamScoreHistory.has(teamName)) teamScoreHistory.set(teamName, []);
      teamScoreHistory.get(teamName)!.push({
        time: new Date(row.createdAt).toISOString(),
        score: Math.round(score),
      });
    }

    const scoreEvolution: { team: string; points: { time: string; score: number }[] }[] = [];
    for (const [team, points] of teamScoreHistory) {
      scoreEvolution.push({ team, points });
    }

    // Aggregate git metrics from latest analysis per team
    let totalCommits = 0;
    let totalAdditions = 0;
    let totalDeletions = 0;
    const commitsByHour: Record<number, number> = {};
    const eventsByTeam: Record<string, number> = {};

    for (const row of analysisRows) {
      const result = row.result as { git?: { totalCommits?: number; additions?: number; deletions?: number; commits?: { date: string }[]; commitsByHour?: Record<string, number> } } | null;
      if (!result?.git) continue;

      const git = result.git;
      totalCommits += git.totalCommits ?? 0;
      totalAdditions += git.additions ?? 0;
      totalDeletions += git.deletions ?? 0;

      if (git.commitsByHour) {
        for (const [hour, c] of Object.entries(git.commitsByHour)) {
          const h = Number(hour);
          commitsByHour[h] = (commitsByHour[h] ?? 0) + c;
        }
      }
    }

    // Events per team for "busiest team"
    for (const row of eventRows) {
      const teamName = teamNameMap.get(row.teamId) ?? "Unknown";
      eventsByTeam[teamName] = (eventsByTeam[teamName] ?? 0) + 1;
    }

    const busiestTeam = Object.entries(eventsByTeam).sort((a, b) => b[1] - a[1])[0];

    // Peak coding hour
    let peakHour = 0;
    let peakCount = 0;
    for (const [h, c] of Object.entries(commitsByHour)) {
      if (c > peakCount) {
        peakCount = c;
        peakHour = Number(h);
      }
    }

    return NextResponse.json({
      totalTeams: allTeams.length,
      totalAchievements,
      totalCommits,
      totalLinesChanged: totalAdditions + totalDeletions,
      totalAdditions,
      totalDeletions,
      rarityBreakdown: rarityCount,
      achievementPopularity: achievementPopularity.slice(0, 10),
      scoreEvolution,
      commitsByHour,
      peakCodingHour: peakHour,
      busiestTeam: busiestTeam
        ? { name: busiestTeam[0], events: busiestTeam[1] }
        : null,
    });
  } catch (error) {
    console.error("GET /api/public/analysis error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analysis data" },
      { status: 500 },
    );
  }
}
