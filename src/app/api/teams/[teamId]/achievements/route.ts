import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  teams,
  achievements,
  events,
  customAchievementDefinitions,
} from "@/lib/db/schema";
import type { AchievementRarity, AchievementCategory } from "@/types";
import {
  sendPublicAchievements,
  sendPrivateAchievements,
} from "@/lib/slack/client";

const RARITIES: AchievementRarity[] = ["common", "rare", "epic", "legendary"];
const CATEGORIES: AchievementCategory[] = [
  "implementation",
  "git",
  "code-quality",
  "design",
  "speed",
  "features",
  "fun",
];

function parseBody(body: unknown): {
  customDefinitionId?: string;
  name?: string;
  description?: string;
  icon?: string;
  rarity?: string;
  category?: string;
} {
  if (!body || typeof body !== "object") return {};
  const b = body as Record<string, unknown>;
  return {
    customDefinitionId:
      typeof b.customDefinitionId === "string"
        ? b.customDefinitionId
        : undefined,
    name: typeof b.name === "string" ? b.name : undefined,
    description: typeof b.description === "string" ? b.description : undefined,
    icon: typeof b.icon === "string" ? b.icon : undefined,
    rarity: typeof b.rarity === "string" ? b.rarity : undefined,
    category: typeof b.category === "string" ? b.category : undefined,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  try {
    const { teamId } = await params;
    const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const raw = await request.json().catch(() => ({}));
    const { customDefinitionId, name, description, icon, rarity, category } =
      parseBody(raw);

    let definitionId: string;
    let resolvedName: string;
    let resolvedDescription: string;
    let resolvedIcon: string;
    let resolvedRarity: AchievementRarity;
    let resolvedCategory: AchievementCategory;

    if (customDefinitionId) {
      const [def] = await db
        .select()
        .from(customAchievementDefinitions)
        .where(eq(customAchievementDefinitions.id, customDefinitionId));
      if (!def) {
        return NextResponse.json(
          { error: "Custom achievement definition not found" },
          { status: 404 },
        );
      }
      definitionId = def.id;
      resolvedName = def.name;
      resolvedDescription = def.description;
      resolvedIcon = def.icon;
      resolvedRarity = def.rarity as AchievementRarity;
      resolvedCategory = def.category as AchievementCategory;
    } else {
      if (
        !name?.trim() ||
        !description?.trim() ||
        !icon?.trim() ||
        !rarity ||
        !category
      ) {
        return NextResponse.json(
          {
            error:
              "Inline award requires name, description, icon, rarity, and category",
          },
          { status: 400 },
        );
      }
      if (!RARITIES.includes(rarity as AchievementRarity)) {
        return NextResponse.json({ error: "Invalid rarity" }, { status: 400 });
      }
      if (!CATEGORIES.includes(category as AchievementCategory)) {
        return NextResponse.json(
          { error: "Invalid category" },
          { status: 400 },
        );
      }
      const [created] = await db
        .insert(customAchievementDefinitions)
        .values({
          name: name.trim(),
          description: description.trim(),
          icon: icon.trim(),
          rarity,
          category,
        })
        .returning({ id: customAchievementDefinitions.id });
      if (!created) {
        return NextResponse.json(
          { error: "Failed to create custom definition" },
          { status: 500 },
        );
      }
      definitionId = created.id;
      resolvedName = name.trim();
      resolvedDescription = description.trim();
      resolvedIcon = icon.trim();
      resolvedRarity = rarity as AchievementRarity;
      resolvedCategory = category as AchievementCategory;
    }

    const achievementId = `custom:${definitionId}`;
    const existing = await db
      .select({ id: achievements.id })
      .from(achievements)
      .where(
        and(
          eq(achievements.teamId, teamId),
          eq(achievements.achievementId, achievementId),
        ),
      )
      .limit(1);
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "This team already has this achievement" },
        { status: 409 },
      );
    }

    const [row] = await db
      .insert(achievements)
      .values({
        teamId,
        achievementId,
      })
      .returning();

    if (!row) {
      return NextResponse.json(
        { error: "Failed to award achievement" },
        { status: 500 },
      );
    }

    await db.insert(events).values({
      teamId,
      type: "achievement",
      data: {
        achievementId,
        name: resolvedName,
        rarity: resolvedRarity,
      },
      points: null,
    });

    const definition = {
      id: achievementId,
      name: resolvedName,
      description: resolvedDescription,
      icon: resolvedIcon,
      rarity: resolvedRarity,
      category: resolvedCategory,
    };
    sendPublicAchievements(team.name, [definition]).catch(console.error);
    if (team.slackChannelId) {
      sendPrivateAchievements(team.slackChannelId, team.name, [
        definition,
      ]).catch(console.error);
    }

    const unlocked = {
      id: achievementId,
      name: resolvedName,
      description: resolvedDescription,
      icon: resolvedIcon,
      rarity: resolvedRarity,
      category: resolvedCategory,
      unlockedAt: row.unlockedAt.toISOString(),
    };

    return NextResponse.json(unlocked, { status: 201 });
  } catch (error) {
    console.error("POST /api/teams/[teamId]/achievements error:", error);
    return NextResponse.json(
      { error: "Failed to award achievement" },
      { status: 500 },
    );
  }
}
