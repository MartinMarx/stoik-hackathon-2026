import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { achievements, teams } from "@/lib/db/schema";
import { ACHIEVEMENTS } from "@/lib/achievements/definitions";
import { customAchievementDefinitions } from "@/lib/db/schema";

export async function GET() {
  try {
    const customRows = await db.select().from(customAchievementDefinitions);
    const customDefs = customRows.map((row) => ({
      id: `custom:${row.id}`,
      name: row.name,
      description: row.description,
      icon: row.icon,
      rarity: row.rarity,
      category: row.category,
    }));

    const definitions = [
      ...ACHIEVEMENTS,
      ...customDefs,
    ];

    const rows = await db
      .select({
        achievementId: achievements.achievementId,
        teamId: teams.id,
        teamName: teams.name,
      })
      .from(achievements)
      .innerJoin(teams, eq(achievements.teamId, teams.id));

    const stats: Record<
      string,
      { count: number; teams: { id: string; name: string }[] }
    > = {};
    for (const row of rows) {
      const id = row.achievementId;
      if (!stats[id]) {
        stats[id] = { count: 0, teams: [] };
      }
      stats[id].count += 1;
      stats[id].teams.push({
        id: row.teamId,
        name: row.teamName,
      });
    }

    return NextResponse.json({ definitions, stats });
  } catch (error) {
    console.error("GET /api/achievements error:", error);
    return NextResponse.json(
      { error: "Failed to fetch achievements" },
      { status: 500 },
    );
  }
}
