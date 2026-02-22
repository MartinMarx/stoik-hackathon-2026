import { eq, inArray } from "drizzle-orm";
import type { AchievementDefinition, UnlockedAchievement } from "@/types";
import { getAchievementById } from "@/lib/achievements/definitions";
import { db } from "@/lib/db";
import { achievements, customAchievementDefinitions } from "@/lib/db/schema";

const CUSTOM_PREFIX = "custom:";

export async function resolveAchievementDefinition(
  achievementId: string,
): Promise<AchievementDefinition | undefined> {
  const builtIn = getAchievementById(achievementId);
  if (builtIn) return builtIn;
  if (!achievementId.startsWith(CUSTOM_PREFIX)) return undefined;
  const uuid = achievementId.slice(CUSTOM_PREFIX.length);
  const [row] = await db
    .select()
    .from(customAchievementDefinitions)
    .where(eq(customAchievementDefinitions.id, uuid));
  if (!row) return undefined;
  return rowToDefinition(row);
}

function rowToDefinition(
  row: typeof customAchievementDefinitions.$inferSelect,
) {
  return {
    id: `${CUSTOM_PREFIX}${row.id}`,
    name: row.name,
    description: row.description,
    icon: row.icon,
    rarity: row.rarity as AchievementDefinition["rarity"],
    category: row.category as AchievementDefinition["category"],
  };
}

export async function batchResolveAchievementDefinitions(
  achievementIds: string[],
): Promise<Map<string, AchievementDefinition>> {
  const customIds = achievementIds.filter((id) => id.startsWith(CUSTOM_PREFIX));
  if (customIds.length === 0) return new Map();
  const uuids = customIds.map((id) => id.slice(CUSTOM_PREFIX.length));
  const rows = await db
    .select()
    .from(customAchievementDefinitions)
    .where(inArray(customAchievementDefinitions.id, uuids));
  const map = new Map<string, AchievementDefinition>();
  for (const row of rows) {
    map.set(`${CUSTOM_PREFIX}${row.id}`, rowToDefinition(row));
  }
  return map;
}

export async function getUnlockedAchievementsForTeam(
  teamId: string,
): Promise<UnlockedAchievement[]> {
  const rows = await db
    .select()
    .from(achievements)
    .where(eq(achievements.teamId, teamId));
  const result: UnlockedAchievement[] = [];
  for (const row of rows) {
    const def = await resolveAchievementDefinition(row.achievementId);
    if (!def) continue;
    result.push({
      ...def,
      unlockedAt: row.unlockedAt.toISOString(),
      data: (row.data as Record<string, unknown>) ?? undefined,
    });
  }
  return result;
}
