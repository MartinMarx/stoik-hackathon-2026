import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { customAchievementDefinitions } from "@/lib/db/schema";
import type { AchievementRarity, AchievementCategory } from "@/types";

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

export async function GET() {
  try {
    const rows = await db.select().from(customAchievementDefinitions);
    const list = rows.map((row) => ({
      id: row.id,
      achievementId: `custom:${row.id}`,
      name: row.name,
      description: row.description,
      icon: row.icon,
      rarity: row.rarity,
      category: row.category,
      createdAt: row.createdAt.toISOString(),
    }));
    return NextResponse.json(list);
  } catch (error) {
    console.error("GET /api/custom-achievements error:", error);
    return NextResponse.json(
      { error: "Failed to fetch custom achievements" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description =
      typeof body.description === "string" ? body.description.trim() : "";
    const icon = typeof body.icon === "string" ? body.icon.trim() : "🏅";
    const rarity = typeof body.rarity === "string" ? body.rarity : "";
    const category = typeof body.category === "string" ? body.category : "";

    if (!name || !description) {
      return NextResponse.json(
        { error: "name and description are required" },
        { status: 400 },
      );
    }
    if (!RARITIES.includes(rarity as AchievementRarity)) {
      return NextResponse.json({ error: "Invalid rarity" }, { status: 400 });
    }
    if (!CATEGORIES.includes(category as AchievementCategory)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    const [row] = await db
      .insert(customAchievementDefinitions)
      .values({
        name,
        description,
        icon: icon || "🏅",
        rarity,
        category,
      })
      .returning();

    if (!row) {
      return NextResponse.json(
        { error: "Failed to create custom achievement" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        id: row.id,
        achievementId: `custom:${row.id}`,
        name: row.name,
        description: row.description,
        icon: row.icon,
        rarity: row.rarity,
        category: row.category,
        createdAt: row.createdAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/custom-achievements error:", error);
    return NextResponse.json(
      { error: "Failed to create custom achievement" },
      { status: 500 },
    );
  }
}
